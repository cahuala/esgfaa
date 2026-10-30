import { Prisma } from '../bd/prisma.js'

export class RepositorioPaginas {
  constructor({ prisma }) {
    this.prisma = prisma
  }

  async ler(chave) {
    return (await this.prisma.pagina.findUnique({ where: { chave } }))?.dados ?? null
  }

  // a alteração à espera do Comandante (ou recusada), sem tocar na versão publicada
  async aprovacao(chave) {
    return (await this.prisma.pagina.findUnique({ where: { chave }, select: { aprovacao: true } }))?.aprovacao ?? null
  }

  async guardarAprovacao(chave, aprovacao, autorId) {
    await this.prisma.pagina.upsert({
      where: { chave },
      create: { chave, dados: {}, aprovacao: aprovacao ?? Prisma.DbNull, atualizadoPor: autorId },
      update: { aprovacao: aprovacao ?? Prisma.DbNull, atualizadoEm: new Date(), atualizadoPor: autorId },
    })
  }

  async pendentes() {
    return this.prisma.pagina.findMany({ where: { aprovacao: { path: ['estado'], equals: 'pendente' } } })
  }

  contarPendentes() {
    return this.prisma.pagina.count({ where: { aprovacao: { path: ['estado'], equals: 'pendente' } } })
  }

  async guardar(chave, dados, autorId) {
    await this.prisma.pagina.upsert({
      where: { chave },
      create: { chave, dados, atualizadoPor: autorId },
      update: { dados, aprovacao: Prisma.DbNull, atualizadoEm: new Date(), atualizadoPor: autorId },
    })
  }

  async semear(chave, dados) {
    await this.prisma.pagina.createMany({ data: [{ chave, dados }], skipDuplicates: true })
  }
}
