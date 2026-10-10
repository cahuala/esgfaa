import { ErroValidacao, NaoEncontrado } from '../dominio/comum/erros.js'
import { limparTexto, slugificar } from '../dominio/comum/texto.js'
import { Papel } from '../dominio/identidade/papel.js'
import { PAPEIS_PADRAO, RECURSOS, TODAS, ADMINISTRADOR, limparPermissoes } from '../dominio/identidade/permissoes.js'

// Papéis e permissões (RBAC)
export class ServicoPapeis {
  constructor({ papeis, utilizadores, auditoria }) {
    Object.assign(this, { papeis, utilizadores, auditoria })
  }

  // papéis por omissão (os editados no painel mantêm-se); o administrador tem sempre todas as permissões
  garantirPadrao() {
    for (const p of PAPEIS_PADRAO) this.papeis.garantir(p)
    const admin = this.papeis.porId(ADMINISTRADOR)
    this.papeis.guardar({ ...admin, permissoes: TODAS, sistema: true })
  }

  listar(ctx) {
    ctx.actor.exigir('papeis.ver', 'utilizadores.ver')
    const papeis = this.papeis.listar(this.utilizadores.contarPorPapel()).map((p) => ({
      id: p.id, nome: p.nome, descricao: p.descricao, sistema: p.sistema, permissoes: p.permissoes, utilizadores: p.utilizadores,
    }))
    return { papeis, recursos: RECURSOS }
  }

  criar(ctx, { nome, descricao, permissoes }) {
    ctx.actor.exigir('papeis.gerir')
    const n = limparTexto(nome)
    if (n.length < 2 || n.length > 60) throw new ErroValidacao('O nome do papel é obrigatório (2 a 60 caracteres).')
    const base = slugificar(n).replace(/-/g, '_').slice(0, 40)
    let id = base
    for (let i = 2; this.papeis.existe(id); i++) id = `${base}_${i}`
    const papel = new Papel({ id, nome: n, descricao: limparTexto(descricao).slice(0, 300), permissoes: limparPermissoes(permissoes) })
    this.papeis.criar(papel)
    this.auditoria.registar(ctx, { acao: 'criar_papel', colecao: 'papeis', alvoId: id, alvoTitulo: n, detalhes: { permissoes: papel.permissoes.length } })
    return { id }
  }

  editar(ctx, id, { nome, descricao, permissoes }) {
    ctx.actor.exigir('papeis.gerir')
    const p = this.papeis.porId(id)
    if (!p) throw new NaoEncontrado('Papel não encontrado.')
    if (p.sistema) throw new ErroValidacao('O papel de Administrador tem sempre acesso total e não pode ser alterado.')
    const antes = [...p.permissoes]
    p.alterar({ nome, descricao, permissoes })
    this.papeis.guardar(p)
    this.auditoria.registar(ctx, {
      acao: 'editar_papel', colecao: 'papeis', alvoId: p.id, alvoTitulo: p.nome,
      detalhes: { acrescentadas: p.permissoes.filter((x) => !antes.includes(x)), retiradas: antes.filter((x) => !p.permissoes.includes(x)) },
    })
  }

  apagar(ctx, id) {
    ctx.actor.exigir('papeis.gerir')
    const p = this.papeis.porId(id)
    if (!p) throw new NaoEncontrado('Papel não encontrado.')
    if (p.sistema) throw new ErroValidacao('O papel de Administrador não pode ser apagado.')
    const emUso = this.utilizadores.contarPorPapel()[p.id] || 0
    if (emUso) throw new ErroValidacao(`Este papel está atribuído a ${emUso} utilizador(es). Mude-lhes o papel primeiro.`)
    this.papeis.apagar(p.id)
    this.auditoria.registar(ctx, { acao: 'apagar_papel', colecao: 'papeis', alvoId: p.id, alvoTitulo: p.nome })
  }
}
