import { Conflito, ErroValidacao, NaoEncontrado, SemPermissao } from '../dominio/comum/erros.js'
import { normalizarEmail } from '../dominio/identidade/email.js'
import { ADMINISTRADOR } from '../dominio/identidade/permissoes.js'
import { validarSenha } from '../dominio/identidade/politicaSenha.js'
import { Utilizador } from '../dominio/identidade/utilizador.js'

// Gestão das contas do painel
export class ServicoUtilizadores {
  constructor({ utilizadores, papeis, atividades, cifra, auditoria, transacao }) {
    Object.assign(this, { utilizadores, papeis, atividades, cifra, auditoria, transacao })
  }

  listar(ctx) {
    ctx.actor.exigir('utilizadores.ver')
    const porId = this.atividades.contarPorUtilizador()
    return this.utilizadores.listar().map((u) => ({ ...u.publico(), atividades: porId[u.id] || 0 }))
  }

  // só quem gere papéis pode atribuir o papel de Administrador
  #garantirPapel(ctx, papel) {
    if (!papel || !this.papeis.existe(papel)) throw new ErroValidacao('Papel inválido.')
    if (papel === ADMINISTRADOR && !ctx.actor.pode('papeis.gerir')) throw new SemPermissao('Não pode atribuir o papel de Administrador.')
  }

  async criar(ctx, { nome, email, papel, senha }) {
    ctx.actor.exigir('utilizadores.criar')
    this.#garantirPapel(ctx, papel)
    const emailLimpo = normalizarEmail(email)
    validarSenha(senha, { email: emailLimpo, nome })
    if (this.utilizadores.emailEmUso(emailLimpo)) throw new Conflito('Já existe um utilizador com este e-mail.')

    // a palavra-passe foi escolhida por outra pessoa: o novo utilizador deve mudá-la ao entrar
    const novo = Utilizador.novo({ nome, email: emailLimpo, papel, senhaCifrada: await this.cifra.cifrar(senha), deveMudarSenha: true })
    const u = this.utilizadores.criar(novo)
    this.auditoria.registar(ctx, { acao: 'criar_utilizador', colecao: 'utilizadores', alvoId: u.id, alvoTitulo: u.nome, detalhes: { email: u.email, papel } })
    return u.publico()
  }

  async editar(ctx, id, { nome, email, papel, ativo, senha }) {
    ctx.actor.exigir('utilizadores.editar')
    const u = this.utilizadores.porId(id)
    if (!u) throw new NaoEncontrado('Utilizador não encontrado.')
    const proprio = u.id === ctx.actor.id
    const antes = { ...u }

    // quem não gere papéis não mexe em contas de administradores
    if (u.papel === ADMINISTRADOR && !ctx.actor.pode('papeis.gerir')) throw new SemPermissao('Só um administrador pode alterar outro administrador.')
    if (papel !== undefined) this.#garantirPapel(ctx, papel)
    if (proprio && ativo === false) throw new ErroValidacao('Não pode desativar a sua própria conta.')
    if (proprio && papel && papel !== u.papel) throw new ErroValidacao('Não pode mudar o seu próprio papel.')

    // impede que o sistema fique sem administradores ativos
    const tiraAdmin = u.papel === ADMINISTRADOR && ((papel && papel !== ADMINISTRADOR) || ativo === false)
    if (tiraAdmin && this.utilizadores.contarAdministradoresAtivos({ exceto: u.id }) === 0) {
      throw new ErroValidacao('Tem de existir pelo menos um administrador ativo.')
    }

    if (nome !== undefined) u.definirNome(nome)
    if (email !== undefined) {
      const e = normalizarEmail(email)
      if (e !== u.email && this.utilizadores.emailEmUso(e, { exceto: u.id })) throw new Conflito('Já existe um utilizador com este e-mail.')
      u.email = e
    }
    if (papel) u.papel = papel
    if (ativo !== undefined) u.ativo = Boolean(ativo)
    if (senha) {
      validarSenha(senha, { email: u.email, nome: u.nome })
      u.mudarSenha(await this.cifra.cifrar(senha))
      if (!proprio) u.deveMudarSenha = true
      u.tentativasFalhadas = 0
      u.bloqueadoAte = null
    }

    // mudar o papel ou desativar termina as sessões abertas dessa conta
    if (!senha && (u.papel !== antes.papel || (antes.ativo && !u.ativo))) u.invalidarSessoes()

    const mudancas = ['nome', 'email', 'papel', 'ativo'].filter((k) => String(u[k]) !== String(antes[k]))
    if (senha) mudancas.push('palavra-passe')
    const guardado = this.utilizadores.guardar(u)
    this.auditoria.registar(ctx, { acao: 'editar_utilizador', colecao: 'utilizadores', alvoId: u.id, alvoTitulo: u.nome, detalhes: { campos: mudancas } })
    return guardado.publico()
  }
}
