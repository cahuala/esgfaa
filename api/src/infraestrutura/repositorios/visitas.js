import { Prisma } from '../bd/prisma.js'

// colunas que se podem agrupar no relatório (nomes fixos, nunca vindos do pedido)
const AGRUPAVEIS = { caminho: Prisma.raw('caminho'), origem: Prisma.raw('origem'), dispositivo: Prisma.raw('dispositivo'), navegador: Prisma.raw('navegador') }

// estatísticas de visitas ao site (sem IP nem agente completo)
export class RepositorioVisitas {
  constructor({ prisma, fuso }) {
    this.prisma = prisma
    this.fuso = fuso
  }

  async registar({ visitante, caminho, origem, dispositivo, navegador }) {
    await this.prisma.visita.create({ data: { visitante, caminho, origem, dispositivo, navegador } })
  }

  async resumo(dias) {
    const [r] = await this.prisma.$queryRaw`
      SELECT COUNT(*)::int paginas, COUNT(DISTINCT visitante)::int visitantes FROM visitas WHERE data >= now() - make_interval(days => ${dias})`
    return r
  }

  async hoje() {
    const [r] = await this.prisma.$queryRaw`
      SELECT COUNT(*)::int paginas, COUNT(DISTINCT visitante)::int visitantes FROM visitas
      WHERE (data AT TIME ZONE ${this.fuso})::date = (now() AT TIME ZONE ${this.fuso})::date`
    return r
  }

  async online() {
    const [r] = await this.prisma.$queryRaw`SELECT COUNT(DISTINCT visitante)::int n FROM visitas WHERE data >= now() - interval '5 minutes'`
    return r.n
  }

  visitantesPorDia(dias = 14) {
    return this.prisma.$queryRaw`
      SELECT to_char((data AT TIME ZONE ${this.fuso})::date, 'YYYY-MM-DD') dia, COUNT(DISTINCT visitante)::int n FROM visitas
      WHERE data >= now() - make_interval(days => ${dias - 1}) GROUP BY dia ORDER BY dia`
  }

  #top(campo, dias, limite = 8) {
    const coluna = AGRUPAVEIS[campo]
    return this.prisma.$queryRaw`
      SELECT ${coluna} valor, COUNT(*)::int paginas, COUNT(DISTINCT visitante)::int visitantes FROM visitas
      WHERE data >= now() - make_interval(days => ${dias}) AND ${coluna} IS NOT NULL
      GROUP BY ${coluna} ORDER BY paginas DESC LIMIT ${limite}`
  }

  async relatorio(dias) {
    const p = this.prisma
    const [totais, [{ n: sessoes }], [{ n: recorrentes }], online, porDia, porHora, paginas, origens, dispositivos, navegadores] = await Promise.all([
      this.resumo(dias),
      p.$queryRaw`SELECT COUNT(*)::int n FROM (SELECT DISTINCT visitante, (data AT TIME ZONE ${this.fuso})::date FROM visitas WHERE data >= now() - make_interval(days => ${dias})) s`,
      p.$queryRaw`SELECT COUNT(DISTINCT visitante)::int n FROM visitas WHERE data >= now() - make_interval(days => ${dias})
        AND visitante IN (SELECT visitante FROM visitas WHERE data < now() - make_interval(days => ${dias}))`,
      this.online(),
      p.$queryRaw`SELECT to_char((data AT TIME ZONE ${this.fuso})::date, 'YYYY-MM-DD') dia, COUNT(*)::int paginas, COUNT(DISTINCT visitante)::int visitantes
        FROM visitas WHERE data >= now() - make_interval(days => ${dias}) GROUP BY dia ORDER BY dia`,
      p.$queryRaw`SELECT EXTRACT(HOUR FROM data AT TIME ZONE ${this.fuso})::int hora, COUNT(*)::int paginas
        FROM visitas WHERE data >= now() - make_interval(days => ${dias}) GROUP BY hora ORDER BY hora`,
      this.#top('caminho', dias, 12),
      this.#top('origem', dias),
      this.#top('dispositivo', dias),
      this.#top('navegador', dias),
    ])
    return {
      dias,
      totais: { ...totais, sessoes, recorrentes, paginasPorVisita: sessoes ? +(totais.paginas / sessoes).toFixed(1) : 0 },
      online, porDia, porHora, paginas, origens, dispositivos, navegadores,
    }
  }
}
