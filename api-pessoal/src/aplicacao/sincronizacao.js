import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { nomeDoPosto } from '../dominio/pessoal/hierarquia.js'
import { exigir, unidadesDe } from './sessao.js'

// o posto das FAA equivalente ao posto da Polícia Nacional ou da força estrangeira (só para ordenar as listas)
const simples = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
function postoEquivalente(p) {
  const lista = simples(p.unidadeOrigem) === simples(POLICIA_NACIONAL) ? POSTOS_POLICIA : forcaPorNome(p.unidadeOrigem)?.postos ?? []
  const x = lista.find((y) => simples(y.nome) === simples(p.postoExterno))
  return x ? nomeDoPosto(x.equivale) : ''
}
import { BI_ANGOLANO, HABILITACOES, origemDe } from '../dominio/pessoal/ficha.js'
import { POLICIA_NACIONAL, POSTOS_POLICIA, forcaPorNome } from '../dominio/pessoal/forcas.js'
import { invalido } from '../erros.js'
import { emailDeAcesso } from '../dominio/pessoal/emailAcesso.js'

// os cargos de chefia militar da Direcção de Ensino que têm conta automática no painel de gestão (entram com o NIP)
const CHEFES_ENSINO = [
  [/^Director (da Direc[çc][ãa]o )?de Ensino\b/i, 'director_ensino'],
  [/^Chefe da Reparti[çc][ãa]o de Administra[çc][ãa]o Escolar\b/i, 'secretaria'],
]
// quem não trabalha com os dados do Ensino (o motorista, o ajudante de campo…) não leva conta no painel
const APOIO_PESSOAL = /^(Motorista|Condutor|Ajudante de Campo|Estafeta|Mensageiro|Servente|Guarda|Sentinela)\b/i
/*
  O papel no painel de gestão de quem trabalha na Direcção de Ensino, pela unidade (e pelo cargo):
  - o Director de Ensino: director_ensino;
  - a Repartição de Administração Escolar: secretaria (gere turmas, matrículas, cadeiras, pautas…);
  - os departamentos e as secções de estudos (a Área Científica): os chefes (Chefe…, Professor-Chefe…) — area_cientifica;
    os outros professores usam o Portal Académico como docentes;
  - o resto (órgãos de apoio de direcção, planeamento e coordenação, secretaria de ensino…): gabinete_ensino.
  A Biblioteca tem o seu sistema. cadeia: os nomes da unidade e das de cima (da mais próxima para a Direcção).
*/
export function papelNoEnsino(p, cadeia) {
  const cargo = p.cargo?.nome ?? ''
  const chefe = CHEFES_ENSINO.find(([re]) => re.test(cargo))?.[1]
  if (chefe) return chefe
  if (APOIO_PESSOAL.test(cargo)) return null
  const em = (re) => cadeia.some((n) => re.test(n))
  if (em(/^Biblioteca\b/i)) return null
  if (em(/^Reparti[çc][ãa]o de Administra[çc][ãa]o Escolar\b/i)) return 'secretaria'
  if (em(/^(Departamento|Sec[çc][ãa]o de Estudos)\b/i)) return p.tipo === 'civil' || /^(Chefe|Professor-Chefe)\b/i.test(cargo) ? 'area_cientifica' : null
  // militares só com cargo atribuído; os civis do Ensino (que já tinham conta) ficam no Gabinete
  return p.tipo === 'civil' || cargo ? 'gabinete_ensino' : null
}
import { calcularAssinantes } from './assinantes.js'

// com as fotografias, os lotes são pequenos (cada uma tem ~100 KB)
const LOTE = 50
const MAX_TENTATIVAS = 10
const SEM_LIGACAO = 'Sem ligação ao portal'

// assinatura do pedido: HMAC-SHA256 de "<data>.<corpo>" com a chave partilhada (o portal recusa pedidos com mais de 5 min)
export const assinar = (chave, data, corpo) => crypto.createHmac('sha256', chave).update(`${data}.${corpo}`).digest('hex')

/*
  Envio, num só sentido, dos docentes e estudantes para as contas do Portal Académico. Só sai o necessário
  para a conta (nome, e-mail, posto, ramo, NIP, telefone, unidade — da ESG ou a de origem — e a fotografia, só quando muda); o resto da
  ficha nunca sai daqui.
  Quem deixa de ser docente/estudante ou sai da Escola é enviado como inativo (o portal desativa a conta).
*/
export class ServicoSincronizacao {
  constructor({ bd, auditoria, config, cifra = null, enviar = fetch, agora = () => new Date() }) {
    Object.assign(this, { bd, auditoria, config, cifra, enviar, agora })
  }

  get ativa() {
    return Boolean(this.config.portal.url && this.config.portal.chave)
  }

  // a fotografia, em base64, só se o portal ainda não tiver esta; null = foi apagada no Pessoal
  #foto(p, enviada) {
    if (!p.fotoId) return enviada ? null : undefined
    if (p.fotoId === enviada) return undefined
    try {
      return { id: p.fotoId, dados: fs.readFileSync(path.join(this.config.pastaFotos, path.basename(p.fotoId))).toString('base64') }
    } catch {
      return undefined
    }
  }

  #conteudo(p, contaId, fotoEnviada = '') {
    // o militar que é funcionário e também docente ou aluno tem conta no portal (aluno, se estiver num curso)
    // o docente novo à espera do despacho do Comandante ainda não conta
    const vs = [p.vinculo, ...(p.outrosVinculos ?? [])].filter((v) => !(v === 'docente' && p.docentePendente))
    const ativo = p.ativo && vs.some((v) => ['docente', 'estudante'].includes(v))
    const foto = ativo ? this.#foto(p, fotoEnviada) : undefined
    return {
      ref: `pessoal-${p.id}`, contaId: contaId ?? undefined, tipo: p.vinculo === 'docente' ? 'docente' : vs.includes('estudante') ? 'estudante' : 'docente', nome: p.nome, email: p.email, ativo,
      // o posto (das FAA; ou o da Polícia Nacional / da força estrangeira, com o equivalente das FAA para ordenar),
      // a origem (faa, policia, estrangeiro, civil) e o país dos estrangeiros: para as listas e os documentos do ensino
      dados: {
        posto: p.posto ? nomeDoPosto(p.posto, p.ramo) : p.postoExterno ?? '', postoEquivalente: !p.posto && p.postoExterno ? postoEquivalente(p) : '',
        ramo: p.ramo ?? '', nip: p.nip || p.numeroAgente || '', telefone: p.telefone ?? '', departamento: p.unidade?.nome || p.unidadeOrigem || '',
        origem: origemDe(p), pais: origemDe(p) === 'estrangeiro' ? p.paisNascimento || p.nacionalidade || '' : '',
        // para a ficha académica na Administração Escolar (sem BI, morada, família nem vencimentos)
        genero: p.genero ?? '', dataNascimento: p.dataNascimento ? new Date(p.dataNascimento).toISOString().slice(0, 10) : '', naturalidade: p.naturalidade ?? '', provincia: p.provincia ?? '',
        nacionalidade: p.nacionalidade ?? '', habilitacao: HABILITACOES[p.habilitacao] ?? '', areaFormacao: (p.areaFormacao ?? '').slice(0, 120), funcaoActual: (p.funcaoActual ?? '').slice(0, 120),
        especialidade: p.especialidade ?? '', tipoDocente: p.tipoDocente ?? '', categoriaDocente: p.categoriaDocente ?? '',
      },
      ...(foto !== undefined ? { foto } : {}),
      // os cursos de cada ano lectivo do estudante (as listas de cada ano): a Gestão Escolar matricula-o logo na turma
      ...(vs.includes('estudante') && p.anosAcademicos?.length ? { anos: p.anosAcademicos.filter((a) => a.curso).map((a) => ({ anoLetivo: a.anoLetivo, curso: a.curso.slice(0, 250), concluido: a.concluido ?? null })) } : {}),
    }
  }

  async estado(u) {
    exigir(u, 'ver')
    const grupos = await this.bd.sincronizacao.groupBy({ by: ['estado'], _count: true })
    const erros = await this.bd.sincronizacao.findMany({ where: { estado: 'erro' }, include: { pessoa: { select: { nome: true, email: true } } }, take: 50, orderBy: { ultimaTentativa: 'desc' } })
    return { ativa: this.ativa, portal: this.config.portal.url, contagem: Object.fromEntries(grupos.map((g) => [g.estado, g._count])), erros: erros.map((e) => ({ pessoaId: e.pessoaId, nome: e.pessoa.nome, email: e.pessoa.email, erro: e.erro, tentativas: e.tentativas, quando: e.ultimaTentativa })) }
  }

  // volta a pôr na fila todos os docentes e estudantes (ex.: depois de ligar o portal pela primeira vez)
  async reenviarTodos(u) {
    exigir(u, 'administrar')
    const ids = (await this.bd.pessoa.findMany({ where: { OR: [{ vinculo: { in: ['docente', 'estudante'] } }, { outrosVinculos: { hasSome: ['docente', 'estudante'] } }] }, select: { id: true } })).map((p) => p.id)
    for (const id of ids) await this.bd.sincronizacao.upsert({ where: { pessoaId: id }, create: { pessoaId: id }, update: { estado: 'pendente', tentativas: 0, erro: '' } })
    await this.auditoria.registar(u, 'reenviar_portal', `${ids.length} pessoa(s)`)
    return { emFila: ids.length }
  }

  /*
    E-mails de acesso à plataforma: os docentes e os estudantes (também os antigos, para o arquivo) que ainda não
    têm e-mail da Escola ficam com nome.apelido@DOMINIO (PORTAL_EMAIL_DOMINIO) e vão para a fila do portal, que
    lhes cria a conta (a dos antigos estudantes fica inactiva: guarda o histórico). Os e-mails que já existem não
    mudam. simular: mostra os que criaria.
  */
  async criarEmailsAcesso(u, { simular = true, pessoaIds } = {}) {
    exigir(u, 'editar')
    const dominio = this.config.portal.dominioEmail
    const usados = new Set((await this.bd.pessoa.findMany({ where: { email: { not: null } }, select: { email: true } })).map((p) => p.email.toLowerCase()))
    const sem = await this.bd.pessoa.findMany({
      where: { email: null, vinculo: { not: 'domiciliar' }, OR: [{ vinculo: { in: ['docente', 'estudante'] } }, { outrosVinculos: { hasSome: ['docente', 'estudante'] } }], ...(pessoaIds?.length ? { id: { in: pessoaIds } } : {}) },
      select: { id: true, nome: true, ativo: true }, orderBy: { nome: 'asc' },
    })
    const novos = []
    for (const p of sem) {
      const email = emailDeAcesso(p.nome, dominio, usados)
      if (!email) continue
      usados.add(email)
      novos.push({ id: p.id, nome: p.nome, email, ativo: p.ativo })
    }
    if (!simular && novos.length) {
      for (const n of novos) {
        await this.bd.$transaction([
          this.bd.pessoa.update({ where: { id: n.id }, data: { email: n.email } }),
          this.bd.sincronizacao.upsert({ where: { pessoaId: n.id }, create: { pessoaId: n.id }, update: { estado: 'pendente', tentativas: 0, erro: '' } }),
        ])
      }
      await this.auditoria.registar(u, 'emails_acesso_portal', `${novos.length} e-mail(s) de acesso (@${dominio})`)
      this.agendar()
    }
    return { dominio, simulado: Boolean(simular), total: novos.length, naEscola: novos.filter((n) => n.ativo).length, exemplos: novos.slice(0, 200) }
  }

  // depois de uma alteração, envia daí a poucos segundos (junta várias alterações seguidas num só pedido)
  agendar(ms = 3000) {
    if (!this.ativa || this.temporizador) return
    this.temporizador = setTimeout(() => {
      this.temporizador = null
      this.enviarPendentes().catch(() => {})
    }, ms)
    this.temporizador.unref?.()
  }

  // envia o que está pendente (corre de minuto a minuto e também a pedido)
  /*
    Quem assina os diplomas e certificados no portal: quem ocupa hoje os cargos (Comandante, Director de
    Ensino, Chefe da RPQ). Vai com cada envio, só quando muda (uma pessoa nomeada, exonerada ou de licença).
  */
  /*
    O que espera pelo Comandante no portal e no site (só os números), para a Secretária digital: decide-se no painel
    de gestão. Sem ligação ao portal, diz porquê.
  */
  async pendentesComandante(u) {
    exigir(u, 'despachar')
    if (!this.ativa) return { ligado: false }
    const corpo = '{}'
    const data = String(Math.floor(this.agora().getTime() / 1000))
    try {
      const r = await this.enviar(`${this.config.portal.url}/api/integracao/pessoal/pendentes-comandante`, {
        method: 'POST', body: corpo, signal: AbortSignal.timeout(8_000),
        headers: { 'Content-Type': 'application/json', 'X-Pessoal-Data': data, 'X-Pessoal-Assinatura': assinar(this.config.portal.chave, data, corpo) },
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) return { ligado: true, erro: j.erro || `O portal respondeu ${r.status}.` }
      return { ligado: true, ...j }
    } catch (e) {
      return { ligado: true, erro: `Sem ligação ao portal: ${e.message}` }
    }
  }

  /*
    Conta única do Comandante: a conta de Comandante daqui vale também no painel de gestão, com o mesmo e-mail e a
    mesma palavra-passe (vai já cifrada; nunca em claro). Vai quando muda (nome, e-mail, palavra-passe, activa ou não).
    Entra no painel com o e-mail ou com o NIP; enquanto tem de mudar a palavra-passe (no Pessoal), ainda não entra no
    painel (a do painel fica a que era).
  */
  async enviarComandante() {
    if (!this.ativa) return { enviado: false, inativa: true }
    const l = await this.bd.utilizador.findMany({ where: { papel: 'comandante', ativo: true, aguardaDespacho: false }, select: { nome: true, email: true, senha: true, deveMudar: true, pessoa: { select: { nip: true } } }, orderBy: { id: 'asc' } })
    // entra no painel com o e-mail ou com o NIP (vai só a impressão do NIP; sem e-mail verdadeiro, um endereço interno
    // feito da impressão, para o NIP não ir em claro)
    const contas = l.map((u) => {
      const nip = String(u.pessoa?.nip ?? '').trim().toUpperCase()
      const impressao = /^[0-9]{5,12}$/.test(nip) ? crypto.createHmac('sha256', this.config.portal.chave).update(`nip:${nip}`).digest('hex') : null
      const real = u.email && !u.email.endsWith('@pessoal.interno') ? u.email : null
      if (!real && !impressao) return null
      return { email: real ?? `cmdt-${impressao.slice(0, 16)}@pessoal.interno`, nome: u.nome, ...(impressao ? { nip: impressao } : {}), ...(u.deveMudar ? {} : { senha: u.senha }) }
    }).filter(Boolean)
    const corpo = JSON.stringify({ contas })
    if (corpo === this.ultimoComandante) return { enviado: false, igual: true }
    const data = String(Math.floor(this.agora().getTime() / 1000))
    const r = await this.enviar(`${this.config.portal.url}/api/integracao/pessoal/comandante`, {
      method: 'POST', body: corpo, signal: AbortSignal.timeout(20_000),
      headers: { 'Content-Type': 'application/json', 'X-Pessoal-Data': data, 'X-Pessoal-Assinatura': assinar(this.config.portal.chave, data, corpo) },
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(j.erro || `O portal respondeu ${r.status} à conta do Comandante.`)
    this.ultimoComandante = corpo
    this.resultadoComandante = j.resultados ?? []
    return { enviado: true, resultados: this.resultadoComandante }
  }

  /*
    Os civis da Direcção de Ensino (e das suas secções) têm conta no painel de gestão: vai a ficha (pessoal-<id>), o
    nome, o e-mail se houver, a impressão do BI (HMAC com a chave partilhada; o BI não sai daqui) e a palavra-passe
    inicial (o BI, já cifrado). Os chefes militares (Director de Ensino, Chefe da Repartição de Administração Escolar)
    vão da mesma forma com o NIP e o papel do cargo. Vai quando a lista muda; quem sai da Direcção de Ensino deixa de ir (o painel desactiva).
  */
  async enviarContasEnsino() {
    if (!this.ativa || !this.cifra) return { enviado: false, inativa: true }
    const ids = await unidadesDe(this.bd, /^Direc[çc][ãa]o de Ensino\b/i)
    // os civis (entram com o BI) e os militares com cargo (entram com o NIP); o papel no painel vem da unidade e do
    // cargo (papelNoEnsino)
    const pessoas = ids.length ? await this.bd.pessoa.findMany({ where: { ativo: true, unidadeId: { in: ids }, OR: [{ tipo: 'civil', vinculo: 'funcionario' }, { tipo: 'militar', cargoId: { not: null } }] }, select: { id: true, nome: true, email: true, bi: true, tipo: true, nip: true, unidadeId: true, cargo: { select: { nome: true } } }, orderBy: { id: 'asc' } }) : []
    const unidades = new Map((await this.bd.unidade.findMany({ select: { id: true, nome: true, paiId: true } })).map((x) => [x.id, x]))
    const cadeia = (id) => { const l = []; for (let u = unidades.get(id), k = 0; u && k < 30; u = unidades.get(u.paiId), k++) l.push(u.nome); return l }
    const hmac = (t) => crypto.createHmac('sha256', this.config.portal.chave).update(t).digest('hex')
    const comIdent = pessoas.map((p) => {
      const papel = papelNoEnsino(p, cadeia(p.unidadeId))
      if (!papel) return null
      if (p.tipo === 'civil') {
        const bi = String(p.bi ?? '').trim().toUpperCase()
        return BI_ANGOLANO.test(bi) ? { p, ident: bi, impressao: hmac(`bi:${bi}`), papel } : null
      }
      const nip = String(p.nip ?? '').trim().toUpperCase()
      return papel && /^[0-9]{5,12}$/.test(nip) ? { p, ident: nip, impressao: hmac(`nip:${nip}`), papel } : null
    }).filter(Boolean)
    // o departamento de ensino (a unidade «Departamento de …» onde trabalha) e o cargo: o portal mostra-lhe as cadeiras dele
    const departamentoDe = (id) => cadeia(id).find((n) => /^Departamento\b/i.test(n)) ?? ''
    const contas = comIdent.map(({ p, impressao, papel }) => ({ ref: `pessoal-${p.id}`, nome: p.nome, ...(p.email ? { email: p.email } : {}), bi: impressao, ...(papel ? { papel } : {}), departamento: departamentoDe(p.unidadeId), ...(p.cargo?.nome ? { cargo: p.cargo.nome.slice(0, 200) } : {}) }))
    // só a lista (sem as palavras-passe, que mudam de sal a cada cálculo) decide se volta a ir
    const marca = JSON.stringify(contas)
    if (marca === this.ultimasContasEnsino) return { enviado: false, igual: true }
    const corpo = JSON.stringify({ contas: await Promise.all(contas.map(async (c, i) => ({ ...c, senha: await this.cifra.cifrar(comIdent[i].ident) }))) })
    const data = String(Math.floor(this.agora().getTime() / 1000))
    const r = await this.enviar(`${this.config.portal.url}/api/integracao/pessoal/contas-ensino`, {
      method: 'POST', body: corpo, signal: AbortSignal.timeout(30_000),
      headers: { 'Content-Type': 'application/json', 'X-Pessoal-Data': data, 'X-Pessoal-Assinatura': assinar(this.config.portal.chave, data, corpo) },
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(j.erro || `O portal respondeu ${r.status} às contas da Direcção de Ensino.`)
    this.ultimasContasEnsino = marca
    return { enviado: true, resultados: j.resultados ?? [] }
  }

  async enviarAssinaturas() {
    if (!this.ativa) return { enviado: false, inativa: true }
    const d = await this.bd.definicao.findUnique({ where: { chave: 'assinaturas' } })
    const a = await calcularAssinantes(this.bd, d?.valor ?? {}, this.agora())
    const so = ({ cargo, nome, posto, origem }) => ({ cargo, nome, posto, origem })
    const corpo = JSON.stringify({ assinaturas: { comandante: so(a.comandante), directorEnsino: so(a.directorEnsino), chefeRpq: so(a.chefeRpq), chefeRae: so(a.chefeRae) } })
    if (corpo === this.ultimasAssinaturas) return { enviado: false, igual: true }
    const data = String(Math.floor(this.agora().getTime() / 1000))
    const r = await this.enviar(`${this.config.portal.url}/api/integracao/pessoal/assinaturas`, {
      method: 'POST', body: corpo, signal: AbortSignal.timeout(20_000),
      headers: { 'Content-Type': 'application/json', 'X-Pessoal-Data': data, 'X-Pessoal-Assinatura': assinar(this.config.portal.chave, data, corpo) },
    })
    if (!r.ok) throw new Error(`O portal respondeu ${r.status} às assinaturas.`)
    this.ultimasAssinaturas = corpo
    return { enviado: true }
  }

  /*
    O estado no portal de cada pessoa (para as tabelas dos estudantes e docentes): o envio (pendente, enviado,
    erro) e, se o portal responder, a conta (número, ativa, último acesso, palavra-passe inicial).
    Sem ligação ao portal, vem só o estado do envio.
  */
  async estadoNoPortal(pessoaIds) {
    const sinc = await this.bd.sincronizacao.findMany({ where: { pessoaId: { in: pessoaIds } } })
    const contas = new Map()
    const ids = sinc.map((x) => x.contaPortalId).filter(Boolean)
    if (this.ativa && ids.length) {
      try {
        const corpo = JSON.stringify({ ids })
        const data = String(Math.floor(this.agora().getTime() / 1000))
        const r = await this.enviar(`${this.config.portal.url}/api/integracao/pessoal/estado-contas`, {
          method: 'POST', body: corpo, signal: AbortSignal.timeout(8_000),
          headers: { 'Content-Type': 'application/json', 'X-Pessoal-Data': data, 'X-Pessoal-Assinatura': assinar(this.config.portal.chave, data, corpo) },
        })
        if (r.ok) for (const c of await r.json()) contas.set(c.id, c)
      } catch { /* sem ligação: fica só o estado do envio */ }
    }
    return new Map(sinc.map((x) => [x.pessoaId, { envio: x.estado, erro: x.erro, conta: x.contaPortalId ? contas.get(x.contaPortalId) ?? { id: x.contaPortalId } : null }]))
  }

  // fichas de acesso de várias pessoas de uma vez (ex.: uma turma nova); as que falham vêm com o motivo
  async fichasAcesso(u, ids) {
    exigir(u, 'editar')
    const fichas = []
    const erros = []
    for (const id of ids.slice(0, 500)) {
      try {
        fichas.push(await this.fichaAcesso(u, id))
      } catch (e) {
        const p = await this.bd.pessoa.findUnique({ where: { id }, select: { nome: true } })
        erros.push({ id, nome: p?.nome ?? `#${id}`, erro: e.message })
      }
    }
    return { fichas, erros }
  }

  /*
    Ficha de acesso ao portal pedida aqui (a Repartição regista e entrega no mesmo sítio): o portal dá uma
    palavra-passe inicial nova, que vem só na resposta para se imprimir (não fica guardada no Pessoal).
  */
  async fichaAcesso(u, pessoaId) {
    exigir(u, 'editar')
    if (!this.ativa) throw invalido('O Pessoal não está ligado ao Portal Académico.')
    const s = await this.bd.sincronizacao.findUnique({ where: { pessoaId }, include: { pessoa: { select: { nome: true } } } })
    if (!s?.contaPortalId) throw invalido('Esta pessoa ainda não tem conta no portal (é docente ou estudante, com e-mail? espere o envio e tente de novo).')
    const corpo = JSON.stringify({ contaId: s.contaPortalId, pedidoPor: u.nome || u.email || '' })
    const data = String(Math.floor(this.agora().getTime() / 1000))
    let r
    try {
      r = await this.enviar(`${this.config.portal.url}/api/integracao/pessoal/ficha-acesso`, {
        method: 'POST', body: corpo, signal: AbortSignal.timeout(15_000),
        headers: { 'Content-Type': 'application/json', 'X-Pessoal-Data': data, 'X-Pessoal-Assinatura': assinar(this.config.portal.chave, data, corpo) },
      })
    } catch (e) {
      throw invalido(`Sem ligação ao portal: ${e.message}`)
    }
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw invalido(j.erro || `O portal respondeu ${r.status}.`)
    await this.auditoria.registar(u, 'ficha_acesso_portal', `${s.pessoa.nome} (${j.numero})`)
    return { nome: j.nome, numero: j.numero, email: j.email, senhaInicial: j.senhaInicial, portal: j.portal || '' }
  }

  /*
    O destino dos envios mudou (ex.: do servidor de testes para a Gestão Escolar da Escola, que começa vazia): todos
    os docentes e estudantes voltam a ir, com a fotografia, e sem o número da conta do destino antigo (lá, o mesmo
    número pode ser de outra pessoa). Não se apaga nem se muda nenhuma ficha: só a fila de envio.
  */
  async #confirmarDestino() {
    const url = this.config.portal.url
    if (this.destinoConfirmado === url) return
    const d = await this.bd.definicao.findUnique({ where: { chave: 'portal-destino' } })
    if ((d?.valor?.url ?? null) !== url) {
      const ids = (await this.bd.pessoa.findMany({ where: { OR: [{ vinculo: { in: ['docente', 'estudante'] } }, { outrosVinculos: { hasSome: ['docente', 'estudante'] } }] }, select: { id: true } })).map((p) => p.id)
      for (const id of ids) await this.bd.sincronizacao.upsert({ where: { pessoaId: id }, create: { pessoaId: id }, update: {} })
      const n = await this.bd.sincronizacao.updateMany({ data: { estado: 'pendente', tentativas: 0, erro: '', contaPortalId: null, fotoEnviada: '' } })
      await this.bd.definicao.upsert({ where: { chave: 'portal-destino' }, create: { chave: 'portal-destino', valor: { url, desde: this.agora().toISOString() } }, update: { valor: { url, desde: this.agora().toISOString() } } })
      console.log(`Envio para ${url}: destino novo — ${n.count} docente(s) e estudante(s) voltam a ir, com a fotografia.`)
    }
    this.destinoConfirmado = url
  }

  async enviarPendentes() {
    if (!this.ativa) return { enviados: 0, erros: 0, inativa: true }
    await this.#confirmarDestino()
    await this.enviarAssinaturas().catch(() => {})
    await this.enviarComandante().catch(() => {})
    await this.enviarContasEnsino().catch(() => {})
    // as que falharam só por falta de ligação voltam sempre a ir (quando a Gestão Escolar voltar, seguem sozinhas)
    const fila = await this.bd.sincronizacao.findMany({ where: { OR: [{ estado: 'pendente' }, { estado: 'erro', tentativas: { lt: MAX_TENTATIVAS } }, { estado: 'erro', erro: { startsWith: SEM_LIGACAO } }] }, include: { pessoa: { include: { unidade: { select: { nome: true } }, anosAcademicos: { where: { papel: 'estudante' }, select: { anoLetivo: true, curso: true, concluido: true }, orderBy: { anoLetivo: 'desc' }, take: 30 } } } }, take: LOTE, orderBy: { pessoaId: 'asc' } })
    if (!fila.length) return { enviados: 0, erros: 0 }
    const corpo = JSON.stringify({ pessoas: fila.map((s) => this.#conteudo(s.pessoa, s.contaPortalId, s.fotoEnviada)) })
    const data = String(Math.floor(this.agora().getTime() / 1000))
    let resultados
    try {
      const r = await this.enviar(`${this.config.portal.url}/api/integracao/pessoal/contas`, {
        method: 'POST', body: corpo, signal: AbortSignal.timeout(20_000),
        headers: { 'Content-Type': 'application/json', 'X-Pessoal-Data': data, 'X-Pessoal-Assinatura': assinar(this.config.portal.chave, data, corpo) },
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.erro || `O portal respondeu ${r.status}.`)
      resultados = new Map((j.resultados || []).map((x) => [x.ref, x]))
    } catch (e) {
      // sem ligação (a Gestão Escolar em baixo ou a actualizar) não conta como tentativa: volta a ir no minuto seguinte
      const erro = `${SEM_LIGACAO}: ${e.message}`.slice(0, 300)
      await this.bd.sincronizacao.updateMany({ where: { pessoaId: { in: fila.map((s) => s.pessoaId) } }, data: { estado: 'erro', erro, ultimaTentativa: this.agora() } })
      return { enviados: 0, erros: fila.length, erro }
    }
    let enviados = 0
    for (const s of fila) {
      const x = resultados.get(`pessoal-${s.pessoaId}`)
      const ok = Boolean(x?.ok)
      if (ok) enviados++
      await this.bd.sincronizacao.update({ where: { pessoaId: s.pessoaId }, data: { estado: ok ? 'enviado' : 'erro', erro: ok ? '' : String(x?.erro || 'O portal não respondeu por esta pessoa.').slice(0, 300), tentativas: ok ? 0 : { increment: 1 }, ultimaTentativa: this.agora(), contaPortalId: x?.contaId ?? s.contaPortalId, ...(ok ? { fotoEnviada: s.pessoa.fotoId ?? '' } : {}) } })
    }
    return { enviados, erros: fila.length - enviados }
  }
}
