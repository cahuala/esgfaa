const paraMensagem = (m) => m && { ...m, criadoEm: m.criadoEm.toISOString(), atualizadoEm: m.atualizadoEm.toISOString() }

export class RepositorioContactos {
  constructor({ prisma }) {
    this.prisma = prisma
  }

  async criar(dados) {
    return paraMensagem(await this.prisma.mensagemContacto.create({ data: dados }))
  }

  async listar() {
    return (await this.prisma.mensagemContacto.findMany({ orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }], take: 2000 })).map(paraMensagem)
  }

  async ler(id) {
    return paraMensagem(await this.prisma.mensagemContacto.findUnique({ where: { id } }))
  }

  async atualizar(id, dados) {
    return paraMensagem(await this.prisma.mensagemContacto.update({ where: { id }, data: dados }))
  }

  async apagar(id) {
    await this.prisma.mensagemContacto.delete({ where: { id } })
  }

  contarNovas() {
    return this.prisma.mensagemContacto.count({ where: { estado: 'nova' } })
  }
}
