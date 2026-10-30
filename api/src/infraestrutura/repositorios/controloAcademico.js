/*
  Controlo académico centralizado no Comandante e na Repartição de Administração Escolar:
  as provas escritas enviadas para impressão, os pedidos de alteração de notas já publicadas
  e a verificação dos docentes registados.
*/
const CADEIRA = { select: { id: true, codigo: true, nome: true, turma: { select: { id: true, nome: true, anoLetivo: true } } } }

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

  // ---------- resumo para o painel ----------

  async resumoAcademico() {
    const p = this.prisma
    const [turmas, estudantes, docentes, pedidosDocumentos, conselhos, revisoes] = await Promise.all([
      p.turma.count({ where: { ativa: true } }),
      p.matricula.count({ where: { estado: 'ativa', turma: { ativa: true } } }),
      p.contaPortal.count({ where: { tipo: 'docente', ativo: true } }),
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
