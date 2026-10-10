import { SemPermissao } from '../comum/erros.js'

// Quem está a fazer o pedido (utilizador autenticado + permissões do seu papel)
export class Actor {
  constructor({ id, nome, email, papel, permissoes = [] }) {
    this.id = id
    this.nome = nome
    this.email = email
    this.papel = papel
    this.permissoes = new Set(permissoes)
  }

  pode(permissao) {
    return this.permissoes.has(permissao)
  }

  podeAlguma(...permissoes) {
    return permissoes.some((p) => this.pode(p))
  }

  exigir(...permissoes) {
    if (!this.podeAlguma(...permissoes)) throw new SemPermissao()
  }
}
