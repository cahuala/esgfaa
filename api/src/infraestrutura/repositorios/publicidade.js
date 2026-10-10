const CAMPOS = { impressao: 'impressoes', clique: 'cliques' }

export class RepositorioPublicidade {
  constructor({ bd }) {
    this.bd = bd
  }

  contar(bannerId, tipo) {
    const campo = CAMPOS[tipo]
    if (!campo) return
    this.bd.prepare(`INSERT INTO publicidade_metricas (banner_id, dia, ${campo}) VALUES (?, date('now'), 1)
      ON CONFLICT (banner_id, dia) DO UPDATE SET ${campo} = ${campo} + 1`).run(bannerId)
  }

  // { bannerId: { impressoes, cliques } }
  metricas() {
    const linhas = this.bd.prepare('SELECT banner_id, SUM(impressoes) impressoes, SUM(cliques) cliques FROM publicidade_metricas GROUP BY banner_id').all()
    return Object.fromEntries(linhas.map((l) => [l.banner_id, { impressoes: l.impressoes, cliques: l.cliques }]))
  }
}
