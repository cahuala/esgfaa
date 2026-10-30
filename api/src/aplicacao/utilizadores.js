import { Conflito, ErroValidacao, NaoEncontrado, SemPermissao } from '../dominio/comum/erros.js'
import { normalizarEmail } from '../dominio/identidade/email.js'
import { ADMINISTRADOR } from '../dominio/identidade/permissoes.js'
import { validarSenha } from '../dominio/identidade/politicaSenha.js'
import { Utilizador } from '../dominio/identidade/utilizador.js'

/*
  Gestão das contas do painel. Uma conta nova ou uma mudança de papel só vale quando o Comandante
  (permissão «utilizadores.aprovar») aprova: a conta fica desativada, e o papel antigo mantém-se, até lá.
  Enquanto não houver ninguém ativo que possa aprovar (instalação nova), vale logo.
*/
export class ServicoUtilizadores {
  constructor({ utilizadores, papeis, atividades, cifra, auditoria, relogio }) {
    Object.assign(this, { utilizadores, papeis, atividades, cifra, auditoria, relogio })
  }

  // o pedido fica à espera do Comandante? (quem aprova decide logo; sem ninguém que aprove, também)
  async #precisaAprovacao(ctx) {
    if (ctx.actor.pode('utilizadores.aprovar')) return false
    const aprovam = (await this.papeis.listar()).filter((p) => p.permissoes.includes('utilizadores.aprovar')).map((p) => p.id)
    return this.utilizadores.haAtivoComPapel(aprovam)
  }

  #pedido(ctx, extra) {
    return { ...extra, pedidoPor: ctx.actor.nome ?? null, pedidoPorId: ctx.actor.id ?? null, pedidoEm: (this.relogio?.agora?.() ?? new Date()).toISOString() }
  }

  async listar(ctx) {
    ctx.actor.exigir('utilizadores.ver')
    const [lista, porId] = await Promise.all([this.utilizadores.listar(), this.atividades.contarPorUtilizador()])
    return lista.map((u) => ({ ...u.publico(), atividades: porId[u.id] || 0 }))
  }

  // só quem gere papéis pode atribuir o papel de Administrador
  async #garantirPapel(ctx, papel) {
    if (!papel || !(await this.papeis.existe(papel))) throw new ErroValidacao('Papel inválido.')
    if (papel === ADMINISTRADOR && !ctx.actor.pode('papeis.gerir')) throw new SemPermissao('Não pode atribuir o papel de Administrador.')
  }

  async criar(ctx, { nome, email, papel, senha }) {
    ctx.actor.exigir('utilizadores.criar')
    await this.#garantirPapel(ctx, papel)
    const emailLimpo = normalizarEmail(email)
    validarSenha(senha, { email: emailLimpo, nome })
    if (await this.utilizadores.emailEmUso(emailLimpo)) throw new Conflito('Já existe um utilizador com este e-mail.')

    // a palavra-passe foi escolhida por outra pessoa: o novo utilizador deve mudá-la ao entrar
    const novo = Utilizador.novo({ nome, email: emailLimpo, papel, senhaCifrada: await this.cifra.cifrar(senha), deveMudarSenha: true })
    if (await this.#precisaAprovacao(ctx)) {
      novo.ativo = false
      novo.aprovacao = this.#pedido(ctx, { tipo: 'criar', papel })
    }
    const u = await this.utilizadores.criar(novo)
    await this.auditoria.registar(ctx, { acao: u.aprovacao ? 'pedir_aprovacao_conta' : 'criar_utilizador', colecao: 'utilizadores', alvoId: u.id, alvoTitulo: u.nome, detalhes: { email: u.email, papel } })
    return u.publico()
  }

  async editar(ctx, id, { nome, email, papel, ativo, senha }) {
    ctx.actor.exigir('utilizadores.editar')
    const u = await this.utilizadores.porId(id)
    if (!u) throw new NaoEncontrado('Utilizador não encontrado.')
    const proprio = u.id === ctx.actor.id
    const antes = { ...u }

    // quem não gere papéis não mexe em contas de administradores
    if (u.papel === ADMINISTRADOR && !ctx.actor.pode('papeis.gerir')) throw new SemPermissao('Só um administrador pode alterar outro administrador.')
    if (papel !== undefined) await this.#garantirPapel(ctx, papel)
    if (proprio && ativo === false) throw new ErroValidacao('Não pode desativar a sua própria conta.')
    if (proprio && papel && papel !== u.papel) throw new ErroValidacao('Não pode mudar o seu próprio papel.')

    // impede que o sistema fique sem administradores ativos
    const tiraAdmin = u.papel === ADMINISTRADOR && ((papel && papel !== ADMINISTRADOR) || ativo === false)
    if (tiraAdmin && (await this.utilizadores.contarAdministradoresAtivos({ exceto: u.id })) === 0) {
      throw new ErroValidacao('Tem de existir pelo menos um administrador ativo.')
    }

    // à espera do Comandante: não se ativa antes da decisão
    if (u.aprovacao?.tipo === 'criar' && ativo && !ctx.actor.pode('utilizadores.aprovar')) throw new ErroValidacao('A conta espera a aprovação do Comandante.')
    let pedePapel = null
    if (papel && papel !== u.papel && (await this.#precisaAprovacao(ctx))) {
      pedePapel = papel
      papel = undefined
    }

    if (nome !== undefined) u.definirNome(nome)
    if (email !== undefined) {
      const e = normalizarEmail(email)
      if (e !== u.email && (await this.utilizadores.emailEmUso(e, { exceto: u.id }))) throw new Conflito('Já existe um utilizador com este e-mail.')
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
    // o papel novo fica pedido (uma conta ainda por aprovar só muda o papel pedido)
    if (pedePapel) u.aprovacao = u.aprovacao?.tipo === 'criar' ? { ...u.aprovacao, papel: pedePapel } : this.#pedido(ctx, { tipo: 'papel', papel: pedePapel, de: u.papel })
    else if (papel && u.aprovacao?.tipo === 'papel') u.aprovacao = null // quem aprova mudou-o diretamente
    const guardado = await this.utilizadores.guardar(u)
    if (mudancas.length || !pedePapel) await this.auditoria.registar(ctx, { acao: 'editar_utilizador', colecao: 'utilizadores', alvoId: u.id, alvoTitulo: u.nome, detalhes: { campos: mudancas } })
    if (pedePapel) await this.auditoria.registar(ctx, { acao: 'pedir_mudanca_papel', colecao: 'utilizadores', alvoId: u.id, alvoTitulo: u.nome, detalhes: { de: antes.papel, para: pedePapel } })
    return guardado.publico()
  }

  // o Comandante aprova ou recusa a conta nova ou a mudança de papel
  async decidir(ctx, id, { decisao, motivo = '' }) {
    ctx.actor.exigir('utilizadores.aprovar')
    if (!['aprovar', 'recusar'].includes(decisao)) throw new ErroValidacao('Decisão inválida.')
    const u = await this.utilizadores.porId(id)
    if (!u) throw new NaoEncontrado('Utilizador não encontrado.')
    const a = u.aprovacao
    if (!a) throw new ErroValidacao('Esta conta não tem nada à espera de aprovação.')
    if (u.id === ctx.actor.id) throw new ErroValidacao('Não decide sobre a sua própria conta.')
    if (decisao === 'aprovar') {
      if (!(await this.papeis.existe(a.papel))) throw new ErroValidacao('O papel pedido já não existe.')
      u.papel = a.papel
      if (a.tipo === 'criar') u.ativo = true
      else u.invalidarSessoes()
    }
    const acao = `${decisao === 'aprovar' ? 'aprovar' : 'recusar'}_${a.tipo === 'criar' ? 'conta' : 'mudanca_papel'}`
    await this.auditoria.registar(ctx, { acao, colecao: 'utilizadores', alvoId: u.id, alvoTitulo: u.nome, detalhes: { email: u.email, papel: a.papel, ...(a.de ? { de: a.de } : {}), pedidoPor: a.pedidoPor, ...(motivo ? { motivo: String(motivo).slice(0, 500) } : {}) } })
    // a conta nova recusada não fica (nunca foi usada); a mudança de papel recusada deixa o papel como estava
    if (decisao === 'recusar' && a.tipo === 'criar') {
      await this.utilizadores.apagar(u.id)
      return { ...u.publico(), apagada: true }
    }
    u.aprovacao = null
    return (await this.utilizadores.guardar(u)).publico()
  }

  contarPorAprovar(ctx) {
    return ctx.actor.pode('utilizadores.aprovar') ? this.utilizadores.contarPorAprovar() : 0
  }
}
