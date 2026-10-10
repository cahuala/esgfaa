import { ADMINISTRADOR, TODAS, limparPermissoes } from './permissoes.js'
import { ErroValidacao, SemPermissao } from '../comum/erros.js'
import { limparTexto } from '../comum/texto.js'

// Papel (RBAC): conjunto de permissões atribuído a utilizadores
export class Papel {
  constructor({ id, nome, descricao = '', permissoes = [], sistema = false, utilizadores = 0 }) {
    this.id = id
    this.nome = nome
    this.descricao = descricao
    this.sistema = Boolean(sistema)
    // o administrador tem sempre todas as permissões, independentemente do que está guardado
    this.permissoes = id === ADMINISTRADOR ? [...TODAS] : limparPermissoes(permissoes)
    this.utilizadores = utilizadores
  }

  pode(permissao) {
    return this.permissoes.includes(permissao)
  }

  alterar({ nome, descricao, permissoes }) {
    if (this.sistema) throw new SemPermissao('O papel de Administrador tem sempre acesso total e não pode ser alterado.')
    if (nome !== undefined) {
      const n = limparTexto(nome)
      if (n.length < 2 || n.length > 60) throw new ErroValidacao('O nome do papel deve ter entre 2 e 60 caracteres.')
      this.nome = n
    }
    if (descricao !== undefined) this.descricao = limparTexto(descricao).slice(0, 300)
    if (permissoes !== undefined) this.permissoes = limparPermissoes(permissoes)
  }
}
