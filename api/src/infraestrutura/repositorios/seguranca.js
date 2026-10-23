export class RepositorioSeguranca {
  constructor({ prisma }) {
    this.prisma = prisma
  }

  async gravarEventos(lista) {
    if (lista.length) await this.prisma.eventoSeguranca.createMany({ data: lista })
  }

  apagarAntigos(antesDe) {
    return this.prisma.eventoSeguranca.deleteMany({ where: { minuto: { lt: antesDe } } })
  }

  // total de cada tipo desde uma data
  async resumo(desde) {
    const l = await this.prisma.eventoSeguranca.groupBy({ by: ['tipo'], where: { minuto: { gte: desde } }, _sum: { contagem: true } })
    return Object.fromEntries(l.map((x) => [x.tipo, x._sum.contagem || 0]))
  }

  // eventos por hora desde uma data (para o gráfico dos últimos dias)
  async porHora(desde) {
    const l = await this.prisma.$queryRaw`SELECT date_trunc('hour', minuto) AS hora, tipo, SUM(contagem)::int AS n FROM eventos_seguranca WHERE minuto >= ${desde} GROUP BY 1, 2 ORDER BY 1`
    return l.map((x) => ({ hora: new Date(x.hora).toISOString(), tipo: x.tipo, n: Number(x.n) }))
  }

  // endereços com mais eventos desde uma data
  async ipsSuspeitos(desde, limite = 20) {
    const l = await this.prisma.eventoSeguranca.groupBy({ by: ['ip'], where: { minuto: { gte: desde }, tipo: { not: 'sessao_invalida' } }, _sum: { contagem: true }, orderBy: { _sum: { contagem: 'desc' } }, take: limite })
    return l.map((x) => ({ ip: x.ip, eventos: x._sum.contagem || 0 }))
  }

  async bloqueios() {
    return this.prisma.bloqueioIp.findMany({ where: { ate: { gt: new Date() } }, orderBy: { criadoEm: 'desc' } })
  }

  bloquear(dados) {
    return this.prisma.bloqueioIp.upsert({ where: { ip: dados.ip }, create: dados, update: dados })
  }

  async desbloquear(ip) {
    await this.prisma.bloqueioIp.deleteMany({ where: { ip } })
  }

  async protecao() {
    return (await this.prisma.protecaoSistema.findUnique({ where: { id: 1 } }))?.dados ?? null
  }

  async guardarProtecao(dados) {
    await this.prisma.protecaoSistema.upsert({ where: { id: 1 }, create: { id: 1, dados }, update: { dados } })
  }

  async pingMs() {
    const t = process.hrtime.bigint()
    await this.prisma.$queryRaw`SELECT 1`
    return Number(process.hrtime.bigint() - t) / 1e6
  }
}
