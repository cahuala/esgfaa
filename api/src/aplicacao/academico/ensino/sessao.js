import { ContaBloqueada, ErroValidacao, NaoAutenticado, SemPermissao } from '../../../dominio/comum/erros.js'
import { MAX_TENTATIVAS, MINUTOS_BLOQUEIO } from '../../../dominio/identidade/utilizador.js'
import { validarSenha } from '../../../dominio/identidade/politicaSenha.js'
import { termosDoPlano } from '../../../dominio/academico/avaliacao/planoCurso.js'

const CREDENCIAIS_ERRADAS = 'E-mail ou palavra-passe incorretos.'
const quem = (c) => ({ id: null, nome: `${c.nome} (portal, ${c.numero})` })

// Entrada no portal académico (estudantes e docentes)
export class ServicoSessaoPortal {
  constructor({ contas, sessoes, cifra, tokens, auditoria, relogio, academico }) {
    Object.assign(this, { contas, sessoes, cifra, tokens, auditoria, relogio, academico })
  }

  async entrar(ctx, { email, senha }) {
    const emailLimpo = String(email || '').trim().toLowerCase().slice(0, 254)
    const c = emailLimpo ? await this.contas.porEmail(emailLimpo) : null
    const agora = this.relogio.agora()

    if (!c) {
      await this.cifra.verificarFicticio(senha)
      await this.auditoria.registar(ctx, { acao: 'falha_entrada_portal', detalhes: { email: emailLimpo.slice(0, 120) }, utilizador: null })
      throw new NaoAutenticado(CREDENCIAIS_ERRADAS)
    }

    // a tentativa reserva-se antes de verificar: pedidos em paralelo não escapam ao limite
    const reserva = await this.contas.reservarTentativa(c.id, agora)
    if (!reserva.permitido) {
      await this.cifra.verificarFicticio(senha)
      throw new ContaBloqueada(`Conta bloqueada por excesso de tentativas. Tente de novo dentro de ${MINUTOS_BLOQUEIO} minutos.`, reserva.bloqueadoAte)
    }
    if (!(await this.cifra.verificar(senha, c.senha))) {
      await this.auditoria.registar(ctx, { acao: 'falha_entrada_portal', detalhes: { email: emailLimpo.slice(0, 120) }, utilizador: quem(c) })
      if (reserva.tentativa >= MAX_TENTATIVAS) {
        const ate = await this.contas.bloquear(c.id, agora)
        throw new ContaBloqueada(`Demasiadas tentativas falhadas. A conta ficou bloqueada durante ${MINUTOS_BLOQUEIO} minutos.`, ate)
      }
      throw new NaoAutenticado(CREDENCIAIS_ERRADAS)
    }
    if (!c.ativo) throw new SemPermissao('Esta conta está desativada. Contacte a Administração Escolar.')
    // contas antigas cuja palavra-passe inicial era o e-mail (que qualquer colega sabe): só com a ficha de acesso nova
    if (c.deveMudarSenha && String(senha).trim().toLowerCase() === c.email) {
      await this.auditoria.registar(ctx, { acao: 'falha_entrada_portal', detalhes: { email: emailLimpo.slice(0, 120), motivo: 'senha_igual_email' }, utilizador: quem(c) })
      throw new NaoAutenticado('A palavra-passe inicial já não é o e-mail. Peça a ficha de acesso à Repartição de Pessoal e Quadros.')
    }

    await this.contas.registarEntrada(c.id, agora)
    await this.auditoria.registar(ctx, { acao: 'entrar_portal', utilizador: quem(c) })
    return { token: this.tokens.emitir(c), conta: c.publico(), deveMudarSenha: c.deveMudarSenha }
  }

  async autenticar(token) {
    if (!token) throw new NaoAutenticado()
    const sessao = this.tokens.verificar(token)
    if (!sessao || (await this.sessoes.revogada(sessao.jti))) throw new NaoAutenticado('Sessão expirada. Entre novamente.')
    const conta = await this.contas.porId(sessao.utilizadorId)
    if (!conta || !conta.ativo) throw new NaoAutenticado('Conta inexistente ou desativada.')
    if (conta.versaoToken !== sessao.versao) throw new NaoAutenticado('A sessão foi terminada. Entre novamente.')
    return { conta, sessao }
  }

  async eu(ctx) {
    const c = ctx.conta
    const matriculas = c.tipo === 'estudante' ? await this.academico.matriculasDoEstudante(c.id) : []
    // o estudante de uma turma com plano de curso da ESG é «auditor» ou «discente» (a turma ativa mais recente)
    let termos = null
    const ativa = matriculas.find((m) => m.estado === 'ativa')
    if (ativa && this.esg) {
      const plano = await this.esg.planos.daTurma(ativa.turma)
      if (plano) termos = termosDoPlano(plano, await this.academico.cadeirasDasTurmas([ativa.turma.id]))
    }
    return { ...c.publico(), deveMudarSenha: c.deveMudarSenha, matriculas, termos }
  }

  async sair(ctx) {
    await this.sessoes.revogar(ctx.sessao.jti, ctx.sessao.expira)
  }

  // a palavra-passe nova cumpre a política (10+ caracteres, letras e números, sem o e-mail nem o nome)
  async mudarSenha(ctx, { atual, nova }) {
    const c = await this.contas.porId(ctx.conta.id)
    if (!(await this.cifra.verificar(atual, c.senha))) throw new ErroValidacao('A palavra-passe atual está errada.', { campo: 'atual' })
    try {
      validarSenha(nova, { email: c.email, nome: c.nome })
    } catch (e) {
      throw new ErroValidacao(e.message, { campo: 'nova' })
    }
    if (nova === atual) throw new ErroValidacao('A nova palavra-passe tem de ser diferente da atual.', { campo: 'nova' })
    c.mudarSenha(await this.cifra.cifrar(nova))
    const guardada = await this.contas.guardar(c)
    await this.sessoes.revogar(ctx.sessao.jti, ctx.sessao.expira)
    await this.auditoria.registar(ctx, { acao: 'alterar_senha_portal', utilizador: quem(c) })
    return { token: this.tokens.emitir(guardada) }
  }
}
