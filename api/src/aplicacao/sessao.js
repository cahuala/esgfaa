import { NaoAutenticado, SemPermissao, ContaBloqueada, ErroValidacao } from '../dominio/comum/erros.js'
import { Actor } from '../dominio/identidade/actor.js'
import { motivoSenhaFraca, validarSenha } from '../dominio/identidade/politicaSenha.js'

const CREDENCIAIS_ERRADAS = 'E-mail ou palavra-passe incorretos.'

// Entrar, sair, sessão atual e mudança da própria palavra-passe
export class ServicoSessao {
  constructor({ utilizadores, papeis, sessoes, cifra, tokens, auditoria, relogio }) {
    Object.assign(this, { utilizadores, papeis, sessoes, cifra, tokens, auditoria, relogio })
  }

  async entrar(ctx, { email, senha }) {
    const emailLimpo = String(email || '').trim().toLowerCase().slice(0, 254)
    const u = emailLimpo ? this.utilizadores.porEmail(emailLimpo) : null
    const agora = this.relogio.agora()

    if (!u) {
      await this.cifra.verificarFicticio(senha) // mesmo tempo de resposta que uma conta existente
      this.auditoria.registar(ctx, { acao: 'falha_entrada', detalhes: { email: emailLimpo.slice(0, 120) }, utilizador: null })
      throw new NaoAutenticado(CREDENCIAIS_ERRADAS)
    }

    if (u.bloqueado(agora)) {
      await this.cifra.verificarFicticio(senha)
      this.auditoria.registar(ctx, { acao: 'falha_entrada', detalhes: 'conta bloqueada', utilizador: u })
      u.garantirPodeEntrar(agora)
    }

    if (!(await this.cifra.verificar(senha, u.senha))) {
      const bloqueou = u.registarFalha(agora)
      this.utilizadores.guardar(u)
      this.auditoria.registar(ctx, { acao: 'falha_entrada', detalhes: { email: emailLimpo.slice(0, 120) }, utilizador: u })
      if (bloqueou) {
        this.auditoria.registar(ctx, { acao: 'bloquear_conta', colecao: 'utilizadores', alvoId: u.id, alvoTitulo: u.nome, utilizador: u })
        throw new ContaBloqueada('Demasiadas tentativas falhadas. A conta ficou bloqueada durante 15 minutos.', u.bloqueadoAte)
      }
      throw new NaoAutenticado(CREDENCIAIS_ERRADAS)
    }

    if (!u.ativo) {
      this.auditoria.registar(ctx, { acao: 'falha_entrada', detalhes: 'conta desativada', utilizador: u })
      throw new SemPermissao('Esta conta está desativada. Contacte um administrador.')
    }

    u.registarEntrada(agora)
    // palavra-passe antiga que já não cumpre a política: pede-se que a mude
    if (motivoSenhaFraca(senha, { email: u.email, nome: u.nome })) u.deveMudarSenha = true
    this.utilizadores.guardar(u)
    this.auditoria.registar(ctx, { acao: 'entrar', utilizador: u })
    return { token: this.tokens.emitir(u), utilizador: u.publico() }
  }

  // valida o token e devolve quem está a fazer o pedido
  autenticar(token) {
    if (!token) throw new NaoAutenticado()
    const sessao = this.tokens.verificar(token)
    if (!sessao || this.sessoes.revogada(sessao.jti)) throw new NaoAutenticado('Sessão expirada. Entre novamente.')
    const u = this.utilizadores.porId(sessao.utilizadorId)
    if (!u || !u.ativo) throw new NaoAutenticado('Conta inexistente ou desativada.')
    if (u.versaoToken !== sessao.versao) throw new NaoAutenticado('A sessão foi terminada. Entre novamente.')
    // as permissões leem-se sempre da base: mudar um papel tem efeito imediato
    const papel = this.papeis.porId(u.papel)
    const actor = new Actor({ id: u.id, nome: u.nome, email: u.email, papel: u.papel, permissoes: papel?.permissoes || [] })
    return { actor, sessao }
  }

  eu(ctx) {
    const u = this.utilizadores.porId(ctx.actor.id)
    const papel = this.papeis.porId(u.papel)
    return { ...u.publico(), nomePapel: papel?.nome || u.papel, permissoes: [...ctx.actor.permissoes], deveMudarSenha: u.deveMudarSenha }
  }

  sair(ctx) {
    this.sessoes.revogar(ctx.sessao.jti, ctx.sessao.expira)
    this.auditoria.registar(ctx, { acao: 'sair' })
  }

  // muda a palavra-passe: as outras sessões terminam e devolve-se um token novo para esta
  async mudarSenha(ctx, { atual, nova }) {
    const u = this.utilizadores.porId(ctx.actor.id)
    if (!(await this.cifra.verificar(atual, u.senha))) throw new ErroValidacao('A palavra-passe atual está errada.')
    validarSenha(nova, { email: u.email, nome: u.nome })
    if (nova === atual) throw new ErroValidacao('A nova palavra-passe tem de ser diferente da atual.')
    u.mudarSenha(await this.cifra.cifrar(nova))
    this.utilizadores.guardar(u)
    this.sessoes.revogar(ctx.sessao.jti, ctx.sessao.expira)
    this.auditoria.registar(ctx, { acao: 'alterar_senha' })
    return { token: this.tokens.emitir(u) }
  }
}
