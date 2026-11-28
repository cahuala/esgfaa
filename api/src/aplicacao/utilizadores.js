import { Conflito, ErroValidacao, NaoEncontrado, SemPermissao } from '../dominio/comum/erros.js'
import { normalizarEmail } from '../dominio/identidade/email.js'
import { ADMINISTRADOR, limparPermissoes } from '../dominio/identidade/permissoes.js'
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

  // as contas do painel e as mudanças de papel já não esperam pelo Comandante: decide o administrador (fica na auditoria)
  async #precisaAprovacao() {
    return false
  }


  #pedido(ctx, extra) {
    return { ...extra, pedidoPor: ctx.actor.nome ?? null, pedidoPorId: ctx.actor.id ?? null, pedidoEm: (this.relogio?.agora?.() ?? new Date()).toISOString() }
  }

  async listar(ctx) {
    ctx.actor.exigir('utilizadores.ver')
    const [lista, porId, papeis] = await Promise.all([this.utilizadores.listar(), this.atividades.contarPorUtilizador(), this.papeis.listar()])
    const doPapel = new Map(papeis.map((p) => [p.id, p.permissoes]))
    // as efectivas: as próprias (escolhidas pelo Comandante) ou as do papel
    return lista.map((u) => ({ ...u.publico(), atividades: porId[u.id] || 0, permissoesEfectivas: u.permissoes ?? doPapel.get(u.papel) ?? [] }))
  }

  // só quem gere papéis pode atribuir o papel de Administrador
  async #garantirPapel(ctx, papel) {
    if (!papel || !(await this.papeis.existe(papel))) throw new ErroValidacao('Papel inválido.')
    if (papel === ADMINISTRADOR && !ctx.actor.pode('papeis.gerir')) throw new SemPermissao('Não pode atribuir o papel de Administrador.')
  }

  /*
    A conta do Comandante vem do Sistema de Gestão de Pessoal (pedido assinado): o mesmo e-mail e a mesma palavra-passe
    (já cifrada, scrypt como cá). contas = as contas de Comandante activas lá; senha ausente = ainda tem de a mudar lá
    (fica a que havia). As que deixaram de vir desactivam-se. Uma conta do painel com o mesmo e-mail e outro papel
    não se toca (diz-se porquê).
  */
  /*
    Contas automáticas dos civis da Direcção de Ensino, vindas do Sistema de Gestão de Pessoal (pedido assinado):
    papel Repartição de Administração Escolar, sem aprovação; entram com o BI (só a impressão dele) e a palavra-passe
    inicial é o BI (já cifrada), que mudam na primeira entrada. Depois de criada, a conta é do painel (o administrador
    ajusta o papel; a palavra-passe muda-se cá). Quem sai da Direcção de Ensino (deixa de vir) é desactivado.
  */
  async receberContasDoEnsino(ctx, contas) {
    const resultados = []
    const vieram = new Set()
    for (const c of contas) {
      vieram.add(c.ref)
      let u = await this.utilizadores.porPessoalRef(c.ref)
      if (!u) {
        const outra = await this.utilizadores.porBiHash(c.bi)
        if (outra) { resultados.push({ ref: c.ref, ok: false, erro: 'Já há uma conta do painel com este BI.' }); continue }
        const real = c.email ? normalizarEmail(c.email) : ''
        const email = real && !(await this.utilizadores.emailEmUso(real)) ? real : `${c.ref}@pessoal.interno`
        // o papel vem do Pessoal pela unidade e pelo cargo (Director de Ensino, Administração Escolar, Gabinete, Área
        // Científica); sem ele (versões antigas do Pessoal), a Repartição de Administração Escolar
        u = Utilizador.novo({ nome: c.nome, email, papel: c.papel ?? 'secretaria', senhaCifrada: c.senha, deveMudarSenha: true })
        Object.assign(u, { pessoalRef: c.ref, biHash: c.bi, departamento: c.departamento ?? '', ...(c.cargo ? { cargo: c.cargo } : {}) })
        u = await this.utilizadores.criar(u)
        await this.auditoria.registar(ctx, { acao: 'conta_ensino_do_pessoal', colecao: 'utilizadores', alvoId: u.id, alvoTitulo: u.nome, detalhes: { criada: true } })
        resultados.push({ ref: c.ref, ok: true, criada: true })
        continue
      }
      // o nome, o BI (ou o NIP) e o papel acompanham a ficha (uma conta desactivada fica: reactiva-a o administrador)
      const papel = c.papel ?? 'secretaria'
      // o departamento (e o cargo) também vêm do Pessoal
      const departamento = c.departamento ?? u.departamento ?? ''
      if (u.nome !== c.nome || u.biHash !== c.bi || u.papel !== papel || (u.departamento ?? '') !== departamento || (c.cargo && u.cargo !== c.cargo)) {
        u.definirNome(c.nome)
        u.biHash = c.bi
        u.departamento = departamento
        if (c.cargo) u.cargo = c.cargo
        if (u.papel !== papel) { u.papel = papel; u.invalidarSessoes() }
        await this.utilizadores.guardar(u)
      }
      resultados.push({ ref: c.ref, ok: true })
    }
    // quem saiu da Direcção de Ensino (ou da Escola) deixa de entrar
    for (const u of await this.utilizadores.vindasDoPessoal()) {
      if (vieram.has(u.pessoalRef) || !u.ativo) continue
      u.ativo = false
      u.invalidarSessoes()
      await this.utilizadores.guardar(u)
      await this.auditoria.registar(ctx, { acao: 'conta_ensino_do_pessoal', colecao: 'utilizadores', alvoId: u.id, alvoTitulo: u.nome, detalhes: { desactivada: true } })
    }
    return { resultados }
  }

  async receberComandanteDoPessoal(ctx, contas) {
    const resultados = []
    const vieram = new Set()
    for (const c of contas) {
      const email = normalizarEmail(c.email)
      vieram.add(email)
      const senha = c.senha && /^scrypt\$[0-9a-f]+\$[0-9a-f]+$/.test(c.senha) ? c.senha : null
      let u = await this.utilizadores.porEmail(email)
      if (u && !u.geridaPeloPessoal && u.papel !== 'comandante') {
        resultados.push({ email, ok: false, erro: `No painel, ${email} é uma conta com outro papel: não passa a ser a do Comandante.` })
        continue
      }
      if (!u) {
        if (!senha) { resultados.push({ email, ok: false, erro: 'Ainda tem de mudar a palavra-passe no Sistema de Pessoal.' }); continue }
        u = Utilizador.novo({ nome: c.nome, email, papel: 'comandante', senhaCifrada: senha })
        u.geridaPeloPessoal = true
        if (c.nip) u.biHash = c.nip // entra também com o NIP
        u = await this.utilizadores.criar(u)
        await this.auditoria.registar(ctx, { acao: 'conta_comandante_do_pessoal', colecao: 'utilizadores', alvoId: u.id, alvoTitulo: `${u.nome} (${u.email})`, detalhes: { criada: true } })
        resultados.push({ email, ok: true, criada: true })
        continue
      }
      const mudou = u.nome !== c.nome || (senha && senha !== u.senha) || !u.ativo || !u.geridaPeloPessoal || u.papel !== 'comandante' || (c.nip && u.biHash !== c.nip)
      if (mudou) {
        u.definirNome(c.nome)
        if (c.nip) u.biHash = c.nip
        u.papel = 'comandante'
        u.ativo = true
        u.aprovacao = null
        u.geridaPeloPessoal = true
        if (senha && senha !== u.senha) {
          u.mudarSenha(senha)
          u.tentativasFalhadas = 0
          u.bloqueadoAte = null
        }
        await this.utilizadores.guardar(u)
        await this.auditoria.registar(ctx, { acao: 'conta_comandante_do_pessoal', colecao: 'utilizadores', alvoId: u.id, alvoTitulo: `${u.nome} (${u.email})` })
      }
      resultados.push({ email, ok: true })
    }
    // o Comandante que deixou de o ser no Pessoal (ou cuja conta lá foi desactivada) deixa de entrar no painel
    for (const u of await this.utilizadores.geridasPeloPessoal()) {
      if (vieram.has(u.email) || !u.ativo) continue
      u.ativo = false
      u.invalidarSessoes()
      await this.utilizadores.guardar(u)
      await this.auditoria.registar(ctx, { acao: 'conta_comandante_do_pessoal', colecao: 'utilizadores', alvoId: u.id, alvoTitulo: `${u.nome} (${u.email})`, detalhes: { desactivada: true } })
    }
    return { resultados }
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
    if (u.geridaPeloPessoal) throw new ErroValidacao('A conta do Comandante é a do Sistema de Gestão de Pessoal: o nome, o e-mail e a palavra-passe mudam-se lá (são os mesmos nos dois sistemas).')

    // quem não gere papéis não mexe em contas de administradores
    if (u.papel === ADMINISTRADOR && !ctx.actor.pode('papeis.gerir')) throw new SemPermissao('Só um administrador pode alterar outro administrador.')
    if (papel !== undefined) await this.#garantirPapel(ctx, papel)
    if (proprio && ativo === false) throw new ErroValidacao('Não pode desactivar a sua própria conta.')
    if (proprio && papel && papel !== u.papel) throw new ErroValidacao('Não pode mudar o seu próprio papel.')

    // impede que o sistema fique sem administradores ativos
    const tiraAdmin = u.papel === ADMINISTRADOR && ((papel && papel !== ADMINISTRADOR) || ativo === false)
    if (tiraAdmin && (await this.utilizadores.contarAdministradoresAtivos({ exceto: u.id })) === 0) {
      throw new ErroValidacao('Tem de existir pelo menos um administrador activo.')
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

  /*
    O Comandante escolhe o que a conta pode fazer, permissão a permissão (lista de «recurso.acao»; null = as
    do papel). Vale logo: as permissões leem-se da base em cada pedido. Fica no registo de atividades.
  */
  async definirPermissoes(ctx, id, permissoes) {
    ctx.actor.exigir('utilizadores.aprovar')
    const u = await this.utilizadores.porId(id)
    if (!u) throw new NaoEncontrado('Utilizador não encontrado.')
    const novas = permissoes === null ? null : limparPermissoes(permissoes)
    if (u.id === ctx.actor.id && novas && !novas.includes('utilizadores.aprovar')) throw new ErroValidacao('Não pode tirar a si próprio a escolha do que cada conta pode fazer.')
    const papel = await this.papeis.porId(u.papel)
    const antes = u.permissoes ?? papel?.permissoes ?? []
    const depois = novas ?? papel?.permissoes ?? []
    u.permissoes = novas
    await this.utilizadores.guardar(u)
    await this.auditoria.registar(ctx, { acao: 'definir_permissoes', colecao: 'utilizadores', alvoId: u.id, alvoTitulo: u.nome, detalhes: { da: depois.filter((p) => !antes.includes(p)), tira: antes.filter((p) => !depois.includes(p)), doPapel: novas === null } })
    return { ...u.publico(), permissoesEfectivas: depois }
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
