import { NaoAutenticado, SemPermissao, ContaBloqueada, ErroValidacao, CodigoEmFalta } from '../dominio/comum/erros.js'
import { Actor } from '../dominio/identidade/actor.js'
import { MAX_TENTATIVAS, MINUTOS_BLOQUEIO } from '../dominio/identidade/utilizador.js'
import { motivoSenhaFraca, validarSenha } from '../dominio/identidade/politicaSenha.js'

const CREDENCIAIS_ERRADAS = 'E-mail ou palavra-passe incorretos.'
const bloqueada = (ate) => new ContaBloqueada(`Conta bloqueada por excesso de tentativas. Tente de novo dentro de ${MINUTOS_BLOQUEIO} minutos.`, ate)

// Entrar, sair, sessão atual e mudança da própria palavra-passe
export class ServicoSessao {
  constructor({ utilizadores, papeis, sessoes, cifra, tokens, auditoria, relogio, doisFatores = null }) {
    Object.assign(this, { utilizadores, papeis, sessoes, cifra, tokens, auditoria, relogio, doisFatores })
  }

  async entrar(ctx, { email, senha, codigo }) {
    const emailLimpo = String(email || '').trim().toLowerCase().slice(0, 254)
    const u = emailLimpo ? await this.utilizadores.porEmail(emailLimpo) : null
    const agora = this.relogio.agora()

    if (!u) {
      await this.cifra.verificarFicticio(senha) // mesmo tempo de resposta que uma conta existente
      await this.auditoria.registar(ctx, { acao: 'falha_entrada', detalhes: { email: emailLimpo.slice(0, 120) }, utilizador: null })
      throw new NaoAutenticado(CREDENCIAIS_ERRADAS)
    }

    // a tentativa é reservada antes de verificar: pedidos em paralelo não escapam ao limite
    const reserva = await this.utilizadores.reservarTentativa(u.id, agora)
    if (!reserva.permitido) {
      await this.cifra.verificarFicticio(senha)
      await this.auditoria.registar(ctx, { acao: 'falha_entrada', detalhes: 'conta bloqueada', utilizador: u })
      throw bloqueada(reserva.bloqueadoAte)
    }

    if (!(await this.cifra.verificar(senha, u.senha))) {
      await this.auditoria.registar(ctx, { acao: 'falha_entrada', detalhes: { email: emailLimpo.slice(0, 120) }, utilizador: u })
      if (reserva.tentativa >= MAX_TENTATIVAS) {
        const ate = await this.utilizadores.bloquear(u.id, agora)
        await this.auditoria.registar(ctx, { acao: 'bloquear_conta', colecao: 'utilizadores', alvoId: u.id, alvoTitulo: u.nome, utilizador: u })
        throw new ContaBloqueada(`Demasiadas tentativas falhadas. A conta ficou bloqueada durante ${MINUTOS_BLOQUEIO} minutos.`, ate)
      }
      throw new NaoAutenticado(CREDENCIAIS_ERRADAS)
    }

    if (!u.ativo) {
      await this.auditoria.registar(ctx, { acao: 'falha_entrada', detalhes: 'conta desativada', utilizador: u })
      throw new SemPermissao(u.aprovacao ? 'A conta ainda espera a aprovação do Comandante.' : 'Esta conta está desativada. Contacte um administrador.')
    }
    // verificação em dois passos: a palavra-passe está certa, falta (ou está errado) o código do telemóvel
    if (this.doisFatores && (await this.doisFatores.ativo(u.id))) {
      if (!codigo) throw new CodigoEmFalta()
      if (!(await this.doisFatores.verificarEntrada(u.id, codigo))) {
        await this.auditoria.registar(ctx, { acao: 'falha_entrada', detalhes: 'código de dois passos errado', utilizador: u })
        if (reserva.tentativa >= MAX_TENTATIVAS) {
          const ate = await this.utilizadores.bloquear(u.id, agora)
          throw new ContaBloqueada(`Demasiadas tentativas falhadas. A conta ficou bloqueada durante ${MINUTOS_BLOQUEIO} minutos.`, ate)
        }
        throw new CodigoEmFalta('Código errado. Use o código que aparece agora na aplicação (ou um código de recuperação).')
      }
    }
    await this.utilizadores.registarEntrada(u.id, agora)

    // palavra-passe antiga que já não cumpre a política: pede-se que a mude
    if (!u.deveMudarSenha && motivoSenhaFraca(senha, { email: u.email, nome: u.nome })) {
      u.deveMudarSenha = true
      await this.utilizadores.guardar({ ...u, ultimoAcesso: agora.toISOString(), tentativasFalhadas: 0, bloqueadoAte: null })
    }
    await this.auditoria.registar(ctx, { acao: 'entrar', utilizador: u })
    return { token: this.tokens.emitir(u), utilizador: { ...u.publico(), ultimoAcesso: agora.toISOString() } }
  }

  // valida o token e devolve quem está a fazer o pedido
  async autenticar(token) {
    if (!token) throw new NaoAutenticado()
    const sessao = this.tokens.verificar(token)
    if (!sessao || (await this.sessoes.revogada(sessao.jti))) throw new NaoAutenticado('Sessão expirada. Entre novamente.')
    const u = await this.utilizadores.porId(sessao.utilizadorId)
    if (!u || !u.ativo) throw new NaoAutenticado('Conta inexistente ou desativada.')
    if (u.versaoToken !== sessao.versao) throw new NaoAutenticado('A sessão foi terminada. Entre novamente.')
    // as permissões leem-se sempre da base: mudar um papel tem efeito imediato
    const papel = await this.papeis.porId(u.papel)
    const actor = new Actor({ id: u.id, nome: u.nome, email: u.email, papel: u.papel, permissoes: papel?.permissoes || [] })
    return { actor, sessao }
  }

  async eu(ctx) {
    const u = await this.utilizadores.porId(ctx.actor.id)
    const papel = await this.papeis.porId(u.papel)
    const doisFatores = this.doisFatores ? await this.doisFatores.ativo(u.id) : false
    return { ...u.publico(), nomePapel: papel?.nome || u.papel, permissoes: [...ctx.actor.permissoes], deveMudarSenha: u.deveMudarSenha, doisFatores, deveAtivar2fa: Boolean(this.doisFatores?.obrigatorio(u.papel) && !doisFatores) }
  }

  async sair(ctx) {
    await this.sessoes.revogar(ctx.sessao.jti, ctx.sessao.expira)
    await this.auditoria.registar(ctx, { acao: 'sair' })
  }

  // muda a palavra-passe: as outras sessões terminam e devolve-se um token novo para esta
  async mudarSenha(ctx, { atual, nova }) {
    const u = await this.utilizadores.porId(ctx.actor.id)
    if (!(await this.cifra.verificar(atual, u.senha))) throw new ErroValidacao('A palavra-passe atual está errada.')
    validarSenha(nova, { email: u.email, nome: u.nome })
    if (nova === atual) throw new ErroValidacao('A nova palavra-passe tem de ser diferente da atual.')
    u.mudarSenha(await this.cifra.cifrar(nova))
    const guardado = await this.utilizadores.guardar(u)
    await this.sessoes.revogar(ctx.sessao.jti, ctx.sessao.expira)
    await this.auditoria.registar(ctx, { acao: 'alterar_senha' })
    return { token: this.tokens.emitir(guardado) }
  }
}
