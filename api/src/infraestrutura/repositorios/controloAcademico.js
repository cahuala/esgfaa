import { Prisma } from '../bd/prisma.js'
/*
  Controlo académico centralizado no Comandante e na Repartição de Administração Escolar:
  as provas escritas enviadas para impressão, os pedidos de alteração de notas já publicadas
  e a verificação dos docentes registados.
*/
const CADEIRA = { select: { id: true, codigo: true, nome: true, turma: { select: { id: true, nome: true, anoLetivo: true } } } }

// a turma com as cadeiras e os docentes (aprovados e propostos), para o Comandante rever
const TURMA_COM_DOCENCIAS = {
  cadeiras: {
    orderBy: [{ periodo: 'asc' }, { codigo: 'asc' }],
    select: { id: true, codigo: true, nome: true, horas: true, docentes: { select: { papel: true, horas: true, estado: true, docente: { select: { id: true, nome: true, email: true, numero: true, verificadoEm: true, ultimoAcesso: true, ativo: true, dados: true } } } } },
  },
}

export class RepositorioControloAcademico {
  constructor({ prisma }) {
    this.prisma = prisma
  }

  async #nomes(ids) {
    const l = await this.prisma.contaPortal.findMany({ where: { id: { in: [...new Set(ids.filter(Boolean))] } }, select: { id: true, nome: true, numero: true } })
    return new Map(l.map((c) => [c.id, c]))
  }

  // ---------- provas escritas para imprimir ----------

  criarEnunciado(dados) {
    return this.prisma.enunciadoProva.create({ data: dados })
  }

  enunciado(id) {
    return this.prisma.enunciadoProva.findUnique({ where: { id } })
  }

  atualizarEnunciado(id, dados) {
    return this.prisma.enunciadoProva.update({ where: { id }, data: dados })
  }

  apagarEnunciado(id) {
    return this.prisma.enunciadoProva.delete({ where: { id } })
  }

  async enunciados({ cadeiraId, estado } = {}) {
    const l = await this.prisma.enunciadoProva.findMany({
      where: { ...(cadeiraId ? { cadeiraId } : {}), ...(estado ? { estado } : {}) },
      include: { cadeira: CADEIRA }, orderBy: [{ estado: 'asc' }, { data: 'asc' }, { enviadoEm: 'desc' }],
    })
    const docentes = await this.#nomes(l.map((e) => e.enviadoPor))
    return l.map((e) => ({ ...e, docente: docentes.get(e.enviadoPor)?.nome ?? '' }))
  }

  contarEnunciados(estado) {
    return this.prisma.enunciadoProva.count({ where: { estado } })
  }

  // ---------- pedidos de alteração de notas ----------

  criarPedidos(linhas) {
    return this.prisma.$transaction(linhas.map((data) => this.prisma.pedidoAlteracaoNota.create({ data })))
  }

  pedido(id) {
    return this.prisma.pedidoAlteracaoNota.findUnique({ where: { id } })
  }

  atualizarPedido(id, dados) {
    return this.prisma.pedidoAlteracaoNota.update({ where: { id }, data: dados })
  }

  // o pedido em aberto (pendente ou autorizado) de um estudante numa prova ou componente
  pedidoAberto(cadeiraId, { avaliacaoId = null, componente = null }, estudanteId, estados = ['pendente', 'autorizado']) {
    return this.prisma.pedidoAlteracaoNota.findFirst({ where: { cadeiraId, estudanteId, estado: { in: estados }, ...(avaliacaoId ? { avaliacaoId } : { componente }) }, orderBy: { id: 'desc' } })
  }

  async pedidos({ cadeiraId, estado } = {}) {
    const l = await this.prisma.pedidoAlteracaoNota.findMany({
      where: { ...(cadeiraId ? { cadeiraId } : {}), ...(estado ? { estado } : {}) },
      include: { cadeira: CADEIRA }, orderBy: [{ pedidoEm: 'desc' }], take: 500,
    })
    const pessoas = await this.#nomes(l.flatMap((p) => [p.estudanteId, p.pedidoPor]))
    const provas = new Map((await this.prisma.avaliacaoUc.findMany({ where: { id: { in: l.map((p) => p.avaliacaoId).filter(Boolean) } }, select: { id: true, tipo: true, titulo: true } })).map((a) => [a.id, a]))
    return l.map((p) => ({ ...p, estudante: pessoas.get(p.estudanteId) ?? null, docente: pessoas.get(p.pedidoPor)?.nome ?? '', prova: p.avaliacaoId ? provas.get(p.avaliacaoId) ?? null : null }))
  }

  contarPedidos(estado) {
    return this.prisma.pedidoAlteracaoNota.count({ where: { estado } })
  }

  // ---------- docentes: verificação pelo Comandante ----------

  async docentes() {
    const l = await this.prisma.contaPortal.findMany({
      where: { tipo: 'docente' }, orderBy: [{ verificadoEm: { sort: 'asc', nulls: 'first' } }, { nome: 'asc' }],
      select: { id: true, numero: true, nome: true, email: true, ativo: true, dados: true, criadoEm: true, verificadoPor: true, verificadoEm: true, docencias: { select: { papel: true, cadeira: { select: { codigo: true, nome: true, turma: { select: { nome: true } } } } } } },
    })
    return l
  }

  verificarDocentes(ids, quem, quando) {
    return this.prisma.contaPortal.updateMany({ where: { id: { in: ids }, tipo: 'docente', verificadoEm: null }, data: { verificadoPor: quem, verificadoEm: quando } })
  }

  contarDocentesPorVerificar() {
    return this.prisma.contaPortal.count({ where: { tipo: 'docente', ativo: true, verificadoEm: null } })
  }

  // ---------- distribuição dos docentes pelas cadeiras (o Comandante aprova) ----------

  turmaComDocencias(id) {
    return this.prisma.turma.findUnique({ where: { id }, include: TURMA_COM_DOCENCIAS })
  }

  turmasComDistribuicaoPendente() {
    return this.prisma.turma.findMany({ where: { distribuicao: { path: ['estado'], equals: 'pendente' } }, include: TURMA_COM_DOCENCIAS, orderBy: { id: 'asc' } })
  }

  // a distribuição vai ao Comandante por ano lectivo: conta os anos à espera
  async contarDistribuicoesPendentes() {
    const l = await this.prisma.turma.findMany({ where: { distribuicao: { path: ['estado'], equals: 'pendente' } }, select: { anoLetivo: true }, distinct: ['anoLetivo'] })
    return l.length
  }

  // as turmas activas de um ano lectivo, com os docentes de cada cadeira
  turmasDoAno(anoLetivo) {
    return this.prisma.turma.findMany({ where: { anoLetivo, ativa: true }, include: TURMA_COM_DOCENCIAS, orderBy: [{ curso: 'asc' }, { nome: 'asc' }] })
  }

  guardarDistribuicao(turmaId, pedido) {
    return this.prisma.turma.update({ where: { id: turmaId }, data: { distribuicao: pedido ?? Prisma.DbNull } })
  }

  // aprova os docentes propostos da turma; devolve os ids das contas
  async aprovarPropostas(turmaId) {
    const l = await this.prisma.docencia.findMany({ where: { estado: 'proposta', cadeira: { turmaId } }, select: { docenteId: true } })
    await this.prisma.docencia.updateMany({ where: { estado: 'proposta', cadeira: { turmaId } }, data: { estado: 'aprovada' } })
    return [...new Set(l.map((d) => d.docenteId))]
  }

  // a lista rejeitada: os docentes propostos saem das cadeiras (os já aprovados ficam)
  async removerPropostas(turmaId) {
    return (await this.prisma.docencia.deleteMany({ where: { estado: 'proposta', cadeira: { turmaId } } })).count
  }

  // ---------- publicação de notas (o Comandante aprova) ----------

  cadeirasComPublicacaoPendente() {
    return this.prisma.unidadeCurricular.findMany({ where: { publicacaoPedida: { path: ['estado'], equals: 'pendente' } }, include: { turma: { select: { id: true, nome: true, anoLetivo: true } } }, orderBy: { id: 'asc' } })
  }

  avaliacoesComPublicacaoPendente() {
    return this.prisma.avaliacaoUc.findMany({ where: { publicacaoPedida: { path: ['estado'], equals: 'pendente' } }, include: { cadeira: { include: { turma: { select: { id: true, nome: true, anoLetivo: true } } } } }, orderBy: { id: 'asc' } })
  }

  async contarPublicacoesPendentes() {
    const onde = { publicacaoPedida: { path: ['estado'], equals: 'pendente' } }
    return (await this.prisma.unidadeCurricular.count({ where: onde })) + (await this.prisma.avaliacaoUc.count({ where: onde }))
  }

  // as notas de uma cadeira (ou de uma prova TAI/TAG) para o Comandante rever: quantos, média, positivas
  async resumoNotas(cadeiraId, componentes) {
    const l = await this.prisma.notaPauta.findMany({ where: { cadeiraId }, select: Object.fromEntries(componentes.map((k) => [k, true])) })
    return componentes.map((k) => {
      const v = l.map((x) => (x[k] === null || x[k] === undefined ? null : Number(x[k]))).filter((x) => x !== null)
      return { componente: k, notas: v.length, media: v.length ? v.reduce((s, x) => s + x, 0) / v.length : null, positivas: v.filter((x) => x >= 10).length }
    })
  }

  async resumoNotasProva(avaliacaoId) {
    const l = await this.prisma.notaAvaliacaoUc.findMany({ where: { avaliacaoId }, select: { nota: true } })
    const v = l.map((x) => (x.nota === null ? null : Number(x.nota))).filter((x) => x !== null)
    return { notas: v.length, media: v.length ? v.reduce((s, x) => s + x, 0) / v.length : null, positivas: v.filter((x) => x >= 10).length }
  }

  // ---------- resumo para o painel ----------

  // anoLetivo: as turmas, os estudantes e os docentes desse ano (o de trabalho de quem vê); sem ele, os activos
  async resumoAcademico({ anoLetivo } = {}) {
    const p = this.prisma
    const [turmas, estudantes, docentes, pedidosDocumentos, conselhos, revisoes] = await Promise.all([
      p.turma.count({ where: anoLetivo ? { anoLetivo } : { ativa: true } }),
      anoLetivo ? p.matricula.count({ where: { estado: { not: 'anulada' }, turma: { anoLetivo } } }) : p.matricula.count({ where: { estado: 'ativa', turma: { ativa: true } } }),
      anoLetivo ? p.contaPortal.count({ where: { tipo: 'docente', docencias: { some: { cadeira: { turma: { anoLetivo } } } } } }) : p.contaPortal.count({ where: { tipo: 'docente', ativo: true } }),
      p.pedido.count({ where: { estado: { in: ['pendente', 'em_tratamento'] } } }),
      p.conselhoCurso.findMany({ where: { estado: { in: ['proposta', 'confirmada'] } }, select: { estado: true, turmaId: true } }),
      p.notaAvaliacaoUc.count({ where: { revisaoPedidaEm: { not: null }, revisaoDecididaEm: null } }),
    ])
    const nomes = new Map((await p.turma.findMany({ where: { id: { in: conselhos.map((c) => c.turmaId) } }, select: { id: true, nome: true } })).map((t) => [t.id, t]))
    return {
      turmas, estudantes, docentes, pedidosDocumentos, revisoes,
      porConfirmar: conselhos.filter((c) => c.estado === 'proposta').map((c) => nomes.get(c.turmaId)).filter(Boolean),
      porHomologar: conselhos.filter((c) => c.estado === 'confirmada').map((c) => nomes.get(c.turmaId)).filter(Boolean),
    }
  }
}
