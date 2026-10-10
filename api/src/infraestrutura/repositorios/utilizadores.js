import { Utilizador } from '../../dominio/identidade/utilizador.js'

const paraEntidade = (l) => l && new Utilizador({
  id: l.id, nome: l.nome, email: l.email, senha: l.senha, papel: l.papel, ativo: Boolean(l.ativo),
  criadoEm: l.criado_em, ultimoAcesso: l.ultimo_acesso, tentativasFalhadas: l.tentativas_falhadas,
  bloqueadoAte: l.bloqueado_ate, versaoToken: l.versao_token, deveMudarSenha: Boolean(l.deve_mudar_senha),
})

export class RepositorioUtilizadores {
  constructor({ bd }) {
    this.bd = bd
  }

  porId(id) {
    return paraEntidade(this.bd.prepare('SELECT * FROM utilizadores WHERE id = ?').get(Number(id)))
  }

  porEmail(email) {
    return paraEntidade(this.bd.prepare('SELECT * FROM utilizadores WHERE email = ?').get(String(email)))
  }

  listar() {
    return this.bd.prepare('SELECT * FROM utilizadores ORDER BY nome').all().map(paraEntidade)
  }

  contar() {
    return this.bd.prepare('SELECT COUNT(*) n FROM utilizadores').get().n
  }

  contarAtivos() {
    return this.bd.prepare('SELECT COUNT(*) n FROM utilizadores WHERE ativo = 1').get().n
  }

  contarAdministradoresAtivos({ exceto = null } = {}) {
    return this.bd.prepare("SELECT COUNT(*) n FROM utilizadores WHERE papel = 'administrador' AND ativo = 1 AND id != ?").get(exceto ?? -1).n
  }

  contarPorPapel() {
    return Object.fromEntries(this.bd.prepare('SELECT papel, COUNT(*) n FROM utilizadores GROUP BY papel').all().map((l) => [l.papel, l.n]))
  }

  emailEmUso(email, { exceto = null } = {}) {
    return Boolean(this.bd.prepare('SELECT 1 FROM utilizadores WHERE email = ? AND id != ?').get(email, exceto ?? -1))
  }

  criar(u) {
    const r = this.bd.prepare(`INSERT INTO utilizadores (nome, email, senha, papel, ativo, deve_mudar_senha)
      VALUES (?, ?, ?, ?, ?, ?)`).run(u.nome, u.email, u.senha, u.papel, u.ativo ? 1 : 0, u.deveMudarSenha ? 1 : 0)
    return this.porId(r.lastInsertRowid)
  }

  guardar(u) {
    this.bd.prepare(`UPDATE utilizadores SET nome = ?, email = ?, senha = ?, papel = ?, ativo = ?, ultimo_acesso = ?,
      tentativas_falhadas = ?, bloqueado_ate = ?, versao_token = ?, deve_mudar_senha = ? WHERE id = ?`)
      .run(u.nome, u.email, u.senha, u.papel, u.ativo ? 1 : 0, u.ultimoAcesso, u.tentativasFalhadas,
        u.bloqueadoAte, u.versaoToken, u.deveMudarSenha ? 1 : 0, u.id)
    return this.porId(u.id)
  }
}
