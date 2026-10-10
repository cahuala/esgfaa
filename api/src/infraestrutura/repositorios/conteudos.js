import { Conteudo } from '../../dominio/conteudos/conteudo.js'

const paraEntidade = (l) => l && new Conteudo({
  colecao: l.colecao, id: l.id, dados: JSON.parse(l.dados), estado: l.estado, ordem: l.ordem,
  criadoEm: l.criado_em, atualizadoEm: l.atualizado_em, editadoPor: l.autor_edicao ?? null,
})

const SELECAO = `SELECT i.*, u.nome autor_edicao FROM itens i LEFT JOIN utilizadores u ON u.id = i.atualizado_por`

export class RepositorioConteudos {
  constructor({ bd, transacao }) {
    this.bd = bd
    this.transacao = transacao
  }

  listar(colecao, { soPublicados = false } = {}) {
    return this.bd.prepare(`${SELECAO} WHERE i.colecao = ? ${soPublicados ? "AND i.estado = 'publicado'" : ''} ORDER BY i.ordem, i.criado_em`)
      .all(colecao).map(paraEntidade)
  }

  ler(colecao, id) {
    return paraEntidade(this.bd.prepare(`${SELECAO} WHERE i.colecao = ? AND i.id = ?`).get(colecao, String(id)))
  }

  existe(colecao, id) {
    return Boolean(this.bd.prepare('SELECT 1 FROM itens WHERE colecao = ? AND id = ?').get(colecao, String(id)))
  }

  publicadoExiste(colecao, id) {
    return Boolean(this.bd.prepare("SELECT 1 FROM itens WHERE colecao = ? AND id = ? AND estado = 'publicado'").get(colecao, String(id)))
  }

  contar(colecao, estado) {
    return this.bd.prepare('SELECT COUNT(*) n FROM itens WHERE colecao = ? AND estado = ?').get(colecao, estado).n
  }

  contarTodos() {
    return this.bd.prepare('SELECT COUNT(*) n FROM itens').get().n
  }

  proximaOrdem(colecao) {
    return this.bd.prepare('SELECT COALESCE(MAX(ordem), 0) + 1 n FROM itens WHERE colecao = ?').get(colecao).n
  }

  criar(c, autorId) {
    this.bd.prepare(`INSERT INTO itens (colecao, id, dados, ordem, estado, atualizado_por, criado_por) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(c.colecao, c.id, JSON.stringify(c.dados), c.ordem, c.estado, autorId, autorId)
    return this.ler(c.colecao, c.id)
  }

  // inserção da carga inicial (não substitui o que já existe)
  semear(c) {
    this.bd.prepare('INSERT OR IGNORE INTO itens (colecao, id, dados, ordem, estado) VALUES (?, ?, ?, ?, ?)')
      .run(c.colecao, c.id, JSON.stringify(c.dados), c.ordem, c.estado)
  }

  guardar(c, autorId) {
    this.bd.prepare(`UPDATE itens SET dados = ?, estado = ?, atualizado_em = datetime('now'), atualizado_por = ? WHERE colecao = ? AND id = ?`)
      .run(JSON.stringify(c.dados), c.estado, autorId, c.colecao, c.id)
    return this.ler(c.colecao, c.id)
  }

  // apaga o item e tudo o que lhe está associado
  apagar(colecao, id) {
    this.transacao(() => {
      this.bd.prepare('DELETE FROM itens WHERE colecao = ? AND id = ?').run(colecao, id)
      this.bd.prepare('DELETE FROM gostos WHERE colecao = ? AND item_id = ?').run(colecao, id)
      this.bd.prepare('DELETE FROM comentarios WHERE colecao = ? AND item_id = ?').run(colecao, id)
      this.bd.prepare('DELETE FROM visualizacoes WHERE colecao = ? AND item_id = ?').run(colecao, id)
      if (colecao === 'publicidade') this.bd.prepare('DELETE FROM publicidade_metricas WHERE banner_id = ?').run(id)
    })
  }

  reordenar(colecao, ids) {
    this.transacao(() => {
      const st = this.bd.prepare('UPDATE itens SET ordem = ? WHERE colecao = ? AND id = ?')
      ids.forEach((id, i) => st.run(i + 1, colecao, id))
    })
  }

  apagarTodos() {
    this.bd.exec('DELETE FROM itens; DELETE FROM paginas;')
  }
}
