export class RepositorioInteracoes {
  constructor({ bd }) {
    this.bd = bd
  }

  resumo(colecao, id, visitante) {
    const gostos = this.bd.prepare('SELECT COUNT(*) n FROM gostos WHERE colecao = ? AND item_id = ?').get(colecao, id).n
    const gostei = visitante ? Boolean(this.bd.prepare('SELECT 1 FROM gostos WHERE colecao = ? AND item_id = ? AND visitante = ?').get(colecao, id, visitante)) : false
    const comentarios = this.bd.prepare('SELECT id, nome, texto, data FROM comentarios WHERE colecao = ? AND item_id = ? ORDER BY data DESC, id DESC').all(colecao, id)
    const visualizacoes = this.bd.prepare('SELECT total FROM visualizacoes WHERE colecao = ? AND item_id = ?').get(colecao, id)?.total || 0
    return { gostos, gostei, comentarios: comentarios.map((c) => ({ ...c })), visualizacoes }
  }

  alternarGosto(colecao, id, visitante) {
    const existe = this.bd.prepare('SELECT 1 FROM gostos WHERE colecao = ? AND item_id = ? AND visitante = ?').get(colecao, id, visitante)
    if (existe) this.bd.prepare('DELETE FROM gostos WHERE colecao = ? AND item_id = ? AND visitante = ?').run(colecao, id, visitante)
    else this.bd.prepare('INSERT INTO gostos (colecao, item_id, visitante) VALUES (?, ?, ?)').run(colecao, id, visitante)
  }

  comentar(colecao, id, { nome, texto }, ip) {
    this.bd.prepare('INSERT INTO comentarios (colecao, item_id, nome, texto, ip) VALUES (?, ?, ?, ?, ?)').run(colecao, id, nome, texto, ip)
  }

  contarVisualizacao(colecao, id) {
    this.bd.prepare(`INSERT INTO visualizacoes (colecao, item_id, total) VALUES (?, ?, 1)
      ON CONFLICT (colecao, item_id) DO UPDATE SET total = total + 1`).run(colecao, id)
  }

  comentario(id) {
    const c = this.bd.prepare('SELECT * FROM comentarios WHERE id = ?').get(Number(id))
    return c ? { ...c } : null
  }

  listarComentarios({ limite = 500 } = {}) {
    return this.bd.prepare('SELECT * FROM comentarios ORDER BY data DESC, id DESC LIMIT ?').all(limite).map((c) => ({ ...c }))
  }

  apagarComentario(id) {
    this.bd.prepare('DELETE FROM comentarios WHERE id = ?').run(Number(id))
  }

  // { 'noticias/slug': { gostos, comentarios, visualizacoes } }
  porItem() {
    const mapa = {}
    const juntar = (linhas, campo) => linhas.forEach((l) => {
      const k = `${l.colecao}/${l.item_id}`
      mapa[k] = { gostos: 0, comentarios: 0, visualizacoes: 0, ...mapa[k], [campo]: l.total }
    })
    juntar(this.bd.prepare('SELECT colecao, item_id, COUNT(*) total FROM gostos GROUP BY colecao, item_id').all(), 'gostos')
    juntar(this.bd.prepare('SELECT colecao, item_id, COUNT(*) total FROM comentarios GROUP BY colecao, item_id').all(), 'comentarios')
    juntar(this.bd.prepare('SELECT colecao, item_id, total FROM visualizacoes').all(), 'visualizacoes')
    return mapa
  }

  totais() {
    const n = (sql) => this.bd.prepare(sql).get().n
    return {
      gostos: n('SELECT COUNT(*) n FROM gostos'),
      comentarios: n('SELECT COUNT(*) n FROM comentarios'),
      visualizacoes: n('SELECT COALESCE(SUM(total), 0) n FROM visualizacoes'),
      comentariosHoje: n("SELECT COUNT(*) n FROM comentarios WHERE date(data) = date('now')"),
    }
  }

  comentariosPorDia(dias = 14) {
    return this.bd.prepare(`SELECT date(data) dia, COUNT(*) n FROM comentarios WHERE data >= datetime('now', ?) GROUP BY dia ORDER BY dia`)
      .all(`-${dias - 1} days`).map((l) => ({ ...l }))
  }
}
