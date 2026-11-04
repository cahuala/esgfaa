import crypto from 'node:crypto'
import { Prisma } from '@prisma/client'
import { ErroDominio, conflito, invalido, naoAutenticado, naoEncontrado, semPermissao } from '../erros.js'
import { eDuplicado } from '../infraestrutura/bd.js'
import { AREAS, MODELOS, areasDe, limparAreas, permissoesDe } from '../dominio/seguranca/areas.js'

/*
  Quem usa o sistema e o que pode fazer:
  administrador — tudo, incluindo utilizadores e a ligação ao portal;
  chefe — consulta, edita e decide as propostas (aprova ou rejeita);
  operador — consulta, edita fichas e prepara propostas;
  comandante — o Comandante da ESG: vê tudo (também os utilizadores, a auditoria e o livro de expediente), sem alterar;
  consulta — só vê;
  utente — qualquer militar ou civil da Escola: só o expediente da sua área, as mensagens e o seu próprio perfil.
*/
const COMUNS = ['expediente', 'mensagens']
export const PAPEIS = {
  administrador: { nome: 'Administrador', permissoes: ['ver', 'supervisionar', 'editar', 'propor', 'decidir', 'administrar', ...COMUNS] },
  // supervisionar: ver tudo o que é do Pessoal (utilizadores, auditoria, livro de expediente), sem alterar
  chefe: { nome: 'Chefe de Pessoal e Quadros', permissoes: ['ver', 'supervisionar', 'editar', 'propor', 'decidir', ...COMUNS] },
  // despachar: a Secretária digital (os documentos submetidos a despacho do Comandante)
  comandante: { nome: 'Comandante da ESG (vê tudo e despacha)', permissoes: ['ver', 'supervisionar', 'despachar', ...COMUNS] },
  operador: { nome: 'Operador', permissoes: ['ver', 'editar', 'propor', ...COMUNS] },
  consulta: { nome: 'Consulta', permissoes: ['ver', ...COMUNS] },
  utente: { nome: 'Utente (expediente e mensagens)', permissoes: COMUNS },
}
// o que muda nas permissões, para o Comandante ler: «Dá: Licenças (alterar) · Tira: Auditoria»
function resumoAreas(antes, depois) {
  const nivel = (n) => (n === 'alterar' ? 'ver e alterar' : 'ver')
  const da = Object.entries(depois).filter(([a, n]) => antes[a] !== n).map(([a, n]) => `${AREAS[a]?.nome.split(' (')[0] ?? a} (${nivel(n)})`)
  const tira = Object.keys(antes).filter((a) => !depois[a]).map((a) => AREAS[a]?.nome.split(' (')[0] ?? a)
  return [da.length && `Dá: ${da.join(', ')}`, tira.length && `Tira: ${tira.join(', ')}`].filter(Boolean).join(' · ') || 'Volta às permissões do papel'
}

const MAX_FALHAS = 5
const BLOQUEIO_MIN = 15

// as permissões vêm das áreas da conta (as do papel, ou as escolhidas para ela com o despacho do Comandante)
export const pode = (u, permissao) => Boolean(u?.papel && permissoesDe(u).includes(permissao))
export function exigir(u, permissao) {
  if (!pode(u, permissao)) throw semPermissao()
}

const publico = (u) => ({ id: u.id, nome: u.nome, email: u.email, papel: u.papel, papelNome: PAPEIS[u.papel]?.nome, ativo: u.ativo, aguardaDespacho: Boolean(u.aguardaDespacho), areas: areasDe(u), permissoesProprias: Boolean(u.permissoes), deveMudar: u.deveMudar, ultimoAcesso: u.ultimoAcesso, permissoes: u.papel ? permissoesDe(u) : [], pessoaId: u.pessoaId ?? null, unidadeId: u.unidadeId ?? null, unidadeNome: u.unidade?.nome ?? '' })
// palavra-passe inicial: 10 caracteres sem os que se confundem (0/O, 1/l), com letras e números
const ALFABETO = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function senhaInicial() {
  for (;;) {
    const s = Array.from(crypto.randomBytes(10), (b) => ALFABETO[b % ALFABETO.length]).join('')
    if (/\d/.test(s) && /[a-zA-Z]/.test(s)) return s
  }
}
const COM_UNIDADE = { unidade: { select: { nome: true } } }
// o militar da Escola entra com o NIP; a palavra-passe inicial é o próprio NIP (muda-a na primeira entrada)
const senhaDoMilitar = (p) => (p?.tipo === 'militar' && p.nip ? p.nip : null)
const emailDaPessoa = (p) => (p.email || `${(p.nip || p.numeroAgente || `pessoa${p.id}`).toLowerCase().replace(/[^a-z0-9]/g, '')}@pessoal.interno`).toLowerCase()

export function validarSenha(senha, email = '', nip = '') {
  const s = String(senha ?? '')
  if (nip && s.trim().toUpperCase() === String(nip).toUpperCase()) throw invalido('A palavra-passe não pode ser o NIP: escolha uma nova.', 'senha')
  if (s.length < 10) throw invalido('A palavra-passe deve ter pelo menos 10 caracteres.', 'senha')
  if (!/[a-zA-Z]/.test(s) || !/\d/.test(s)) throw invalido('A palavra-passe deve ter letras e números.', 'senha')
  if (email && s.toLowerCase().includes(email.split('@')[0].toLowerCase())) throw invalido('A palavra-passe não pode conter o nome do e-mail.', 'senha')
}

export class ServicoSessao {
  constructor({ bd, cifra, tokens, auditoria, doisFatores = null, despachos = null, agora = () => new Date() }) {
    Object.assign(this, { bd, cifra, tokens, auditoria, doisFatores, despachos, agora })
  }

  // entra-se com o e-mail, o NIP ou o n.º de agente
  async entrar({ email, senha, codigo }, ip) {
    const e = String(email ?? '').trim().toLowerCase()
    const u = e.includes('@')
      ? await this.bd.utilizador.findUnique({ where: { email: e } })
      : await this.bd.utilizador.findFirst({ where: { pessoa: { OR: [{ nip: e.toUpperCase() }, { nip: e }, { numeroAgente: e }, { numeroAgente: e.toUpperCase() }] } } })
    const erro = new ErroDominio('NIP, e-mail ou palavra-passe incorretos.', 'nao_autenticado')
    if (!u) {
      await this.cifra.verificarFicticio(senha)
      throw erro
    }
    if (u.bloqueadoAte && u.bloqueadoAte > this.agora()) throw new ErroDominio(`Conta bloqueada por tentativas falhadas. Tente depois das ${u.bloqueadoAte.toTimeString().slice(0, 5)}.`, 'conta_bloqueada', { ate: u.bloqueadoAte.toISOString() })
    // a conta nova só entra depois do despacho do Comandante
    if (u.aguardaDespacho && (await this.cifra.verificar(senha, u.senha))) throw new ErroDominio('A sua conta ainda aguarda o despacho do Comandante. Tente depois de ser deferida.', 'aguarda_despacho')
    if (!(await this.cifra.verificar(senha, u.senha)) || !u.ativo) {
      const falhas = u.falhas + 1
      await this.bd.utilizador.update({ where: { id: u.id }, data: falhas >= MAX_FALHAS ? { falhas: 0, bloqueadoAte: new Date(this.agora().getTime() + BLOQUEIO_MIN * 60_000) } : { falhas } })
      await this.auditoria.registar({ nome: e }, 'entrada_falhada', '', {}, ip)
      throw erro
    }
    // verificação em dois passos: a palavra-passe está certa; falta (ou está errado) o código do telemóvel
    if (this.doisFatores && (await this.doisFatores.ativo(u.id))) {
      if (!codigo) throw new ErroDominio('Introduza o código de 6 algarismos da aplicação de autenticação.', 'codigo_2fa')
      if (!(await this.doisFatores.verificarEntrada(u.id, codigo))) {
        const falhas = u.falhas + 1
        await this.bd.utilizador.update({ where: { id: u.id }, data: falhas >= MAX_FALHAS ? { falhas: 0, bloqueadoAte: new Date(this.agora().getTime() + BLOQUEIO_MIN * 60_000) } : { falhas } })
        await this.auditoria.registar({ nome: e }, 'entrada_falhada', 'código de dois passos errado', {}, ip)
        throw new ErroDominio('Código errado. Use o código que aparece agora na aplicação (ou um código de recuperação).', 'codigo_2fa')
      }
    }
    const g = await this.bd.utilizador.update({ where: { id: u.id }, data: { falhas: 0, bloqueadoAte: null, ultimoAcesso: this.agora() }, include: COM_UNIDADE })
    await this.auditoria.registar(g, 'entrar', '', {}, ip)
    return { token: this.tokens.emitir(g), utilizador: publico(g) }
  }

  // utilizador do token (ou erro); a conta tem de continuar ativa e com a mesma versão
  async autenticar(token) {
    const t = token && this.tokens.verificar(token)
    if (!t) throw naoAutenticado()
    const u = await this.bd.utilizador.findUnique({ where: { id: t.utilizadorId }, include: COM_UNIDADE })
    if (!u || !u.ativo || u.versaoToken !== t.versao) throw naoAutenticado('A sessão terminou. Entre novamente.')
    return u
  }

  async eu(u) {
    const doisFatores = this.doisFatores ? await this.doisFatores.ativo(u.id) : false
    return { ...publico(u), doisFatores, deveAtivar2fa: Boolean(this.doisFatores?.obrigatorio(u) && !doisFatores) }
  }

  async mudarSenha(u, { atual, nova }) {
    if (!(await this.cifra.verificar(atual, u.senha))) throw invalido('A palavra-passe atual está errada.', 'atual')
    const p = u.pessoaId ? await this.bd.pessoa.findUnique({ where: { id: u.pessoaId }, select: { nip: true } }) : null
    validarSenha(nova, u.email, p?.nip)
    if (await this.cifra.verificar(nova, u.senha)) throw invalido('A nova palavra-passe tem de ser diferente da atual.', 'nova')
    const g = await this.bd.utilizador.update({ where: { id: u.id }, data: { senha: await this.cifra.cifrar(nova), deveMudar: false, versaoToken: { increment: 1 } } })
    await this.auditoria.registar(u, 'mudar_senha')
    return { token: this.tokens.emitir(g), utilizador: publico(g) }
  }

  async sair(u) {
    // termina todas as sessões desta conta
    await this.bd.utilizador.update({ where: { id: u.id }, data: { versaoToken: { increment: 1 } } })
  }

  // gestão de utilizadores (só o administrador)
  async listar(u) {
    // quem supervisiona e o Comandante (que escolhe o que cada conta pode fazer)
    if (!pode(u, 'supervisionar') && !pode(u, 'despachar')) throw semPermissao()
    // a mudança de papel pedida e ainda por despachar
    const pendentes = await this.bd.pedidoDespacho.findMany({ where: { tipo: { in: ['utilizador_papel', 'utilizador_permissoes'] }, estado: 'pendente' } })
    const pedidos = new Map(pendentes.filter((x) => x.tipo === 'utilizador_papel').map((x) => [x.utilizadorId, x.dados?.papel]))
    const permissoes = new Map(pendentes.filter((x) => x.tipo === 'utilizador_permissoes').map((x) => [x.utilizadorId, x.resumo]))
    return (await this.bd.utilizador.findMany({ orderBy: { nome: 'asc' }, include: { ...COM_UNIDADE, pessoa: { select: { tipo: true, nip: true } } } })).map((x) => ({ ...publico(x), nip: senhaDoMilitar(x.pessoa), papelPedido: pedidos.get(x.id) ?? null, papelPedidoNome: PAPEIS[pedidos.get(x.id)]?.nome ?? null, permissoesPedido: permissoes.get(x.id) ?? null }))
  }

  // precisa do despacho do Comandante: contas e papéis acima de utente; a primeira conta de Comandante não
  // (sem ela ninguém despacharia)
  async #precisaDespacho(papel) {
    if (!this.despachos || papel === 'utente') return false
    if (papel === 'comandante' && !(await this.bd.utilizador.count({ where: { papel: 'comandante', ativo: true, aguardaDespacho: false } }))) return false
    return true
  }

  /*
    O Comandante escolhe ele próprio o que a conta pode fazer, ecrã a ecrã (vale logo: a decisão é dele).
    Um pedido do administrador para a mesma conta, ainda por despachar, fica sem efeito.
  */
  async definirPermissoes(u, id, permissoes) {
    exigir(u, 'despachar')
    const alvo = await this.bd.utilizador.findUnique({ where: { id } })
    if (!alvo) throw naoEncontrado('Utilizador não encontrado.')
    const novas = permissoes === null ? null : limparAreas(permissoes)
    if (alvo.id === u.id && !(novas ?? MODELOS[alvo.papel] ?? {}).secretaria) throw invalido('Não pode tirar a si próprio a Secretária digital (é por ela que decide).')
    const antes = areasDe(alvo)
    const g = await this.bd.$transaction(async (tx) => {
      await tx.pedidoDespacho.updateMany({ where: { tipo: 'utilizador_permissoes', estado: 'pendente', utilizadorId: id }, data: { estado: 'anulado', decididoPor: u.email, decididoEm: this.agora(), despacho: 'Substituído pela escolha do Comandante.' } })
      return tx.utilizador.update({ where: { id }, data: { permissoes: novas ?? Prisma.DbNull }, include: COM_UNIDADE })
    })
    await this.auditoria.registar(u, 'definir_permissoes', `${g.nome} (${g.email}): ${resumoAreas(antes, areasDe(g))}`)
    return publico(g)
  }

  async #haComandante() {
    return Boolean(await this.bd.utilizador.count({ where: { papel: 'comandante', ativo: true, aguardaDespacho: false } }))
  }

  // o que o Comandante deferiu (mudar o papel volta às permissões do papel novo)
  async aplicarDespacho(id, data) {
    if ('papel' in data) data = { ...data, permissoes: Prisma.DbNull }
    if ('permissoes' in data && data.permissoes === null) data = { ...data, permissoes: Prisma.DbNull }
    // o papel e o estado da conta obrigam a entrar de novo; as permissões valem logo (cada pedido lê a conta)
    const sair = 'papel' in data || 'ativo' in data
    const g = await this.bd.utilizador.update({ where: { id }, data: { ...data, ...(sair ? { versaoToken: { increment: 1 } } : {}) } })
    return publico(g)
  }

  // conta ligada a uma pessoa da Escola (pessoaId): o militar entra com o NIP e a palavra-passe inicial é o NIP
  async criar(u, { nome, email, papel, senha, unidadeId = null, pessoaId = null }) {
    exigir(u, 'administrar')
    if (!PAPEIS[papel]) throw invalido('Papel desconhecido.', 'papel')
    if (pessoaId) {
      const p = await this.bd.pessoa.findUnique({ where: { id: pessoaId }, include: { utilizador: { select: { id: true } } } })
      if (!p || !p.ativo) throw naoEncontrado('Pessoa não encontrada na Escola.')
      if (p.utilizador) throw conflito(`${p.nome} já tem conta no sistema.`)
      nome = p.nome
      email = email || emailDaPessoa(p)
      unidadeId = unidadeId ?? p.unidadeId
      senha = senhaDoMilitar(p) ?? senha
      if (!senhaDoMilitar(p)) validarSenha(senha, email)
    } else {
      if (!nome || String(nome).trim().length < 3) throw invalido('Indique o nome.', 'nome')
      if (!email) throw invalido('Indique o e-mail.', 'email')
      validarSenha(senha, email)
    }
    const despacho = await this.#precisaDespacho(papel)
    try {
      const n = await this.bd.$transaction(async (tx) => {
        const c = await tx.utilizador.create({ data: { nome, email: email.toLowerCase(), papel, unidadeId, pessoaId, senha: await this.cifra.cifrar(senha), ...(despacho ? { ativo: false, aguardaDespacho: true } : {}) }, include: COM_UNIDADE })
        if (despacho) await this.despachos.pedir(tx, u, { tipo: 'utilizador_novo', utilizadorId: c.id, resumo: `${c.nome} (${c.email}) — ${PAPEIS[papel].nome}`, dados: { papel } })
        return c
      })
      await this.auditoria.registar(u, 'criar_utilizador', n.email, { papel })
      return { ...publico(n), ...(despacho ? { aDespacho: ['utilizador_novo'] } : {}) }
    } catch (e) {
      if (eDuplicado(e)) throw conflito(pessoaId ? 'Já existe uma conta com esse e-mail ou para essa pessoa.' : 'Já existe um utilizador com esse e-mail.')
      throw e
    }
  }

  async editar(u, id, { nome, papel, ativo, senha, reporNip, unidadeId, permissoes }) {
    exigir(u, 'administrar')
    const alvo = await this.bd.utilizador.findUnique({ where: { id }, include: { pessoa: { select: { tipo: true, nip: true } } } })
    if (!alvo) throw naoEncontrado('Utilizador não encontrado.')
    if (papel !== undefined && !PAPEIS[papel]) throw invalido('Papel desconhecido.', 'papel')
    if (alvo.id === u.id && ((papel && papel !== 'administrador') || ativo === false)) throw invalido('Não pode tirar a si próprio o papel de administrador nem desativar a sua conta.')
    const data = {}
    if (nome !== undefined) data.nome = nome
    // a mudança de papel espera pelo despacho do Comandante (a conta fica com o papel que tem)
    let pedirPapel = false
    if (papel !== undefined && papel !== alvo.papel) {
      if (alvo.aguardaDespacho) {
        // conta ainda por despachar: muda o papel pedido
        data.papel = papel
        await this.bd.pedidoDespacho.updateMany({ where: { tipo: 'utilizador_novo', estado: 'pendente', utilizadorId: id }, data: { dados: { papel }, resumo: `${alvo.nome} (${alvo.email}) — ${PAPEIS[papel].nome}` } })
      } else if (await this.#precisaDespacho(papel)) pedirPapel = true
      else data.papel = papel
    }
    if (ativo !== undefined) data.ativo = ativo
    if (unidadeId !== undefined) data.unidadeId = unidadeId
    // repor: o militar volta a entrar com o NIP como palavra-passe (e muda-a logo)
    if (reporNip) {
      senha = senhaDoMilitar(alvo.pessoa)
      if (!senha) throw invalido('Só a conta de um militar da Escola (com NIP) volta à palavra-passe do NIP.', 'senha')
    } else if (senha) validarSenha(senha, alvo.email)
    if (senha) {
      Object.assign(data, { senha: await this.cifra.cifrar(senha), deveMudar: true, falhas: 0, bloqueadoAte: null })
    }
    if (data.papel !== undefined || data.ativo !== undefined || data.senha) data.versaoToken = { increment: 1 }
    // o que a conta pode fazer, ecrã a ecrã (null = voltar às do papel): espera pelo despacho do Comandante
    let pedirPermissoes = null
    if (permissoes !== undefined) {
      const novas = permissoes === null ? null : limparAreas(permissoes)
      const atuais = areasDe(alvo)
      const finais = novas ?? MODELOS[data.papel ?? alvo.papel] ?? {}
      if (JSON.stringify(Object.entries(finais).sort()) !== JSON.stringify(Object.entries(atuais).sort()) || (novas === null) !== !alvo.permissoes) {
        if (alvo.id === u.id && !(finais.utilizadores === 'alterar')) throw invalido('Não pode tirar a si próprio a gestão dos utilizadores.')
        // sem Comandante ainda (primeira instalação) ou conta por despachar: aplica-se já
        if (alvo.aguardaDespacho || !this.despachos || !(await this.#haComandante())) data.permissoes = novas ?? Prisma.DbNull
        else pedirPermissoes = { novas, atuais, finais }
      }
    }
    if (alvo.aguardaDespacho && data.ativo === true) delete data.ativo // só o despacho a abre
    const g = await this.bd.utilizador.update({ where: { id }, data, include: COM_UNIDADE })
    if (pedirPermissoes) await this.despachos.pedir(this.bd, u, { tipo: 'utilizador_permissoes', utilizadorId: id, resumo: `${g.nome} (${g.email}): ${resumoAreas(pedirPermissoes.atuais, pedirPermissoes.finais)}`, dados: { permissoes: pedirPermissoes.novas } })
    if (pedirPapel) await this.despachos.pedir(this.bd, u, { tipo: 'utilizador_papel', utilizadorId: id, resumo: `${g.nome} (${g.email}): ${PAPEIS[alvo.papel]?.nome ?? alvo.papel} → ${PAPEIS[papel].nome}`, dados: { papel, anterior: alvo.papel } })
    await this.auditoria.registar(u, 'editar_utilizador', g.email, { papel: data.papel, ativo: data.ativo, senha: Boolean(senha) })
    const aDespacho = [...(pedirPapel ? ['utilizador_papel'] : []), ...(pedirPermissoes ? ['utilizador_permissoes'] : [])]
    return { ...publico(g), ...(aDespacho.length ? { aDespacho } : {}) }
  }

  /*
    Contas de utente para as pessoas da Escola (todas as que ainda não têm, ou as indicadas): entram com o
    e-mail, o NIP ou o n.º de agente e uma palavra-passe inicial, que têm de mudar (a do militar é o NIP). Devolve as palavras-passe
    (só esta vez) para se imprimirem e entregarem em mão.
  */
  async criarContasPessoas(u, { pessoaIds } = {}) {
    exigir(u, 'administrar')
    const pessoas = await this.bd.pessoa.findMany({ where: { ativo: true, utilizador: null, vinculo: { not: 'domiciliar' }, ...(pessoaIds?.length ? { id: { in: pessoaIds } } : {}) }, orderBy: { nome: 'asc' } })
    const criadas = []
    for (const p of pessoas) {
      const senha = senhaDoMilitar(p) ?? senhaInicial()
      const email = emailDaPessoa(p)
      if (await this.bd.utilizador.findUnique({ where: { email } })) continue
      await this.bd.utilizador.create({ data: { nome: p.nome, email, papel: 'utente', pessoaId: p.id, unidadeId: p.unidadeId, senha: await this.cifra.cifrar(senha) } })
      criadas.push({ pessoaId: p.id, nome: p.nome, identificacao: p.nip || p.numeroAgente || '', entrar: p.email || p.nip || p.numeroAgente || email, senha })
    }
    await this.auditoria.registar(u, 'criar_contas_pessoas', `${criadas.length} conta(s)`)
    return criadas
  }

  // primeiro arranque: cria o administrador indicado na configuração
  async garantirAdministrador({ nome, email, senha }) {
    if (await this.bd.utilizador.count()) return null
    if (!senha) throw new Error('Primeiro arranque: defina ADMIN_PASSWORD para criar o administrador do sistema de pessoal.')
    validarSenha(senha, email)
    return this.bd.utilizador.create({ data: { nome, email, papel: 'administrador', senha: await this.cifra.cifrar(senha), deveMudar: false } })
  }
}
