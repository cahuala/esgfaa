import { Papel } from '../../dominio/identidade/papel.js'

const paraEntidade = (l, utilizadores = 0) => l && new Papel({
  id: l.id, nome: l.nome, descricao: l.descricao, permissoes: JSON.parse(l.permissoes), sistema: Boolean(l.sistema), utilizadores,
})

export class RepositorioPapeis {
  constructor({ bd }) {
    this.bd = bd
  }

  porId(id) {
    return paraEntidade(this.bd.prepare('SELECT * FROM papeis WHERE id = ?').get(String(id)))
  }

  existe(id) {
    return Boolean(this.bd.prepare('SELECT 1 FROM papeis WHERE id = ?').get(String(id)))
  }

  listar(utilizadoresPorPapel = {}) {
    return this.bd.prepare('SELECT * FROM papeis ORDER BY sistema DESC, nome').all().map((l) => paraEntidade(l, utilizadoresPorPapel[l.id] || 0))
  }

  criar(p) {
    this.bd.prepare('INSERT INTO papeis (id, nome, descricao, permissoes, sistema) VALUES (?, ?, ?, ?, ?)')
      .run(p.id, p.nome, p.descricao || '', JSON.stringify(p.permissoes), p.sistema ? 1 : 0)
  }

  // garante os papéis por omissão sem apagar alterações feitas no painel
  garantir(p) {
    this.bd.prepare('INSERT OR IGNORE INTO papeis (id, nome, descricao, permissoes, sistema) VALUES (?, ?, ?, ?, ?)')
      .run(p.id, p.nome, p.descricao || '', JSON.stringify(p.permissoes), p.sistema ? 1 : 0)
  }

  guardar(p) {
    this.bd.prepare('UPDATE papeis SET nome = ?, descricao = ?, permissoes = ?, sistema = ? WHERE id = ?')
      .run(p.nome, p.descricao || '', JSON.stringify(p.permissoes), p.sistema ? 1 : 0, p.id)
  }

  apagar(id) {
    this.bd.prepare('DELETE FROM papeis WHERE id = ?').run(id)
  }
}
