// sessões terminadas antes de expirarem (o token deixa de ser aceite)
export class RepositorioSessoes {
  constructor({ bd }) {
    this.bd = bd
  }

  revogar(jti, expiraEm) {
    this.bd.prepare("DELETE FROM sessoes_revogadas WHERE expira < datetime('now')").run()
    this.bd.prepare('INSERT OR IGNORE INTO sessoes_revogadas (jti, expira) VALUES (?, ?)').run(jti, expiraEm)
  }

  revogada(jti) {
    return Boolean(this.bd.prepare('SELECT 1 FROM sessoes_revogadas WHERE jti = ?').get(jti))
  }
}
