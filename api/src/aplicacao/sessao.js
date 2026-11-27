import { NaoAutenticado, SemPermissao, ContaBloqueada, ErroValidacao, CodigoEmFalta } from '../dominio/comum/erros.js'
import { Actor } from '../dominio/identidade/actor.js'
import { limparPermissoes, permissoesDoSistema } from '../dominio/identidade/permissoes.js'
import { MAX_TENTATIVAS, MINUTOS_BLOQUEIO } from '../dominio/identidade/utilizador.js'
import { motivoSenhaFraca, validarSenha } from '../dominio/identidade/politicaSenha.js'
import { BI_ANGOLANO, NIP, impressaoBi, impressaoNip } from '../dominio/identidade/bi.js'

const CREDENCIAIS_ERRADAS = 'E-mail ou palavra-passe incorretos.'
const bloqueada = (ate) => new ContaBloqueada(`Conta bloqueada por excesso de tentativas. Tente de novo dentro de ${MINUTOS_BLOQUEIO} minutos.`, ate)

// Entrar, sair, sessão atual e mudança da própria palavra-passe
export class ServicoSessao {
  constructor({ utilizadores, papeis, sessoes, cifra, tokens, auditoria, relogio, doisFatores = null, chaveIntegracao = '', anosLetivosExistem = null, sistema = 'completo' }) {
    Object.assign(this, { utilizadores, papeis, sessoes, cifra, tokens, auditoria, relogio, doisFatores, chaveIntegracao, anosLetivosExistem, sistema })
  }

  // entra-se com o e-mail ou, nas contas que vêm do Pessoal (Direcção de Ensino), com o BI (civis) ou o NIP (militares)
  async entrar(ctx, { email, senha, codigo }) {
    const emailLimpo = String(email || '').trim().toLowerCase().slice(0, 254)
    const comBi = this.chaveIntegracao && BI_ANGOLANO.test(emailLimpo.toUpperCase())
    const comNip = this.chaveIntegracao && !comBi && NIP.test(emailLimpo)
    // no registo de actividade, o BI e o NIP não ficam em claro
    const registado = comBi ? `BI …${emailLimpo.slice(-3).toUpperCase()}` : comNip ? `NIP …${emailLimpo.slice(-3)}` : emailLimpo.slice(0, 120)
    const u = comBi ? await this.utilizadores.porBiHash(impressaoBi(this.chaveIntegracao, emailLimpo))
      : comNip ? await this.utilizadores.porBiHash(impressaoNip(this.chaveIntegracao, emailLimpo))
        : emailLimpo ? await this.utilizadores.porEmail(emailLimpo) : null
    const agora = this.relogio.agora()

    if (!u) {
      await this.cifra.verificarFicticio(senha) // mesmo tempo de resposta que uma conta existente
      await this.auditoria.registar(ctx, { acao: 'falha_entrada', detalhes: { email: registado }, utilizador: null })
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
      await this.auditoria.registar(ctx, { acao: 'falha_entrada', detalhes: { email: registado }, utilizador: u })
      if (reserva.tentativa >= MAX_TENTATIVAS) {
        const ate = await this.utilizadores.bloquear(u.id, agora)
        await this.auditoria.registar(ctx, { acao: 'bloquear_conta', colecao: 'utilizadores', alvoId: u.id, alvoTitulo: u.nome, utilizador: u })
        throw new ContaBloqueada(`Demasiadas tentativas falhadas. A conta ficou bloqueada durante ${MINUTOS_BLOQUEIO} minutos.`, ate)
      }
      throw new NaoAutenticado(CREDENCIAIS_ERRADAS)
    }

    if (!u.ativo) {
      await this.auditoria.registar(ctx, { acao: 'falha_entrada', detalhes: 'conta desactivada', utilizador: u })
      throw new SemPermissao(u.aprovacao ? 'A conta ainda espera a aprovação do Comandante.' : 'Esta conta está desactivada. Contacte um administrador.')
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
    // (a do Comandante segue a política do Sistema de Pessoal, onde se muda)
    if (!u.deveMudarSenha && !u.geridaPeloPessoal && motivoSenhaFraca(senha, { email: u.email, nome: u.nome })) {
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
    if (!u || !u.ativo) throw new NaoAutenticado('Conta inexistente ou desactivada.')
    if (u.versaoToken !== sessao.versao) throw new NaoAutenticado('A sessão foi terminada. Entre novamente.')
    // as permissões leem-se sempre da base: mudar um papel (ou as da conta) tem efeito imediato;
    // as escolhidas pelo Comandante para esta conta mandam sobre as do papel
    const papel = await this.papeis.porId(u.papel)
    const actor = new Actor({ id: u.id, nome: u.nome, email: u.email, papel: u.papel, departamento: u.departamento ?? '', permissoes: permissoesDoSistema(u.permissoes ? limparPermissoes(u.permissoes) : papel?.permissoes || [], this.sistema) })
    return { actor, sessao }
  }

  async eu(ctx) {
    const u = await this.utilizadores.porId(ctx.actor.id)
    const papel = await this.papeis.porId(u.papel)
    const doisFatores = this.doisFatores ? await this.doisFatores.ativo(u.id) : false
    return { ...u.publico(), sistema: this.sistema, nomePapel: papel?.nome || u.papel, permissoes: [...ctx.actor.permissoes], deveMudarSenha: u.deveMudarSenha, doisFatores, deveAtivar2fa: Boolean(this.doisFatores?.obrigatorio(u.papel) && !doisFatores), doisFatoresDisponivel: Boolean(this.doisFatores) }
  }

  // o meu perfil: nome (não nas contas que vêm do Pessoal: muda-se lá), telefone e cargo ou função
  async atualizarPerfil(ctx, { nome, telefone, cargo }) {
    const u = await this.utilizadores.porId(ctx.actor.id)
    const doPessoal = u.geridaPeloPessoal || u.pessoalRef
    if (nome !== undefined && nome !== u.nome) {
      if (doPessoal) throw new ErroValidacao('O nome desta conta vem do Sistema de Gestão de Pessoal: muda-se na ficha, lá.')
      u.definirNome(nome)
    }
    const limpo = (t, max) => (t === undefined ? undefined : String(t ?? '').trim().replace(/\s+/g, ' ').slice(0, max) || null)
    const tel = limpo(telefone, 30)
    if (tel && !/^\+?[0-9 ()./-]{6,30}$/.test(tel)) throw new ErroValidacao('O telefone só tem algarismos, espaços e + ( ) - .')
    if (tel !== undefined) u.telefone = tel
    const c = limpo(cargo, 120)
    if (c !== undefined) u.cargo = c
    await this.utilizadores.guardar(u)
    await this.auditoria.registar(ctx, { acao: 'editar_perfil' })
    return this.eu(ctx)
  }

  /*
    O ano lectivo com que trabalho no painel (nas minhas configurações): as turmas, os estudantes, os docentes, as
    notas e os documentos vêm desse ano. Vazio = o ano lectivo actual, que a Administração Escolar configura.
  */
  async mudarAnoTrabalho(ctx, ano) {
    const u = await this.utilizadores.porId(ctx.actor.id)
    const a = String(ano ?? '').trim()
    if (a && !/^\d{4}\/\d{4}$/.test(a)) throw new ErroValidacao('Ano lectivo no formato 2026/2027.', { campo: 'anoTrabalho' })
    if (a && this.anosLetivosExistem && !(await this.anosLetivosExistem(a))) throw new ErroValidacao('Esse ano lectivo não está configurado (Administração Escolar › Ano lectivo e semestres).', { campo: 'anoTrabalho' })
    u.anoTrabalho = a
    await this.utilizadores.guardar(u)
    await this.auditoria.registar(ctx, { acao: 'mudar_ano_trabalho', alvoTitulo: a || 'o ano lectivo actual' })
    return this.eu(ctx)
  }

  // a fotografia do perfil (já gravada e confirmada na rota); a anterior apaga-se
  async mudarFoto(ctx, url, apagarAnterior) {
    const u = await this.utilizadores.porId(ctx.actor.id)
    const antes = u.foto
    u.foto = url
    await this.utilizadores.guardar(u)
    if (antes && antes !== url) apagarAnterior?.(antes)
    await this.auditoria.registar(ctx, { acao: url ? 'mudar_foto_perfil' : 'tirar_foto_perfil' })
    return this.eu(ctx)
  }

  async sair(ctx) {
    await this.sessoes.revogar(ctx.sessao.jti, ctx.sessao.expira)
    await this.auditoria.registar(ctx, { acao: 'sair' })
  }

  // muda a palavra-passe: as outras sessões terminam e devolve-se um token novo para esta
  async mudarSenha(ctx, { atual, nova }) {
    const u = await this.utilizadores.porId(ctx.actor.id)
    if (u.biHash && this.chaveIntegracao && impressaoBi(this.chaveIntegracao, nova) === u.biHash) throw new ErroValidacao('A palavra-passe não pode ser o BI: escolha uma nova.')
    if (u.biHash && this.chaveIntegracao && impressaoNip(this.chaveIntegracao, nova) === u.biHash) throw new ErroValidacao('A palavra-passe não pode ser o NIP: escolha uma nova.')
    if (u.geridaPeloPessoal) throw new ErroValidacao('A conta do Comandante é a do Sistema de Gestão de Pessoal: o nome, o e-mail e a palavra-passe mudam-se lá (são os mesmos nos dois sistemas).')
    if (!(await this.cifra.verificar(atual, u.senha))) throw new ErroValidacao('A palavra-passe actual está errada.')
    validarSenha(nova, { email: u.email, nome: u.nome })
    if (nova === atual) throw new ErroValidacao('A nova palavra-passe tem de ser diferente da actual.')
    u.mudarSenha(await this.cifra.cifrar(nova))
    const guardado = await this.utilizadores.guardar(u)
    await this.sessoes.revogar(ctx.sessao.jti, ctx.sessao.expira)
    await this.auditoria.registar(ctx, { acao: 'alterar_senha' })
    return { token: this.tokens.emitir(guardado) }
  }
}
