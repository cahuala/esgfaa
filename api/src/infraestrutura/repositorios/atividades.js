// registo de auditoria: tudo o que os utilizadores do painel fazem
export class RepositorioAtividades {
  constructor({ bd }) {
    this.bd = bd
  }

  registar({ utilizadorId, utilizadorNome, acao, colecao, alvoId, alvoTitulo, detalhes, ip, agente }) {
    this.bd.prepare(`INSERT INTO atividades (utilizador_id, utilizador_nome, acao, colecao, alvo_id, alvo_titulo, detalhes, ip, agente)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      utilizadorId ?? null, utilizadorNome ?? null, acao, colecao ?? null, alvoId == null ? null : String(alvoId),
      alvoTitulo ?? null, detalhes == null ? null : (typeof detalhes === 'string' ? detalhes : JSON.stringify(detalhes)),
      ip ?? null, agente ? String(agente).slice(0, 300) : null,
    )
  }

  listar({ utilizador, acao, colecao, desde, ate, q, pagina = 1, porPagina = 25 }) {
    const condicoes = []
    const params = []
    if (utilizador) { condicoes.push('utilizador_id = ?'); params.push(Number(utilizador)) }
    if (acao) { condicoes.push('acao = ?'); params.push(acao) }
    if (colecao) { condicoes.push('colecao = ?'); params.push(colecao) }
    if (desde) { condicoes.push('date(data) >= date(?)'); params.push(desde) }
    if (ate) { condicoes.push('date(data) <= date(?)'); params.push(ate) }
    if (q) {
      const termo = `%${q.replace(/[%_]/g, (c) => `\\${c}`)}%`
      condicoes.push("(alvo_titulo LIKE ? ESCAPE '\\' OR detalhes LIKE ? ESCAPE '\\' OR ip LIKE ? ESCAPE '\\')")
      params.push(termo, termo, termo)
    }
    const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : ''
    const total = this.bd.prepare(`SELECT COUNT(*) n FROM atividades ${where}`).get(...params).n
    const linhas = this.bd.prepare(`SELECT * FROM atividades ${where} ORDER BY id DESC LIMIT ? OFFSET ?`)
      .all(...params, porPagina, (pagina - 1) * porPagina).map((l) => ({ ...l }))
    const acoes = this.bd.prepare('SELECT DISTINCT acao FROM atividades ORDER BY acao').all().map((a) => a.acao)
    return { total, pagina, porPagina, linhas, acoes }
  }

  ultimas({ utilizadorId = null, limite = 8 } = {}) {
    const linhas = utilizadorId == null
      ? this.bd.prepare('SELECT * FROM atividades ORDER BY id DESC LIMIT ?').all(limite)
      : this.bd.prepare('SELECT * FROM atividades WHERE utilizador_id = ? ORDER BY id DESC LIMIT ?').all(utilizadorId, limite)
    return linhas.map((l) => ({ ...l }))
  }

  contarPorUtilizador() {
    return Object.fromEntries(this.bd.prepare('SELECT utilizador_id, COUNT(*) n FROM atividades GROUP BY utilizador_id').all().map((l) => [l.utilizador_id, l.n]))
  }
}
