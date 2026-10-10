// estatísticas de visitas ao site (sem IP nem agente completo)
export class RepositorioVisitas {
  constructor({ bd }) {
    this.bd = bd
  }

  registar({ visitante, caminho, origem, dispositivo, navegador }) {
    this.bd.prepare('INSERT INTO visitas (visitante, caminho, origem, dispositivo, navegador) VALUES (?, ?, ?, ?, ?)')
      .run(visitante, caminho, origem, dispositivo, navegador)
  }

  resumo(dias) {
    return { ...this.bd.prepare("SELECT COUNT(*) paginas, COUNT(DISTINCT visitante) visitantes FROM visitas WHERE data >= datetime('now', ?)").get(`-${dias} days`) }
  }

  hoje() {
    return { ...this.bd.prepare("SELECT COUNT(*) paginas, COUNT(DISTINCT visitante) visitantes FROM visitas WHERE date(data) = date('now')").get() }
  }

  online() {
    return this.bd.prepare("SELECT COUNT(DISTINCT visitante) n FROM visitas WHERE data >= datetime('now', '-5 minutes')").get().n
  }

  visitantesPorDia(dias = 14) {
    return this.bd.prepare(`SELECT date(data) dia, COUNT(DISTINCT visitante) n FROM visitas WHERE data >= datetime('now', ?) GROUP BY dia ORDER BY dia`)
      .all(`-${dias - 1} days`).map((l) => ({ ...l }))
  }

  relatorio(dias) {
    const desde = `-${dias} days`
    const top = (campo, limite = 8) => this.bd.prepare(`
      SELECT ${campo} valor, COUNT(*) paginas, COUNT(DISTINCT visitante) visitantes FROM visitas
      WHERE data >= datetime('now', ?) AND ${campo} IS NOT NULL GROUP BY ${campo} ORDER BY paginas DESC LIMIT ${limite}`).all(desde).map((l) => ({ ...l }))
    const totais = this.resumo(dias)
    const sessoes = this.bd.prepare("SELECT COUNT(*) n FROM (SELECT DISTINCT visitante, date(data) FROM visitas WHERE data >= datetime('now', ?))").get(desde).n
    const recorrentes = this.bd.prepare(`SELECT COUNT(DISTINCT visitante) n FROM visitas WHERE data >= datetime('now', ?)
      AND visitante IN (SELECT visitante FROM visitas WHERE data < datetime('now', ?))`).get(desde, desde).n
    return {
      dias,
      totais: { ...totais, sessoes, recorrentes, paginasPorVisita: sessoes ? +(totais.paginas / sessoes).toFixed(1) : 0 },
      online: this.online(),
      porDia: this.bd.prepare(`SELECT date(data) dia, COUNT(*) paginas, COUNT(DISTINCT visitante) visitantes FROM visitas
        WHERE data >= datetime('now', ?) GROUP BY dia ORDER BY dia`).all(desde).map((l) => ({ ...l })),
      porHora: this.bd.prepare(`SELECT CAST(strftime('%H', data, 'localtime') AS INTEGER) hora, COUNT(*) paginas FROM visitas
        WHERE data >= datetime('now', ?) GROUP BY hora ORDER BY hora`).all(desde).map((l) => ({ ...l })),
      paginas: top('caminho', 12),
      origens: top('origem'),
      dispositivos: top('dispositivo'),
      navegadores: top('navegador'),
    }
  }
}
