export class RepositorioPaginas {
  constructor({ prisma }) {
    this.prisma = prisma
  }

  async ler(chave) {
    return (await this.prisma.pagina.findUnique({ where: { chave } }))?.dados ?? null
  }

  async guardar(chave, dados, autorId) {
    await this.prisma.pagina.upsert({
      where: { chave },
      create: { chave, dados, atualizadoPor: autorId },
      update: { dados, atualizadoEm: new Date(), atualizadoPor: autorId },
    })
  }

  async semear(chave, dados) {
    await this.prisma.pagina.createMany({ data: [{ chave, dados }], skipDuplicates: true })
  }
}
