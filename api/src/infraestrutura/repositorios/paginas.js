export class RepositorioPaginas {
  constructor({ bd }) {
    this.bd = bd
  }

  ler(chave) {
    const l = this.bd.prepare('SELECT dados FROM paginas WHERE chave = ?').get(chave)
    return l ? JSON.parse(l.dados) : null
  }

  guardar(chave, dados, autorId) {
    this.bd.prepare(`INSERT INTO paginas (chave, dados, atualizado_por) VALUES (?, ?, ?)
      ON CONFLICT (chave) DO UPDATE SET dados = excluded.dados, atualizado_em = datetime('now'), atualizado_por = excluded.atualizado_por`)
      .run(chave, JSON.stringify(dados), autorId)
  }

  semear(chave, dados) {
    this.bd.prepare('INSERT OR IGNORE INTO paginas (chave, dados) VALUES (?, ?)').run(chave, JSON.stringify(dados))
  }
}
