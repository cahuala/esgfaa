import { Prisma } from '../bd/prisma.js'

// só estas duas colunas podem ser incrementadas (nomes fixos)
const CAMPOS = { impressao: Prisma.raw('impressoes'), clique: Prisma.raw('cliques') }

export class RepositorioPublicidade {
  constructor({ prisma, fuso }) {
    this.prisma = prisma
    this.fuso = fuso
  }

  async contar(bannerId, tipo) {
    const campo = CAMPOS[tipo]
    if (!campo) return
    await this.prisma.$executeRaw`
      INSERT INTO publicidade_metricas (banner_id, dia, ${campo}) VALUES (${bannerId}, (now() AT TIME ZONE ${this.fuso})::date, 1)
      ON CONFLICT (banner_id, dia) DO UPDATE SET ${campo} = publicidade_metricas.${campo} + 1`
  }

  // { bannerId: { impressoes, cliques } }
  async metricas() {
    const grupos = await this.prisma.publicidadeMetrica.groupBy({ by: ['bannerId'], _sum: { impressoes: true, cliques: true } })
    return Object.fromEntries(grupos.map((g) => [g.bannerId, { impressoes: g._sum.impressoes || 0, cliques: g._sum.cliques || 0 }]))
  }
}
