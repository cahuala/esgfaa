const paraFerramenta = (f) => f && { ...f, redirecionamentos: Array.isArray(f.redirecionamentos) ? f.redirecionamentos : [], criadoEm: f.criadoEm.toISOString() }

export class RepositorioLti {
  constructor({ prisma }) {
    this.prisma = prisma
  }

  async listar() {
    return (await this.prisma.ferramentaLti.findMany({ orderBy: { nome: 'asc' } })).map(paraFerramenta)
  }

  async ler(id) {
    const n = Number(id)
    return Number.isSafeInteger(n) && n > 0 ? paraFerramenta(await this.prisma.ferramentaLti.findUnique({ where: { id: n } })) : null
  }

  async porCliente(clienteId) {
    return paraFerramenta(await this.prisma.ferramentaLti.findUnique({ where: { clienteId: String(clienteId) } }))
  }

  async criar(dados) {
    return paraFerramenta(await this.prisma.ferramentaLti.create({ data: dados }))
  }

  async atualizar(id, dados) {
    return paraFerramenta(await this.prisma.ferramentaLti.update({ where: { id }, data: dados }))
  }

  async apagar(id) {
    await this.prisma.ferramentaLti.delete({ where: { id } })
  }
}
