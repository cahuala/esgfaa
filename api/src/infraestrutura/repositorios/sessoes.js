// sessões terminadas antes de expirarem (o token deixa de ser aceite)
export class RepositorioSessoes {
  constructor({ prisma }) {
    this.prisma = prisma
  }

  async revogar(jti, expiraEm) {
    await this.prisma.sessaoRevogada.deleteMany({ where: { expira: { lt: new Date() } } })
    await this.prisma.sessaoRevogada.createMany({ data: [{ jti, expira: new Date(expiraEm) }], skipDuplicates: true })
  }

  async revogada(jti) {
    return Boolean(await this.prisma.sessaoRevogada.findUnique({ where: { jti }, select: { jti: true } }))
  }
}
