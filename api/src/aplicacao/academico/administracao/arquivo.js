import { ErroValidacao } from '../../../dominio/comum/erros.js'
import { MODELOS_PLANO, mencao, NOTA_MINIMA, resultadoCurso, validarPlano } from '../../../dominio/academico/avaliacao/planoCurso.js'
import { noCatalogo } from '../../../dominio/academico/cadeirasCatalogo.js'
import { datasPadrao } from '../../../dominio/academico/anoLetivo.js'
import { emailDeAcesso } from '../../../dominio/academico/pessoas/emailAcesso.js'
import { numeroConta, senhaInicial } from '../../../dominio/academico/pessoas/contas.js'

export const CHAVE_CATALOGO = 'cadeiras-catalogo'
// as listas do corpo docente dos anos anteriores: { '2025/2026': [{ nome da disciplina, docentes }] }
export const CHAVE_CATALOGOS_ANOS = 'cadeiras-catalogo-anos'

/*
  Carga do arquivo da Repartição de Administração Escolar (as pautas finais dos anos anteriores, já assinadas):
  para cada curso de cada ano lectivo, a turma, o plano do curso, as cadeiras, as matrículas, a nota final de
  cada cadeira e o resultado de cada discente tal como está na pauta (média final e classificação), com o
  Conselho do curso homologado — a pauta final, o histórico e os certificados saem como os do arquivo.
  - Os discentes entram pela conta do portal que o Sistema de Pessoal criou (pelo NIP ou n.º de agente); quem
    ainda não tem conta fica na lista para depois (o Pessoal envia-o quando tiver o e-mail de acesso).
  - Nunca mexe no que já está no sistema: uma turma desse curso e ano com matrículas ou notas lançadas fica como
    está; um ano lectivo fechado também (reabre-se por ordem do Comandante). Pode correr-se outra vez: completa
    só o que faltava (quem entretanto ganhou conta).
  - simular: mostra o que faria, sem gravar.
*/
export const TITULO_NOTA_ARQUIVO = 'Nota final (arquivo da Administração Escolar)'
const ORIGEM = 'Arquivo da Administração Escolar'
const ANO = /^\d{4}\/\d{4}$/
const norm = (n) => String(n ?? '').toUpperCase().replace(/\s/g, '').replace(/^I/, '').replace(/^0+/, '')
const nota = (v) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) && n >= 0 && n <= 20 ? Math.round(n * 100) / 100 : null
}
const txt = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
// sigla de um bloco a partir do nome («Administração» → ADM; «Op. Conjuntas» → OPC)
// o mesmo nome, com as diferenças de grafia das listas («Franklin»/«Franklim», «Soma Kesenje»/«Somakesenje»,
// «J.»/«Januário»): pelo menos duas palavras parecidas (ou uma, num nome de uma palavra), ou o nome junto quase igual
function distancia(a, b) {
  const d = Array.from({ length: b.length + 1 }, (_, k) => k)
  for (let i = 1; i <= a.length; i++) {
    let antes = d[0]
    d[0] = i
    for (let k = 1; k <= b.length; k++) { const t = d[k]; d[k] = Math.min(d[k] + 1, d[k - 1] + 1, antes + (a[i - 1] === b[k - 1] ? 0 : 1)); antes = t }
  }
  return d[b.length]
}
function mesmoNome(a, b) {
  const p = (n) => String(n ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2 && !['dos', 'das'].includes(w))
  const x = p(a)
  const y = p(b)
  const parecida = (w, v) => w === v || (w.length >= 4 && v.length >= 4 && distancia(w, v) <= (Math.min(w.length, v.length) >= 7 ? 2 : 1))
  const comuns = x.filter((w) => y.some((v) => parecida(w, v))).length
  const junto = (l) => l.join('')
  return comuns >= Math.min(2, x.length, y.length) || distancia(junto(x), junto(y)) <= Math.max(2, Math.round(junto(x).length * 0.12))
}

const siglaBloco = (nome, usadas) => {
  const base = txt(nome, 60).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z ]/g, ' ').trim()
  const palavras = base.split(/\s+/).filter((w) => w.length > 2)
  let s = (palavras.length > 1 ? palavras.map((w) => w[0]).join('') : base.replace(/\s/g, '')).slice(0, 4) || 'B'
  while (usadas.has(s)) s = `${s.slice(0, 3)}${usadas.size}`
  usadas.add(s)
  return s
}

export class ServicoArquivoAcademico {
  constructor({ prisma, conteudos, anosLetivos, auditoria, paginas = null, aprovacaoComandante = false, contas = null, cifra = null, dominioEmail = '', relogio = null }) {
    Object.assign(this, { contas, cifra, relogio, dominio: String(dominioEmail || '').split(',').map((x) => x.trim()).find(Boolean) || 'portal.esg.emfaa.gov.ao' })
    this.paginas = paginas
    this.aprovacaoComandante = aprovacaoComandante
    this.prisma = prisma
    this.conteudos = conteudos
    this.anosLetivos = anosLetivos
    this.auditoria = auditoria
  }

  // valida e arruma uma turma do ficheiro (o que vem do conversor das pautas do arquivo)
  #turmaDoFicheiro(t, i) {
    const sigla = txt(t?.sigla, 10).toUpperCase()
    const edicao = Number(t?.edicao)
    const anoLetivo = txt(t?.anoLetivo, 9)
    if (!sigla || !Number.isInteger(edicao) || edicao < 1 || !ANO.test(anoLetivo)) throw new ErroValidacao(`Turma ${i + 1} do ficheiro: falta a sigla do curso, a edição ou o ano lectivo (2024/2025).`)
    const usadas = new Set()
    const blocos = []
    const ucs = []
    // os blocos da pauta assinada, com o coeficiente de cada um (o TII é um bloco: «V. TII — Coeficiente 4»)
    const doFicheiro = new Map((Array.isArray(t.blocos) ? t.blocos : []).map((b) => [txt(b?.nome, 80), b]))
    for (const u of t.ucs ?? []) {
      const codigo = txt(u?.codigo, 20).toUpperCase()
      if (!codigo || ucs.some((x) => x.codigo === codigo)) continue
      const tii = /^TII\b|^TFC\b/.test(codigo)
      const nomeBloco = txt(u?.bloco, 80) || (tii && [...doFicheiro.keys()].find((n) => /^(V\.\s*)?TII$/i.test(n))) || ''
      let b = nomeBloco ? blocos.find((x) => x.nome === nomeBloco) : null
      if (nomeBloco && !b) {
        const f = doFicheiro.get(nomeBloco)
        const coef = Number(String(f?.coeficiente ?? '').replace(',', '.'))
        blocos.push((b = { sigla: /TII$/i.test(nomeBloco) ? 'TII' : siglaBloco(nomeBloco, usadas), nome: nomeBloco, coeficiente: Number.isFinite(coef) && coef > 0 ? coef : 1 }))
      }
      ucs.push({ codigo, nome: txt(u?.nome, 200) || codigo, bloco: b?.sigla ?? '', tii })
    }
    // as turmas sem pauta (só a relação nominal ou a lista de finalistas): os estudantes desse ano, sem cadeiras nem notas
    const semPauta = t.semPauta === true
    if (!ucs.length && !semPauta) throw new ErroValidacao(`${edicao}.º ${sigla} (${anoLetivo}): a pauta não tem cadeiras.`)
    const pessoa = (e) => ({ nip: txt(e?.nip, 20), nome: txt(e?.nome, 200), posto: txt(e?.posto, 60), ramo: txt(e?.ramo, 20), unidade: txt(e?.unidade, 200) })
    // quem está na lista do curso mas não na pauta: fica matriculado na turma, sem notas
    const outros = (Array.isArray(t.outrosEstudantes) ? t.outrosEstudantes : []).map(pessoa).filter((e) => e.nome)
    const estudantes = (t.estudantes ?? []).map((e) => ({
      nip: txt(e?.nip, 20), nome: txt(e?.nome, 200), posto: txt(e?.posto, 60), ramo: txt(e?.ramo, 20), unidade: txt(e?.unidade, 200),
      notas: Object.fromEntries(ucs.map((u) => [u.codigo, nota(e?.notas?.[u.codigo])])),
      final: nota(e?.final), mencao: txt(e?.mencao, 30), mediaSimples: nota(e?.mediaSimples), blocos: e?.blocos && typeof e.blocos === 'object' ? Object.fromEntries(Object.entries(e.blocos).map(([k, v]) => [txt(k, 80), nota(v)])) : {}, ordem: Number.isInteger(Number(e?.ordem)) && Number(e?.ordem) > 0 ? Number(e.ordem) : null,
    })).filter((e) => e.nome)
    // o nome da turma por extenso (o do curso: «29.º Curso Superior de Comando e Direcção»); sem ele, vem do curso
    // a fórmula da pauta (o conversor confere-a com as médias do Excel): blocos ponderados pelos coeficientes, ou a média das cadeiras
    const formula = t.formula === 'media' || !blocos.length ? 'media' : 'blocos'
    return { sigla, edicao, anoLetivo, nome: txt(t.nome, 150), blocos, ucs, estudantes, formula, ficheiro: txt(t.ficheiro, 300), semPauta, outros, emCurso: t.emCurso === true, cursoNome: txt(t.cursoNome, 200) }
  }

  /*
    As datas dos anos lectivos anteriores, como nos documentos assinados (o período dos certificados, o das relações
    nominais): só nos anos que ainda têm as datas padrão (1 de Outubro a 31 de Julho) e não estão fechados.
  */
  async datasDosAnos(ctx, anos = {}) {
    const feitas = []
    for (const [id, d] of Object.entries(anos ?? {})) {
      if (!ANO.test(id) || !/^\d{4}-\d{2}-\d{2}$/.test(String(d?.inicio)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(d?.fim)) || d.inicio >= d.fim) continue
      const a = await this.prisma.anoLetivo.findUnique({ where: { id } })
      const p = datasPadrao(id)
      if (!a || a.fechado || a.inicio.toISOString().slice(0, 10) !== p.inicio || a.fim.toISOString().slice(0, 10) !== p.fim) continue
      const dt = (x) => new Date(`${x}T00:00:00Z`)
      await this.prisma.anoLetivo.update({ where: { id }, data: { inicio: dt(d.inicio), fim: dt(d.fim), semestre1Inicio: dt(d.inicio), semestre2Fim: dt(d.fim) } })
      feitas.push(`${id}: ${d.inicio} a ${d.fim}`)
    }
    if (feitas.length && this.auditoria) await this.auditoria.registar(ctx, { acao: 'datas_dos_anos', colecao: 'anos_letivos', alvoTitulo: `Datas dos anos lectivos (documentos do arquivo): ${feitas.join('; ')}` })
    return feitas
  }

  async importar(ctx, { turmas, simular = true } = {}) {
    ctx.actor.exigir('academico.gerir')
    if (!Array.isArray(turmas) || !turmas.length) throw new ErroValidacao('O ficheiro não tem turmas (pautas do arquivo).')
    if (turmas.length > 200) throw new ErroValidacao('No máximo 200 turmas de cada vez.')
    const lista = turmas.map((t, i) => this.#turmaDoFicheiro(t, i))
    const cursos = await this.conteudos.listar('cursos')
    const porSigla = new Map(cursos.map((c) => [String(c.dados?.sigla ?? '').toUpperCase(), c]).filter(([s]) => s))
    const contas = await this.prisma.contaPortal.findMany({ where: { tipo: 'estudante' }, select: { id: true, nome: true, dados: true } })
    const porNumero = new Map()
    for (const c of contas) for (const n of [c.dados?.nip, c.dados?.numeroAgente]) if (n && norm(n)) porNumero.set(norm(n), c)
    // sem NIP na pauta (estrangeiros, pautas antigas): pelo nome completo, só se houver uma conta com esse nome
    const nomeChave = (n) => String(n ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean).sort().join(' ')
    const porNome = new Map()
    for (const c of contas) { const k = nomeChave(c.nome); porNome.set(k, porNome.has(k) ? null : c) }
    const resultado = []
    let gravadas = 0
    for (const t of lista) {
      const r = { turma: `${t.nome} (${t.anoLetivo})`, sigla: t.sigla, anoLetivo: t.anoLetivo, cadeiras: t.ucs.length, discentes: t.estudantes.length, comConta: 0, semConta: [], estado: '', motivo: '' }
      resultado.push(r)
      // um curso que já não se dá (CCEM, CPOS, línguas…) não está no site: a turma do arquivo fica com o nome do curso
      const curso = porSigla.get(t.sigla) ?? (t.semPauta && t.cursoNome ? { id: t.cursoNome, titulo: t.cursoNome, dados: { sigla: t.sigla, nome: t.cursoNome } } : null)
      if (!curso) { Object.assign(r, { estado: 'sem curso', motivo: `O curso ${t.sigla} não está em Conteúdos › Cursos (crie-o com esta sigla e volte a carregar).` }); continue }
      if (!t.nome) t.nome = `${t.edicao}.º ${curso.dados?.nome || curso.titulo || t.sigla}`
      r.turma = `${t.nome} (${t.anoLetivo})`
      const ano = await this.prisma.anoLetivo.findUnique({ where: { id: t.anoLetivo } })
      if (ano?.fechado) { Object.assign(r, { estado: 'ano fechado', motivo: `O ano lectivo ${t.anoLetivo} está fechado: peça a reabertura ao Comandante.` }); continue }
      // o que já está no sistema não se toca
      const existentes = await this.prisma.turma.findMany({ where: { curso: curso.id, anoLetivo: t.anoLetivo }, select: { id: true, nome: true, _count: { select: { matriculas: true } } } })
      const daqui = existentes.find((x) => x.nome === t.nome)
      const outras = existentes.filter((x) => x !== daqui && x._count.matriculas > 0)
      if (outras.length) { Object.assign(r, { estado: 'já existe', motivo: `Já há no sistema a turma ${outras.map((x) => x.nome).join(', ')} deste curso em ${t.anoLetivo}, com matrículas: fica como está.` }); continue }
      if (daqui && await this.#temNotasDoSistema(daqui.id)) { Object.assign(r, { estado: 'já existe', motivo: `A turma ${t.nome} já tem notas lançadas no sistema: fica como está.` }); continue }
      const linhas = []
      const faltam = []
      for (const e of [...t.estudantes, ...t.outros.map((o) => ({ ...o, soMatricula: true }))]) {
        // pelo NIP só se o nome também for dessa pessoa (há listas com os NIP desfasados dos nomes: 15.º CEAO); senão, pelo nome
        const peloNip = e.nip ? porNumero.get(norm(e.nip)) : null
        const nipCerto = peloNip && mesmoNome(peloNip.nome, e.nome)
        const c = (nipCerto ? peloNip : null) ?? ((!e.nip || peloNip) ? porNome.get(nomeChave(e.nome)) : null)
        if (peloNip && !nipCerto) r.nipsDuvidosos = [...(r.nipsDuvidosos ?? []), `${e.nome}: o NIP ${e.nip} é de ${peloNip.nome}`]
        if (peloNip && !nipCerto && !c) e.nip = '' // a conta nova fica sem esse NIP (é de outra pessoa)
        if (c) linhas.push({ ...e, conta: c })
        else faltam.push(e)
      }
      r.comConta = linhas.length
      // quem ainda não tem conta (o Pessoal ainda não o enviou): a conta cria-se já, para poder entrar e ver as notas
      r.contasNovas = faltam.map((e) => `${e.nome}${e.nip ? ` (${e.nip})` : ''}`)
      r.estado = simular ? 'por carregar' : 'carregada'
      if (simular) continue
      for (const e of faltam) {
        // as contas de quem só está nas listas de anos anteriores ficam inactivas (histórico); as do ano em curso, activas
        const c = await this.#criarConta(e, { ativo: t.emCurso || !(t.semPauta || e.soMatricula) })
        if (c) { linhas.push({ ...e, conta: c }); for (const n of [e.nip]) if (n) porNumero.set(norm(n), c) }
        else r.semConta.push(`${e.nome}${e.nip ? ` (${e.nip})` : ''}`)
      }
      // o ramo e o posto que faltam na conta (só o que está em branco; o que veio do Pessoal não muda)
      for (const l of linhas) {
        const d = l.conta.dados ?? {}
        const falta = Object.fromEntries([['ramo', l.ramo], ['posto', l.posto], ['departamento', l.unidade]].filter(([k, v]) => v && !d[k]))
        if (Object.keys(falta).length) { l.conta.dados = { ...d, ...falta }; await this.prisma.contaPortal.update({ where: { id: l.conta.id }, data: { dados: l.conta.dados } }) }
      }
      await this.anosLetivos.garantir(t.anoLetivo)
      await this.prisma.$transaction(async (tx) => this.#gravar(tx, t, curso, daqui, linhas, ctx), { timeout: 120_000 })
      gravadas++
    }
    if (!simular && gravadas) await this.auditoria.registar(ctx, { acao: 'carregar_arquivo_academico', colecao: 'turmas', alvoTitulo: `${gravadas} turma(s) do arquivo`, detalhes: { turmas: resultado.filter((x) => x.estado === 'carregada').map((x) => x.turma) } })
    return { simulado: Boolean(simular), turmas: resultado }
  }

  // notas que não vieram do arquivo (lançadas pelos docentes, pela Administração ou na pauta clássica)
  async #temNotasDoSistema(turmaId) {
    const [provas, pauta] = await Promise.all([
      this.prisma.notaAvaliacaoUc.count({ where: { avaliacao: { cadeira: { turmaId }, titulo: { not: TITULO_NOTA_ARQUIVO } }, nota: { not: null } } }),
      this.prisma.notaPauta.count({ where: { cadeira: { turmaId } } }),
    ])
    return provas + pauta > 0
  }

  async #gravar(tx, t, curso, existente, linhas, ctx) {
    const turma = existente ?? await tx.turma.create({ data: { curso: curso.id, anoLetivo: t.anoLetivo, nome: t.nome, anoFinal: true, ativa: Boolean(t.emCurso) } })
    // sem pauta, e quem não está na pauta: só a matrícula (concluída nos anos anteriores; activa no ano em curso)
    const estado = t.emCurso ? 'ativa' : 'concluida'
    // a turma sem pauta segue a lista: quem lá estava por engano (um NIP desfasado) sai da turma
    if (t.semPauta && existente) await tx.matricula.deleteMany({ where: { turmaId: turma.id, estudanteId: { notIn: linhas.map((l) => l.conta.id) } } })
    for (const l of linhas.filter((x) => t.semPauta || x.soMatricula)) {
      await tx.matricula.upsert({ where: { estudanteId_turmaId: { estudanteId: l.conta.id, turmaId: turma.id } }, create: { estudanteId: l.conta.id, turmaId: turma.id, estado }, update: {} })
    }
    if (t.semPauta) return
    linhas = linhas.filter((x) => !x.soMatricula)
    // o plano do curso desse ano (se ainda não houver): os blocos da pauta; a média e a classificação ficam as do arquivo
    let plano = await tx.planoCurso.findUnique({ where: { curso_anoLetivo: { curso: curso.id, anoLetivo: t.anoLetivo } } })
    if (!plano) {
      plano = await tx.planoCurso.create({ data: {
        curso: curso.id, anoLetivo: t.anoLetivo, nome: `${curso.dados?.nome ?? curso.titulo ?? t.sigla} — ${t.anoLetivo} (arquivo)`,
        formula: t.formula, blocos: t.blocos, exigirTesteEscrito: false,
      } })
    } else if (/\(arquivo\)$/.test(plano.nome)) {
      // o plano que veio do arquivo acompanha a pauta assinada (os blocos, os coeficientes e o TII; antes ficavam a 1)
      plano = await tx.planoCurso.update({ where: { id: plano.id }, data: { formula: t.formula, blocos: t.blocos } })
    }
    const planoDominio = { ...plano, blocos: plano.blocos ?? [], ajusteMaximo: Number(plano.ajusteMaximo ?? 0) }
    // as cadeiras (pelo código) e a prova com a nota final de cada uma
    const cadeiras = []
    for (const [i, u] of t.ucs.entries()) {
      let c = await tx.unidadeCurricular.findFirst({ where: { turmaId: turma.id, codigo: u.codigo } })
      if (!c) c = await tx.unidadeCurricular.create({ data: { turmaId: turma.id, codigo: u.codigo, nome: u.nome, periodo: 'anual', bloco: u.bloco, tii: u.tii } })
      else if (c.bloco !== u.bloco || c.tii !== u.tii) c = await tx.unidadeCurricular.update({ where: { id: c.id }, data: { bloco: u.bloco, tii: u.tii } })
      let a = await tx.avaliacaoUc.findFirst({ where: { cadeiraId: c.id, titulo: TITULO_NOTA_ARQUIVO } })
      if (!a) a = await tx.avaliacaoUc.create({ data: { cadeiraId: c.id, tipo: 'TAI', forma: 'trabalho', titulo: TITULO_NOTA_ARQUIVO, ordem: i, publicadaEm: new Date() } })
      cadeiras.push({ ...c, codigoArquivo: u.codigo, avaliacaoId: a.id })
    }
    const semFinais = linhas.every((l) => l.final === null)
    for (const l of linhas) {
      await tx.matricula.upsert({ where: { estudanteId_turmaId: { estudanteId: l.conta.id, turmaId: turma.id } }, create: { estudanteId: l.conta.id, turmaId: turma.id, estado: 'concluida' }, update: {} })
      const ucs = []
      for (const c of cadeiras) {
        const n = l.notas[c.codigoArquivo]
        if (n !== null) await tx.notaAvaliacaoUc.upsert({ where: { avaliacaoId_estudanteId: { avaliacaoId: c.avaliacaoId, estudanteId: l.conta.id } }, create: { avaliacaoId: c.avaliacaoId, estudanteId: l.conta.id, nota: n }, update: { nota: n } })
        // sem nota no arquivo (0 = não fez a cadeira): sai a que uma carga anterior tenha posto
        else await tx.notaAvaliacaoUc.deleteMany({ where: { avaliacaoId: c.avaliacaoId, estudanteId: l.conta.id } })
        ucs.push({ id: c.id, codigo: c.codigo, nome: c.nome, bloco: c.bloco, creditos: c.creditos ?? 0, tii: c.tii, final: n, situacao: n === null ? 'sem nota' : n >= NOTA_MINIMA ? 'aprovado' : 'reprovado', mencao: n === null ? null : mencao(n) })
      }
      // o resultado da pauta assinada (a média e a classificação do arquivo); as médias dos blocos calculam-se
      const calc = resultadoCurso(planoDominio, ucs)
      // as médias dos blocos como estão no Excel (sem as cadeiras a 0, que não se fizeram)
      for (const b of calc.blocos) {
        const v = l.blocos?.[b.nome]
        if (v !== null && v !== undefined) Object.assign(b, { nota: v, aprovado: v >= NOTA_MINIMA })
      }
      // pauta parcial (sem a média final no Excel): não se inventa a média
      const final = semFinais ? null : l.final ?? calc.final
      const reprovado = /^reprov/i.test(l.mencao) || (final !== null && final < NOTA_MINIMA)
      const fixado = {
        final, media: final, mediaSimples: l.mediaSimples ?? null, ordem: l.ordem ?? null, mencao: l.mencao ? l.mencao.replace(/^Muito bom$/i, 'Muito Bom') : final !== null ? (reprovado ? 'Reprovado' : mencao(final)) : calc.mencao, concluido: final !== null && !reprovado,
        emFalta: calc.emFalta.filter((x) => !/^Bloco|Média final/.test(x) && !ucs.some((u) => u.final === null && x.startsWith(`${u.codigo} `))), blocos: calc.blocos, ajuste: 0, ucs, origem: ORIGEM,
      }
      await tx.classificacaoCurso.upsert({ where: { turmaId_estudanteId: { turmaId: turma.id, estudanteId: l.conta.id } }, create: { turmaId: turma.id, estudanteId: l.conta.id, fixado }, update: { fixado } })
    }
    const quem = ctx.actor?.nome || ctx.utilizador?.nome || ''
    await tx.conselhoCurso.upsert({
      where: { turmaId: turma.id },
      create: { turmaId: turma.id, estado: 'homologada', homologadaPor: `${ORIGEM} (carregado por ${quem})`, homologadaEm: new Date(), observacoes: `Pauta do arquivo${t.ficheiro ? `: ${t.ficheiro}` : ''}` },
      update: { estado: 'homologada' },
    })
  }

  /*
    Arranque do ano lectivo (das relações do corpo docente e das listas dos discentes):
      - o catálogo das cadeiras (o departamento e os docentes habituais de cada uma) fica guardado: as cadeiras que se
        criarem depois recebem o departamento sozinhas;
      - cada turma do ano (o curso pela sigla): cria-se, com as cadeiras do modelo do plano de curso, e matriculam-se
        os discentes que já têm conta (pelo NIP); numa turma que já existe, só se completa o que falta;
      - em cada cadeira: o departamento (se estiver em branco) e os docentes habituais, como proposta para o Comandante
        aprovar na distribuição (ou logo aprovados, sem a aprovação dele ligada). Os docentes que já lá estão ficam.
    simular: mostra o que faria (as ligações das cadeiras ao catálogo, para conferir), sem gravar.
  */
  async arrancar(ctx, { anoLetivo, cadeiras = [], turmas = [], simular = true } = {}) {
    ctx.actor.exigir('academico.gerir')
    if (!ANO.test(String(anoLetivo ?? ''))) throw new ErroValidacao('Indique o ano lectivo (2026/2027).')
    const catalogo = cadeiras.map((c) => ({
      nome: txt(c?.nome, 200), departamento: txt(c?.departamento, 120),
      docentes: (c?.docentes ?? []).map((d) => ({ nip: txt(d?.nip, 20), nome: txt(d?.nome, 200), tipo: d?.tipo === 'colaborador' ? 'colaborador' : 'efectivo' })).filter((d) => d.nome),
    })).filter((c) => c.nome)
    const ano = await this.prisma.anoLetivo.findUnique({ where: { id: anoLetivo } })
    if (ano?.fechado) throw new ErroValidacao(`O ano lectivo ${anoLetivo} está fechado: peça a reabertura ao Comandante.`)
    const cursos = await this.conteudos.listar('cursos')
    const porSigla = new Map(cursos.map((c) => [String(c.dados?.sigla ?? '').toUpperCase(), c]).filter(([k]) => k))
    const contas = await this.prisma.contaPortal.findMany({ select: { id: true, tipo: true, nome: true, dados: true } })
    const nomeChave = (n) => String(n ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean).sort().join(' ')
    const conta = (tipo, nip, nome) => {
      const l = contas.filter((c) => c.tipo === tipo)
      return (nip && l.find((c) => norm(c.dados?.nip) === norm(nip) || norm(c.dados?.numeroAgente) === norm(nip))) || (() => { const m = l.filter((c) => nomeChave(c.nome) === nomeChave(nome)); return m.length === 1 ? m[0] : null })()
    }
    if (!simular) {
      await this.anosLetivos.garantir(anoLetivo)
      if (catalogo.length && this.paginas) await this.paginas.guardar(CHAVE_CATALOGO, { anoLetivo, cadeiras: catalogo }, ctx.actor?.id ?? null)
    }
    const resultado = []
    for (const t of turmas) {
      const sigla = txt(t?.sigla, 10).toUpperCase()
      const edicao = Number(t?.edicao)
      const r = { turma: `${edicao}.º ${sigla} (${anoLetivo})`, estado: '', motivo: '', discentes: 0, comConta: 0, semConta: [], contasNovas: [], cadeiras: [] }
      resultado.push(r)
      const curso = porSigla.get(sigla)
      if (!curso) { Object.assign(r, { estado: 'sem curso', motivo: `O curso ${sigla} não está em Conteúdos › Cursos (Gestão do Site).` }); continue }
      // o nome da turma por extenso: o da lista («18.º Curso de Organização…»), senão a edição e o nome do curso
      const nome = txt(t?.nome, 150) || `${edicao}.º ${curso.dados?.nome || curso.titulo || sigla}`
      r.turma = `${nome} (${anoLetivo})`
      const modelo = MODELOS_PLANO[t?.modelo]
      let turma = await this.prisma.turma.findFirst({ where: { curso: curso.id, anoLetivo }, orderBy: { id: 'asc' } })
      // o nome corrigido na lista (ex.: o COAMP de 2026/2027 é o 12.º, não o 18.º)
      if (turma && !simular && t?.nome && turma.nome !== nome) turma = await this.prisma.turma.update({ where: { id: turma.id }, data: { nome } })
      const ucs = turma ? await this.prisma.unidadeCurricular.findMany({ where: { turmaId: turma.id }, include: { docentes: true } }) : []
      const doModelo = modelo ? modelo.cadeiras.filter((c) => !ucs.some((u) => u.codigo === c.codigo)) : []
      const todas = [...ucs.map((u) => ({ codigo: u.codigo, nome: u.nome, departamento: u.departamento, docentes: u.docentes, existe: u })), ...doModelo.map((c) => ({ codigo: c.codigo, nome: c.nome, departamento: '', docentes: [], modelo: c }))]
      const estudantes = (t?.estudantes ?? []).map((e) => ({ nip: txt(e?.nip, 20), nome: txt(e?.nome, 200) })).filter((e) => e.nome)
      const comConta = estudantes.map((e) => ({ e, c: conta('estudante', e.nip, e.nome) }))
      r.discentes = estudantes.length
      r.comConta = comConta.filter((x) => x.c).length
      r.contasNovas = comConta.filter((x) => !x.c).map((x) => `${x.e.nome}${x.e.nip ? ` (${x.e.nip})` : ''}`)
      if (!simular) {
        for (const x of comConta.filter((y) => !y.c)) {
          x.c = await this.#criarConta(x.e)
          if (x.c) contas.push({ ...x.c, tipo: 'estudante' })
          else r.semConta.push(`${x.e.nome}${x.e.nip ? ` (${x.e.nip})` : ''}`)
        }
      }
      for (const c of todas) {
        const k = noCatalogo(c.nome, catalogo)
        const propostos = (k?.docentes ?? []).map((d) => ({ d, conta: conta('docente', d.nip, d.nome) }))
        r.cadeiras.push({
          codigo: c.codigo, nome: c.nome, catalogo: k?.nome ?? null, departamento: c.departamento || k?.departamento || '',
          docentes: propostos.filter((x) => x.conta).map((x) => x.conta.nome), docentesSemConta: propostos.filter((x) => !x.conta).map((x) => x.d.nome),
        })
      }
      r.estado = simular ? (turma ? 'completar' : 'por criar') : turma ? 'completada' : 'criada'
      r.motivo = modelo ? '' : 'Sem modelo do plano de curso: a turma fica sem cadeiras (carregue o plano em Turma › Plano de curso).'
      if (simular) continue
      await this.prisma.$transaction(async (tx) => {
        if (!turma) turma = await tx.turma.create({ data: { curso: curso.id, anoLetivo, nome, anoFinal: true, ativa: true } })
        const planoAtual = modelo ? await tx.planoCurso.findUnique({ where: { curso_anoLetivo: { curso: curso.id, anoLetivo } } }) : null
        if (modelo && !planoAtual) {
          await tx.planoCurso.create({ data: validarPlano({ ...modelo.plano, curso: curso.id, anoLetivo }) })
        } else if (modelo && planoAtual.nome === modelo.plano.nome && planoAtual.formula !== modelo.plano.formula && ['media', 'percentagem'].includes(planoAtual.formula)) {
          // o plano carregado com a versão anterior do modelo (COAMP média simples de todas as UC, CEAO UC pesadas pelos
          // créditos): passa às contas das pautas assinadas — a fórmula, os blocos e o bloco de cada UC (o TFC é um bloco)
          const novo = validarPlano({ ...modelo.plano, curso: curso.id, anoLetivo })
          await tx.planoCurso.update({ where: { id: planoAtual.id }, data: { formula: novo.formula, blocos: novo.blocos, exigirBlocos: novo.exigirBlocos } })
          if (turma) {
            for (const m of modelo.cadeiras) await tx.unidadeCurricular.updateMany({ where: { turmaId: turma.id, codigo: m.codigo, NOT: { bloco: m.bloco } }, data: { bloco: m.bloco } })
          }
        }
        for (const x of comConta.filter((y) => y.c)) await tx.matricula.upsert({ where: { estudanteId_turmaId: { estudanteId: x.c.id, turmaId: turma.id } }, create: { estudanteId: x.c.id, turmaId: turma.id, estado: 'ativa' }, update: {} })
        for (const [i, c] of todas.entries()) {
          const info = r.cadeiras[i]
          let uc = c.existe
          if (!uc) {
            const m = c.modelo
            uc = await tx.unidadeCurricular.create({ data: { turmaId: turma.id, codigo: m.codigo, nome: m.nome, periodo: m.periodo, bloco: m.bloco, creditos: m.creditos, horasContacto: m.horasContacto, horasNaoContacto: m.horasNaoContacto, horas: m.horasContacto + m.horasNaoContacto, tii: Boolean(m.tii), departamento: info.departamento } })
          } else if (!uc.departamento && info.departamento) await tx.unidadeCurricular.update({ where: { id: uc.id }, data: { departamento: info.departamento } })
          const ja = new Set((c.docentes ?? []).map((d) => d.docenteId))
          const k = noCatalogo(c.nome, catalogo)
          let primeiro = ja.size === 0
          for (const d of k?.docentes ?? []) {
            const cd = conta('docente', d.nip, d.nome)
            if (!cd || ja.has(cd.id)) continue
            await tx.docencia.create({ data: { cadeiraId: uc.id, docenteId: cd.id, papel: primeiro && d.tipo === 'efectivo' ? 'regente' : 'assistente', estado: this.aprovacaoComandante ? 'proposta' : 'aprovada' } })
            if (d.tipo === 'efectivo') primeiro = false
            ja.add(cd.id)
          }
        }
      }, { timeout: 120_000 })
    }
    if (!simular) await this.auditoria.registar(ctx, { acao: 'arranque_ano_letivo', colecao: 'turmas', alvoTitulo: `${anoLetivo}: ${resultado.length} turma(s), ${catalogo.length} cadeira(s) no catálogo` })
    return { simulado: Boolean(simular), anoLetivo, catalogo: catalogo.length, turmas: resultado }
  }

  /*
    A conta de um discente que o Pessoal ainda não enviou: activa (entra no portal e vê as suas notas), com o e-mail de
    acesso nome.apelido@portal.esg.emfaa.gov.ao (a mesma regra do Pessoal) e uma palavra-passe que ninguém sabe — a
    Repartição entrega a ficha de acesso («Repor a palavra-passe»). Quando o Pessoal o enviar, reconhece-o pelo NIP.
  */
  /*
    Os docentes habituais de cada cadeira (o catálogo das listas do corpo docente, guardado no arranque do ano) que
    ainda não estavam nas cadeiras porque não tinham conta: quando chegam do Sistema de Pessoal, ficam propostos nas
    cadeiras do ano (para o Comandante aprovar). Repetir não duplica.
  */
  /*
    Os docentes de cada ano lectivo anterior (as listas do corpo docente, com a disciplina de cada um): guardam-se e
    cada docente fica nas cadeiras desse ano com essa disciplina (aprovado: é o registo do que foi). Quem ainda não
    chegou do Pessoal entra quando chegar (proporDocentesDoCatalogo corre também nestes anos).
  */
  async guardarDocentesDosAnos(ctx, anos = []) {
    if (!this.paginas || !Array.isArray(anos)) return { anos: 0, propostos: 0 }
    const limpos = {}
    for (const a of anos.slice(0, 20)) {
      if (!ANO.test(String(a?.anoLetivo ?? ''))) continue
      limpos[a.anoLetivo] = (Array.isArray(a.cadeiras) ? a.cadeiras : []).slice(0, 500).map((c) => ({ nome: txt(c?.nome, 200), docentes: (Array.isArray(c?.docentes) ? c.docentes : []).slice(0, 50).map((d) => ({ nip: txt(d?.nip, 20), nome: txt(d?.nome, 200), tipo: txt(d?.tipo, 20) || 'efectivo' })) })).filter((c) => c.nome)
    }
    await this.paginas.guardar(CHAVE_CATALOGOS_ANOS, limpos, ctx.actor?.id ?? null)
    const r = await this.proporDocentesDoCatalogo(ctx)
    return { anos: Object.keys(limpos).length, propostos: r.propostos }
  }

  async proporDocentesDoCatalogo(ctx) {
    const cat = this.paginas ? await this.paginas.ler(CHAVE_CATALOGO) : null
    // os anos anteriores (as listas do corpo docente de cada ano)
    let propostos = 0
    const anteriores = this.paginas ? (await this.paginas.ler(CHAVE_CATALOGOS_ANOS)) ?? {} : {}
    for (const [anoLetivo, cadeiras] of Object.entries(anteriores)) {
      if (cat?.anoLetivo === anoLetivo || !cadeiras?.length) continue
      propostos += await this.#docentesNasCadeiras(anoLetivo, cadeiras, { anterior: true })
    }
    if (!cat?.cadeiras?.length || !cat.anoLetivo) {
      if (propostos && this.auditoria) await this.auditoria.registar(ctx, { acao: 'docentes_do_catalogo', colecao: 'cadeiras', alvoTitulo: `${propostos} docente(s) nas cadeiras dos anos anteriores (listas do corpo docente)`, utilizador: null })
      return { propostos }
    }
    propostos += await this.#docentesNasCadeiras(cat.anoLetivo, cat.cadeiras, { anterior: false })
    if (propostos && this.auditoria) await this.auditoria.registar(ctx, { acao: 'docentes_do_catalogo', colecao: 'cadeiras', alvoTitulo: `${cat.anoLetivo}: ${propostos} docente(s) propostos nas cadeiras (chegaram do Pessoal)`, utilizador: null })
    return { propostos }
  }

  // cada docente da lista nas cadeiras do ano com a sua disciplina (pelo nome da cadeira); devolve quantos entraram
  async #docentesNasCadeiras(anoLetivo, catalogo, { anterior }) {
    const ano = await this.prisma.anoLetivo.findUnique({ where: { id: anoLetivo } })
    if (ano?.fechado) return 0
    const contas = await this.prisma.contaPortal.findMany({ where: { tipo: 'docente' }, select: { id: true, nome: true, dados: true, ativo: true } })
    const nomeChave = (n) => String(n ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean).sort().join(' ')
    const conta = (nip, nome) => (nip && contas.find((c) => norm(c.dados?.nip) === norm(nip) || norm(c.dados?.numeroAgente) === norm(nip))) || (() => { const m = contas.filter((c) => nomeChave(c.nome) === nomeChave(nome)); return m.length === 1 ? m[0] : null })()
    const ucs = await this.prisma.unidadeCurricular.findMany({ where: { turma: { anoLetivo } }, include: { docentes: true } })
    let propostos = 0
    for (const uc of ucs) {
      const k = noCatalogo(uc.nome, catalogo)
      if (!k?.docentes?.length) continue
      const ja = new Set(uc.docentes.map((d) => d.docenteId))
      let primeiro = ja.size === 0
      for (const d of k.docentes) {
        const cd = conta(d.nip, d.nome)
        if (!cd || ja.has(cd.id)) continue
        // nos anos anteriores fica logo (é o registo do que foi); no ano em curso segue para o Comandante
        await this.prisma.docencia.create({ data: { cadeiraId: uc.id, docenteId: cd.id, papel: primeiro && d.tipo === 'efectivo' ? 'regente' : 'assistente', estado: !anterior && this.aprovacaoComandante ? 'proposta' : 'aprovada' } })
        if (d.tipo === 'efectivo') primeiro = false
        ja.add(cd.id)
        propostos++
      }
    }
    return propostos
  }

  async #criarConta(e, { ativo = true } = {}) {
    if (!this.contas || !this.cifra) return null
    if (!this.emails) this.emails = new Set((await this.prisma.contaPortal.findMany({ select: { email: true } })).map((c) => c.email.toLowerCase()))
    const email = emailDeAcesso(e.nome, this.dominio, this.emails)
    if (!email) return null
    this.emails.add(email)
    const ano = (this.relogio?.agora() ?? new Date()).getFullYear()
    for (let tentativa = 0; tentativa < 4; tentativa++) {
      try {
        const c = await this.contas.criar({ tipo: 'estudante', numero: numeroConta('estudante', ano, await this.contas.proximaSequencia('estudante', ano)), nome: e.nome, email, senha: await this.cifra.cifrar(senhaInicial()), ativo, dados: { nip: e.nip || '', posto: e.posto || '', ramo: e.ramo || '', departamento: e.unidade || '' } })
        return { id: c.id, nome: c.nome, dados: c.dados }
      } catch (erro) {
        if (!/Número/.test(erro.message)) throw erro
      }
    }
    return null
  }

}
