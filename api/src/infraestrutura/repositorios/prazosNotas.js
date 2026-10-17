// prazos de lançamento das notas
export class RepositorioPrazosNotas {
  constructor({ prisma }) {
    this.prisma = prisma
  }

  todos() {
    return this.prisma.prazoNotas.findMany({ include: { turma: { select: { nome: true, anoLetivo: true } }, cadeira: { select: { codigo: true, nome: true } } }, orderBy: [{ inicio: 'desc' }, { id: 'desc' }] })
  }

  daCadeira(cadeira) {
    return this.prisma.prazoNotas.findMany({ where: { OR: [{ cadeiraId: cadeira.id }, { turmaId: cadeira.turmaId, cadeiraId: null }, { turmaId: null, cadeiraId: null }] } })
  }

  criar(dados) {
    return this.prisma.prazoNotas.create({ data: dados })
  }

  porId(id) {
    return this.prisma.prazoNotas.findUnique({ where: { id } })
  }

  apagar(id) {
    return this.prisma.prazoNotas.delete({ where: { id } })
  }
}
