import { invalido, naoEncontrado } from '../erros.js'
import { CARREIRAS_CIVIS } from '../dominio/pessoal/civis.js'
import { exigir } from './sessao.js'

/*
  Livro de ponto digital do pessoal civil: entradas e saídas da unidade com impressão digital.

  Os aparelhos (ZKTeco e compatíveis, protocolo «push»/ADMS) falam sozinhos com este servidor:
    GET  /iclock/cdata       o aparelho apresenta-se (número de série) e recebe as opções;
    POST /iclock/cdata       envia as marcações (ATTLOG) e os registos de operação (OPERLOG: digitais novas);
    GET  /iclock/getrequest  vem buscar ordens (a lista do pessoal, registar uma digital…);
    POST /iclock/devicecmd   diz como correu cada ordem.
  Um aparelho novo fica «por aprovar» e nada do que envia conta até a Repartição o aprovar. Ao aprovar,
  recebe a lista do pessoal civil (número = n.º da ficha); depois é só registar as digitais no aparelho.
  As impressões digitais ficam só no aparelho; aqui guarda-se apenas que dedos de quem estão registados.

  Entrada ou saída: as marcações de cada dia alternam (1.ª entrada, 2.ª saída, …); duas marcações
  seguidas em menos de 2 minutos contam como uma. A hora do aparelho é a de Luanda (UTC+1).
*/
const FUSO = '+01:00'
const REPETIDA_MS = 2 * 60_000
const HORARIO_PADRAO = { entrada: '08:00', saida: '15:30', tolerancia: 15 }
const VERIFICACAO = { 0: 'codigo', 1: 'digital', 2: 'cartao', 3: 'codigo', 4: 'cartao', 15: 'rosto' }
export const ESTADOS_PONTO = { dentro: 'Na unidade', saiu: 'Saiu', sem_marcacao: 'Sem marcação', licenca: 'De licença', falta: 'Falta', descanso: 'Fim de semana' }

const doisDig = (n) => String(n).padStart(2, '0')
const hojeLuanda = (agora) => new Date(agora.getTime() + 3_600_000).toISOString().slice(0, 10)
const inicioDoDia = (data) => new Date(`${data}T00:00:00${FUSO}`)
const horaLuanda = (d) => new Date(d.getTime() + 3_600_000).toISOString().slice(11, 16)
const minutos = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }
const diaDaSemana = (data) => new Date(`${data}T12:00:00Z`).getUTCDay()
// o nome no aparelho: sem acentos (alguns aparelhos não os mostram) e no máximo 24 letras
const nomeAparelho = (nome) => String(nome).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w .'-]/g, '').slice(0, 24)

// as marcações de um dia, por ordem, sem as repetidas, com entrada/saída alternadas
export function ordenarDia(marcacoes) {
  const l = [...marcacoes].sort((a, b) => a.quando - b.quando)
  const r = []
  for (const m of l) if (!r.length || m.quando - r[r.length - 1].quando >= REPETIDA_MS) r.push(m)
  return r.map((m, i) => ({ ...m, tipo: i % 2 === 0 ? 'entrada' : 'saida' }))
}

// as linhas «chave=valor» separadas por tabuladores (USER PIN=1\tName=…, FP PIN=1\tFID=0…)
const campos = (linha) => Object.fromEntries(linha.replace(/^\w+\s+/, '').split('\t').map((p) => { const i = p.indexOf('='); return i > 0 ? [p.slice(0, i).toLowerCase(), p.slice(i + 1)] : [p, ''] }))

export class ServicoPonto {
  constructor({ bd, auditoria, ausencias, tempoReal, agora = () => new Date() }) {
    Object.assign(this, { bd, auditoria, ausencias, tempoReal, agora })
  }

  #avisar(tipo = 'ponto') {
    this.tempoReal?.avisar('pessoal', { tipo })
  }

  // ---------------- o que os aparelhos pedem (sem sessão; só a rede interna) ----------------

  async #aparelho(sn, ip, extra = {}) {
    const numeroSerie = String(sn ?? '').trim().slice(0, 40)
    if (!/^[\w-]{3,40}$/.test(numeroSerie)) throw invalido('Número de série do aparelho inválido.', 'SN')
    const novo = !(await this.bd.aparelhoPonto.findUnique({ where: { numeroSerie }, select: { id: true } }))
    const a = await this.bd.aparelhoPonto.upsert({
      where: { numeroSerie },
      create: { numeroSerie, ip: ip ?? '', ultimoContacto: this.agora(), nome: `Aparelho ${numeroSerie}`, ...extra },
      update: { ip: ip ?? '', ultimoContacto: this.agora(), ...extra },
    })
    if (novo) {
      await this.auditoria.registar(null, 'aparelho_ponto_novo', numeroSerie, { ip }, ip ?? '')
      this.#avisar('aparelhos')
    }
    return a
  }

  // apresentação: as opções que o aparelho usa (enviar logo cada marcação; hora de Luanda)
  async apresentacao(sn, ip, { modelo } = {}) {
    const a = await this.#aparelho(sn, ip, modelo ? { modelo: String(modelo).slice(0, 60) } : {})
    return [
      `GET OPTION FROM: ${a.numeroSerie}`,
      'ATTLOGStamp=None', 'OPERLOGStamp=9999', 'ATTPHOTOStamp=None',
      'ErrorDelay=30', 'Delay=10', 'TransTimes=00:00;14:05', 'TransInterval=1',
      'TransFlag=TransData AttLog OpLog EnrollFP ChgFP', 'TimeZone=1', 'Realtime=1', 'Encrypt=None',
    ].join('\n')
  }

  // dados enviados pelo aparelho: devolve quantos aceitou (o aparelho por aprovar recebe null: volta a tentar)
  async receber(sn, ip, tabela, corpo) {
    const a = await this.#aparelho(sn, ip)
    if (!a.aprovado) return null
    const linhas = String(corpo ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    if (tabela === 'ATTLOG') return this.#marcacoes(a, linhas)
    if (tabela === 'OPERLOG' || tabela === 'BIODATA') return this.#digitais(a, linhas)
    return linhas.length
  }

  async #marcacoes(a, linhas) {
    const ids = new Set((await this.bd.pessoa.findMany({ select: { id: true } })).map((p) => p.id))
    const novas = []
    for (const l of linhas) {
      const [pin, quando, , verificar] = l.split('\t')
      const id = Number(pin)
      const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/.exec(String(quando ?? '').trim())
      if (!ids.has(id) || !m) continue
      novas.push({ pessoaId: id, quando: new Date(`${m[1]}T${m[2]}${FUSO}`), origem: 'aparelho', verificacao: VERIFICACAO[Number(verificar)] ?? 'aparelho', aparelhoId: a.id })
    }
    if (novas.length) {
      await this.bd.marcacao.createMany({ data: novas, skipDuplicates: true })
      this.#avisar()
    }
    return linhas.length
  }

  // digitais registadas no aparelho (FP PIN=…\tFID=…, ou BIODATA Pin=…\tNo=…\tType=1); o modelo da digital não se guarda
  async #digitais(a, linhas) {
    let novas = 0
    for (const l of linhas) {
      if (!/^(FP|BIODATA)\b/.test(l)) continue
      const c = campos(l)
      if (l.startsWith('BIODATA') && c.type && c.type !== '1') continue
      const pessoaId = Number(c.pin)
      const dedo = Number(c.fid ?? c.no ?? 0)
      if (!Number.isInteger(pessoaId) || !Number.isInteger(dedo)) continue
      if (!(await this.bd.pessoa.findUnique({ where: { id: pessoaId }, select: { id: true } }))) continue
      await this.bd.digitalPonto.upsert({ where: { pessoaId_aparelhoId_dedo: { pessoaId, aparelhoId: a.id, dedo } }, create: { pessoaId, aparelhoId: a.id, dedo }, update: {} })
      novas++
    }
    if (novas) this.#avisar('digitais')
    return linhas.length
  }

  // ordens à espera (no máximo 20 de cada vez): «C:<id>:<ordem>»; sem ordens, «OK»
  async ordens(sn, ip) {
    const a = await this.#aparelho(sn, ip)
    if (!a.aprovado) return 'OK'
    const l = await this.bd.comandoPonto.findMany({ where: { aparelhoId: a.id, estado: 'pendente' }, orderBy: { id: 'asc' }, take: 20 })
    if (!l.length) return 'OK'
    await this.bd.comandoPonto.updateMany({ where: { id: { in: l.map((c) => c.id) } }, data: { estado: 'enviado', enviadoEm: this.agora() } })
    return l.map((c) => `C:${c.id}:${c.texto}`).join('\n')
  }

  // respostas às ordens: «ID=12&Return=0&CMD=DATA» (0 = correu bem)
  async respostas(sn, ip, corpo) {
    const a = await this.#aparelho(sn, ip)
    for (const linha of String(corpo ?? '').split(/\r?\n/).filter(Boolean)) {
      const p = new URLSearchParams(linha.trim())
      const id = Number(p.get('ID'))
      if (!Number.isInteger(id)) continue
      const ok = Number(p.get('Return')) >= 0
      await this.bd.comandoPonto.updateMany({ where: { id, aparelhoId: a.id }, data: { estado: ok ? 'feito' : 'erro', resposta: linha.slice(0, 200) } })
    }
    this.#avisar('aparelhos')
    return 'OK'
  }

  // ---------------- a Repartição ----------------

  async horario(u) {
    exigir(u, 'ver')
    const d = await this.bd.definicao.findUnique({ where: { chave: 'ponto.horario' } })
    return { ...HORARIO_PADRAO, ...(d?.valor ?? {}) }
  }

  async definirHorario(u, { entrada, saida, tolerancia }) {
    exigir(u, 'administrar')
    const hora = /^([01]\d|2[0-3]):[0-5]\d$/
    if (!hora.test(entrada ?? '') || !hora.test(saida ?? '')) throw invalido('Horas no formato HH:MM.', 'entrada')
    if (minutos(saida) <= minutos(entrada)) throw invalido('A saída tem de ser depois da entrada.', 'saida')
    const t = Number(tolerancia)
    if (!Number.isInteger(t) || t < 0 || t > 120) throw invalido('A tolerância é de 0 a 120 minutos.', 'tolerancia')
    const valor = { entrada, saida, tolerancia: t }
    await this.bd.definicao.upsert({ where: { chave: 'ponto.horario' }, create: { chave: 'ponto.horario', valor }, update: { valor } })
    await this.auditoria.registar(u, 'definir_horario_ponto', `${entrada}–${saida} (tolerância ${t} min)`)
    this.#avisar()
    return valor
  }

  // o pessoal civil que marca o ponto (sem as domiciliares, que não são trabalhadores da Escola)
  async #civis(dataRef) {
    const l = await this.bd.pessoa.findMany({
      where: { tipo: 'civil', NOT: { vinculo: 'domiciliar' }, OR: [{ ativo: true }, ...(dataRef ? [{ marcacoes: { some: { quando: { gte: inicioDoDia(dataRef) } } } }] : [])] },
      select: { id: true, nome: true, fotoId: true, carreiraCivil: true, categoriaCivil: true, numeroAgente: true, unidade: { select: { nome: true } }, digitais: { select: { dedo: true } } },
    })
    const ordem = (p) => CARREIRAS_CIVIS[p.carreiraCivil]?.nivel ?? 99
    return l.sort((x, y) => ordem(x) - ordem(y) || x.nome.localeCompare(y.nome, 'pt'))
  }

  // licenças e faltas que tocam o período [de, ate] (datas AAAA-MM-DD): { pessoaId: [{ de, ate, tipo }] }
  async #ausentes(ids, de, ate) {
    const d0 = new Date(`${de}T00:00:00Z`)
    const d1 = new Date(`${ate}T00:00:00Z`)
    const [lic, aus] = await Promise.all([
      this.bd.licenca.findMany({ where: { pessoaId: { in: ids }, inicio: { lte: d1 }, fim: { gte: d0 } }, select: { pessoaId: true, inicio: true, fim: true } }),
      this.bd.ausencia.findMany({ where: { pessoaId: { in: ids }, inicio: { lte: d1 }, OR: [{ fim: null }, { fim: { gte: d0 } }] }, select: { pessoaId: true, inicio: true, fim: true, tipo: true } }),
    ])
    const r = {}
    for (const x of lic) (r[x.pessoaId] ??= []).push({ de: x.inicio.toISOString().slice(0, 10), ate: x.fim.toISOString().slice(0, 10), tipo: 'licenca' })
    for (const x of aus) (r[x.pessoaId] ??= []).push({ de: x.inicio.toISOString().slice(0, 10), ate: x.fim ? x.fim.toISOString().slice(0, 10) : '9999-12-31', tipo: x.tipo === 'falta' || x.tipo === 'sem_justificacao' ? 'falta' : 'licenca' })
    return r
  }

  #resumoDia(marcacoes, h) {
    const dia = ordenarDia(marcacoes)
    const entrada = dia[0] ? horaLuanda(dia[0].quando) : null
    const ultima = dia.length > 1 && dia.length % 2 === 0 ? dia[dia.length - 1] : null
    const saida = ultima ? horaLuanda(ultima.quando) : null
    let ms = 0
    for (let i = 0; i + 1 < dia.length; i += 2) ms += dia[i + 1].quando - dia[i].quando
    const atraso = entrada && minutos(entrada) > minutos(h.entrada) + h.tolerancia ? minutos(entrada) - minutos(h.entrada) : 0
    const saidaAntecipada = saida && minutos(saida) < minutos(h.saida) ? minutos(h.saida) - minutos(saida) : 0
    return { dia, entrada, saida, minutosTrabalho: Math.round(ms / 60_000), atraso, saidaAntecipada }
  }

  // o livro de um dia: cada civil com as marcações, a entrada, a saída, o atraso e o estado
  async livro(u, { data } = {}) {
    exigir(u, 'ver')
    const d = data || hojeLuanda(this.agora())
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw invalido('Data inválida.', 'data')
    const h = await this.horario(u)
    const pessoas = await this.#civis(d)
    const ini = inicioDoDia(d)
    const fim = new Date(ini.getTime() + 86_400_000)
    const [marcs, ausentes, aparelhos] = await Promise.all([
      this.bd.marcacao.findMany({ where: { pessoaId: { in: pessoas.map((p) => p.id) }, quando: { gte: ini, lt: fim } }, include: { aparelho: { select: { nome: true } } } }),
      this.#ausentes(pessoas.map((p) => p.id), d, d),
      this.bd.aparelhoPonto.findMany({ where: { aprovado: true }, select: { ultimoContacto: true } }),
    ])
    const porPessoa = {}
    for (const m of marcs) (porPessoa[m.pessoaId] ??= []).push(m)
    const descanso = [0, 6].includes(diaDaSemana(d))
    const linhas = pessoas.map((p) => {
      const r = this.#resumoDia(porPessoa[p.id] ?? [], h)
      const ausente = (ausentes[p.id] ?? []).find((x) => x.de <= d && x.ate >= d)
      const estado = r.dia.length ? (r.dia.length % 2 ? 'dentro' : 'saiu') : ausente ? ausente.tipo : descanso ? 'descanso' : 'sem_marcacao'
      return {
        id: p.id, nome: p.nome, fotoId: p.fotoId, numeroAgente: p.numeroAgente, numeroAparelho: p.id,
        categoria: p.categoriaCivil || CARREIRAS_CIVIS[p.carreiraCivil]?.nome || '', unidadeNome: p.unidade?.nome ?? '',
        digitais: new Set(p.digitais.map((x) => x.dedo)).size, estado, entrada: r.entrada, saida: r.saida,
        minutosTrabalho: r.minutosTrabalho, atraso: r.atraso, saidaAntecipada: r.saidaAntecipada,
        marcacoes: r.dia.map((m) => ({ id: m.id, hora: horaLuanda(m.quando), tipo: m.tipo, origem: m.origem, verificacao: m.verificacao, aparelho: m.aparelho?.nome ?? '', justificacao: m.justificacao, criadoPor: m.criadoPor })),
      }
    })
    // quem marcou primeiro, pela hora de entrada; os outros pela ordem das carreiras
    linhas.sort((x, y) => (x.entrada ? 0 : 1) - (y.entrada ? 0 : 1) || (x.entrada && y.entrada ? x.entrada.localeCompare(y.entrada) : 0))
    const ligado = (a) => a.ultimoContacto && this.agora() - a.ultimoContacto < 5 * 60_000
    return {
      data: d, hoje: hojeLuanda(this.agora()), horario: h, descanso,
      aparelhos: { aprovados: aparelhos.length, ligados: aparelhos.filter(ligado).length },
      resumo: {
        total: linhas.length,
        dentro: linhas.filter((l) => l.estado === 'dentro').length,
        vieram: linhas.filter((l) => l.marcacoes.length).length,
        atrasos: linhas.filter((l) => l.atraso).length,
        semMarcacao: linhas.filter((l) => l.estado === 'sem_marcacao').length,
        ausentes: linhas.filter((l) => l.estado === 'licenca' || l.estado === 'falta').length,
      },
      pessoas: linhas,
    }
  }

  // o mês de cada civil: dias com marcação, atrasos, horas e dias úteis sem marcação (nem licença nem falta)
  async mes(u, { mes }) {
    exigir(u, 'ver')
    if (!/^\d{4}-\d{2}$/.test(String(mes ?? ''))) throw invalido('Indique o mês (AAAA-MM).', 'mes')
    const [a, m] = mes.split('-').map(Number)
    const nDias = new Date(Date.UTC(a, m, 0)).getUTCDate()
    const de = `${mes}-01`
    const ate = `${mes}-${doisDig(nDias)}`
    const hoje = hojeLuanda(this.agora())
    const h = await this.horario(u)
    const pessoas = await this.#civis(de)
    const ids = pessoas.map((p) => p.id)
    const [marcs, ausentes] = await Promise.all([
      this.bd.marcacao.findMany({ where: { pessoaId: { in: ids }, quando: { gte: inicioDoDia(de), lt: new Date(inicioDoDia(ate).getTime() + 86_400_000) } }, select: { pessoaId: true, quando: true } }),
      this.#ausentes(ids, de, ate),
    ])
    const porDia = {}
    for (const x of marcs) {
      const dia = new Date(x.quando.getTime() + 3_600_000).toISOString().slice(0, 10)
      ;((porDia[x.pessoaId] ??= {})[dia] ??= []).push(x)
    }
    const uteis = Array.from({ length: nDias }, (_, i) => `${mes}-${doisDig(i + 1)}`).filter((d) => ![0, 6].includes(diaDaSemana(d)) && d <= hoje)
    return {
      mes, horario: h, diasUteis: uteis.length,
      pessoas: pessoas.map((p) => {
        const dias = porDia[p.id] ?? {}
        const r = Object.values(dias).map((l) => this.#resumoDia(l, h))
        const aus = ausentes[p.id] ?? []
        return {
          id: p.id, nome: p.nome, categoria: p.categoriaCivil || CARREIRAS_CIVIS[p.carreiraCivil]?.nome || '', unidadeNome: p.unidade?.nome ?? '',
          diasPresente: Object.keys(dias).length, atrasos: r.filter((x) => x.atraso).length, minutosAtraso: r.reduce((s, x) => s + x.atraso, 0),
          horas: Math.round(r.reduce((s, x) => s + x.minutosTrabalho, 0) / 6) / 10,
          semMarcacao: uteis.filter((d) => !dias[d] && !aus.some((x) => x.de <= d && x.ate >= d)).length,
          ausencias: uteis.filter((d) => !dias[d] && aus.some((x) => x.de <= d && x.ate >= d)).length,
        }
      }),
    }
  }

  // marcação feita na Repartição (o aparelho avariado, o dedo que não lê…): sempre com justificação
  async marcarManual(u, { pessoaId, data, hora, justificacao }) {
    exigir(u, 'editar')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data ?? '') || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora ?? '')) throw invalido('Indique o dia e a hora.', 'hora')
    const j = String(justificacao ?? '').trim()
    if (j.length < 5) throw invalido('Escreva a justificação (porque não marcou no aparelho).', 'justificacao')
    const p = await this.bd.pessoa.findUnique({ where: { id: Number(pessoaId) }, select: { id: true, nome: true, tipo: true } })
    if (!p) throw naoEncontrado('Ficha não encontrada.')
    const quando = new Date(`${data}T${hora}:00${FUSO}`)
    if (quando > this.agora()) throw invalido('Não se marca o ponto no futuro.', 'hora')
    const m = await this.bd.marcacao.upsert({
      where: { pessoaId_quando: { pessoaId: p.id, quando } },
      create: { pessoaId: p.id, quando, origem: 'manual', verificacao: 'manual', justificacao: j.slice(0, 300), criadoPor: u.email },
      update: {},
    })
    await this.auditoria.registar(u, 'marcar_ponto_manual', `${p.nome}: ${data} ${hora} — ${j.slice(0, 120)}`)
    this.#avisar()
    return { id: m.id }
  }

  // só as manuais se apagam (as do aparelho são a prova)
  async apagarMarcacao(u, id) {
    exigir(u, 'administrar')
    const m = await this.bd.marcacao.findUnique({ where: { id: Number(id) }, include: { pessoa: { select: { nome: true } } } })
    if (!m) throw naoEncontrado('Marcação não encontrada.')
    if (m.origem !== 'manual') throw invalido('As marcações do aparelho não se apagam.')
    await this.bd.marcacao.delete({ where: { id: m.id } })
    await this.auditoria.registar(u, 'apagar_marcacao_ponto', `${m.pessoa.nome}: ${m.quando.toISOString()}`)
    this.#avisar()
    return { ok: true }
  }

  // fecha o dia: falta a quem não marcou (nem está de licença ou com falta já registada)
  async faltasDoDia(u, { data }) {
    exigir(u, 'editar')
    const l = await this.livro(u, { data })
    if (l.data >= l.hoje) throw invalido('Só se fecha um dia que já acabou.', 'data')
    if (l.descanso) throw invalido('É fim de semana.', 'data')
    const sem = l.pessoas.filter((p) => p.estado === 'sem_marcacao')
    for (const p of sem) await this.ausencias.marcarFalta(u, { pessoaId: p.id, data: l.data, falta: true })
    this.#avisar()
    return { faltas: sem.length }
  }

  // ---------------- os aparelhos ----------------

  async aparelhos(u) {
    exigir(u, 'ver')
    const l = await this.bd.aparelhoPonto.findMany({ orderBy: [{ aprovado: 'asc' }, { nome: 'asc' }], include: { _count: { select: { marcacoes: true, digitais: true } }, comandos: { where: { estado: { in: ['pendente', 'enviado'] } }, select: { id: true } } } })
    const ligado = (a) => Boolean(a.ultimoContacto && this.agora() - a.ultimoContacto < 5 * 60_000)
    return l.map((a) => ({
      id: a.id, numeroSerie: a.numeroSerie, nome: a.nome, local: a.local, aprovado: a.aprovado, modelo: a.modelo, ip: a.ip,
      ultimoContacto: a.ultimoContacto, ligado: ligado(a), marcacoes: a._count.marcacoes, digitais: a._count.digitais, ordensPendentes: a.comandos.length,
    }))
  }

  async editarAparelho(u, id, { nome, local, aprovado }) {
    exigir(u, 'administrar')
    const a = await this.bd.aparelhoPonto.findUnique({ where: { id: Number(id) } })
    if (!a) throw naoEncontrado('Aparelho não encontrado.')
    const g = await this.bd.aparelhoPonto.update({ where: { id: a.id }, data: { ...(nome !== undefined ? { nome: String(nome).trim().slice(0, 80) } : {}), ...(local !== undefined ? { local: String(local).trim().slice(0, 120) } : {}), ...(aprovado !== undefined ? { aprovado: Boolean(aprovado) } : {}) } })
    if (aprovado !== undefined && Boolean(aprovado) !== a.aprovado) {
      await this.auditoria.registar(u, aprovado ? 'aprovar_aparelho_ponto' : 'suspender_aparelho_ponto', `${g.nome} (${g.numeroSerie})`)
      // aprovado: recebe logo a lista do pessoal civil, para se poderem registar as digitais
      if (aprovado) await this.#enviarPessoal(g.id)
    } else await this.auditoria.registar(u, 'editar_aparelho_ponto', `${g.nome} (${g.numeroSerie})`)
    this.#avisar('aparelhos')
    return g
  }

  async apagarAparelho(u, id) {
    exigir(u, 'administrar')
    const a = await this.bd.aparelhoPonto.findUnique({ where: { id: Number(id) } })
    if (!a) throw naoEncontrado('Aparelho não encontrado.')
    await this.bd.aparelhoPonto.delete({ where: { id: a.id } })
    await this.auditoria.registar(u, 'apagar_aparelho_ponto', `${a.nome} (${a.numeroSerie}); as marcações ficam`)
    this.#avisar('aparelhos')
    return { ok: true }
  }

  // a lista do pessoal civil no aparelho (número = n.º da ficha); quem saiu deixa de estar no aparelho
  async #enviarPessoal(aparelhoId) {
    const ativos = await this.bd.pessoa.findMany({ where: { tipo: 'civil', ativo: true, NOT: { vinculo: 'domiciliar' } }, select: { id: true, nome: true } })
    const sairam = await this.bd.digitalPonto.findMany({ where: { aparelhoId, pessoa: { ativo: false } }, select: { pessoaId: true }, distinct: ['pessoaId'] })
    const textos = [
      ...ativos.map((p) => `DATA UPDATE USERINFO PIN=${p.id}\tName=${nomeAparelho(p.nome)}\tPri=0\tPasswd=\tCard=\tGrp=1\tTZ=0000000100000000\tVerify=0`),
      ...sairam.map((p) => `DATA DELETE USERINFO PIN=${p.pessoaId}`),
    ]
    await this.bd.comandoPonto.deleteMany({ where: { aparelhoId, estado: 'pendente', texto: { startsWith: 'DATA ' } } })
    if (textos.length) await this.bd.comandoPonto.createMany({ data: textos.map((texto) => ({ aparelhoId, texto })) })
    if (sairam.length) await this.bd.digitalPonto.deleteMany({ where: { aparelhoId, pessoaId: { in: sairam.map((p) => p.pessoaId) } } })
    return { pessoas: ativos.length, removidas: sairam.length }
  }

  async enviarPessoal(u, id) {
    exigir(u, 'editar')
    const a = await this.bd.aparelhoPonto.findUnique({ where: { id: Number(id) } })
    if (!a) throw naoEncontrado('Aparelho não encontrado.')
    if (!a.aprovado) throw invalido('Aprove primeiro o aparelho.')
    const r = await this.#enviarPessoal(a.id)
    await this.auditoria.registar(u, 'enviar_pessoal_aparelho', `${a.nome}: ${r.pessoas} pessoa(s)`)
    this.#avisar('aparelhos')
    return r
  }

  // pede ao aparelho que registe a digital de uma pessoa (a pessoa põe o dedo no aparelho; nem todos os modelos aceitam)
  async registarDigital(u, id, { pessoaId, dedo = 0 }) {
    exigir(u, 'editar')
    const a = await this.bd.aparelhoPonto.findUnique({ where: { id: Number(id) } })
    if (!a?.aprovado) throw invalido('Escolha um aparelho aprovado.')
    const p = await this.bd.pessoa.findUnique({ where: { id: Number(pessoaId) }, select: { id: true, nome: true } })
    if (!p) throw naoEncontrado('Ficha não encontrada.')
    const d = Number(dedo)
    if (!Number.isInteger(d) || d < 0 || d > 9) throw invalido('O dedo é de 0 a 9.', 'dedo')
    await this.bd.comandoPonto.createMany({ data: [
      { aparelhoId: a.id, texto: `DATA UPDATE USERINFO PIN=${p.id}\tName=${nomeAparelho(p.nome)}\tPri=0\tPasswd=\tCard=\tGrp=1\tTZ=0000000100000000\tVerify=0` },
      { aparelhoId: a.id, texto: `ENROLL_FP PIN=${p.id}\tFID=${d}\tRETRY=3\tOVERWRITE=1` },
    ] })
    await this.auditoria.registar(u, 'pedir_registo_digital', `${p.nome} no aparelho ${a.nome}`)
    this.#avisar('aparelhos')
    return { ok: true }
  }
}
