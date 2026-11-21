import { ASSINANTES } from './assinantes.js'
import { BI_ANGOLANO } from '../dominio/pessoal/ficha.js'
import crypto from 'node:crypto'
import { Prisma } from '@prisma/client'
import { ErroDominio, conflito, invalido, naoAutenticado, naoEncontrado, semPermissao } from '../erros.js'
import { eDuplicado } from '../infraestrutura/bd.js'
import { ordenarLinhas } from './ordem.js'
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
  administrador: { nome: 'Administrador', permissoes: ['ver', 'supervisionar', 'editar', 'registar', 'emitir', 'propor', 'decidir', 'administrar', ...COMUNS] },
  // supervisionar: ver tudo o que é do Pessoal (utilizadores, auditoria, livro de expediente), sem alterar
  chefe: { nome: 'Chefe de Pessoal e Quadros', permissoes: ['ver', 'supervisionar', 'editar', 'registar', 'emitir', 'propor', 'decidir', ...COMUNS] },
  // despachar: a Secretária digital (os documentos submetidos a despacho do Comandante)
  // o Comandante pode fazer tudo: o que o administrador faz e, só ele, despachar
  comandante: { nome: 'Comandante da ESG (pode fazer tudo e despacha)', permissoes: ['ver', 'supervisionar', 'editar', 'registar', 'emitir', 'propor', 'decidir', 'administrar', 'despachar', ...COMUNS] },
  // regista fichas novas e emite documentos (não edita)
  operador: { nome: 'Operador (regista fichas e emite documentos)', permissoes: ['ver', 'registar', 'emitir', ...COMUNS] },
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
// a sessão aberta há mais de 1 minuto sem uso só se actualiza de minuto a minuto (menos escritas na base)
const ACTUALIZAR_USO_MS = 60_000
const navegadorDe = (ua) => String(ua ?? '').slice(0, 300)
// «Chrome no Windows» a partir do User-Agent, para a lista das sessões
export function descreverNavegador(ua) {
  const s = String(ua ?? '')
  const nav = /Edg\//.test(s) ? 'Edge' : /OPR\//.test(s) ? 'Opera' : /Firefox\//.test(s) ? 'Firefox' : /Chrome\//.test(s) ? 'Chrome' : /Safari\//.test(s) ? 'Safari' : 'Outro programa'
  const so = /Windows/.test(s) ? 'Windows' : /Android/.test(s) ? 'Android' : /iPhone|iPad/.test(s) ? 'iPhone/iPad' : /Mac OS X/.test(s) ? 'macOS' : /Linux/.test(s) ? 'Linux' : ''
  return so ? `${nav} no ${so}` : nav
}

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
// as unidades cujo nome bate com «re» e as que estão dentro delas (secções)
export async function unidadesDe(bd, re) {
  const todas = await bd.unidade.findMany({ select: { id: true, nome: true, paiId: true } })
  const ids = new Set(todas.filter((u) => re.test(u.nome)).map((u) => u.id))
  for (let mudou = true; mudou;) {
    mudou = false
    for (const u of todas) if (u.paiId && ids.has(u.paiId) && !ids.has(u.id)) { ids.add(u.id); mudou = true }
  }
  return [...ids]
}
const senhaDoMilitar = (p) => (p?.tipo === 'militar' && p.nip ? p.nip : null)
// com que se entra e qual é a palavra-passe inicial: o militar com o NIP, o civil com o n.º de agente (muda-a logo)
const identificadorDe = (p) => (p?.tipo === 'militar' ? (p.nip || null) : (p?.numeroAgente || null))
const NOME_IDENTIFICADOR = (p) => (p?.tipo === 'militar' ? 'NIP' : 'n.º de agente')
const emailDaPessoa = (p) => (p.email || `${(p.nip || p.numeroAgente || `pessoa${p.id}`).toLowerCase().replace(/[^a-z0-9]/g, '')}@pessoal.interno`).toLowerCase()

export function validarSenha(senha, email = '', nip = '', nomeId = 'NIP') {
  const s = String(senha ?? '')
  if (nip && s.trim().toUpperCase() === String(nip).toUpperCase()) throw invalido(`A palavra-passe não pode ser o ${nomeId}: escolha uma nova.`, 'senha')
  if (s.length < 10) throw invalido('A palavra-passe deve ter pelo menos 10 caracteres.', 'senha')
  if (!/[a-zA-Z]/.test(s) || !/\d/.test(s)) throw invalido('A palavra-passe deve ter letras e números.', 'senha')
  if (email && s.toLowerCase().includes(email.split('@')[0].toLowerCase())) throw invalido('A palavra-passe não pode conter o nome do e-mail.', 'senha')
}

export class ServicoSessao {
  // inactividadeMin: sem nenhum pedido durante este tempo, a sessão termina (o navegador fechado, o computador deixado)
  constructor({ bd, cifra, tokens, auditoria, doisFatores = null, despachos = null, inactividadeMin = 30, chaveBi = 'pessoal-desenvolvimento-bi', agora = () => new Date() }) {
    Object.assign(this, { bd, cifra, tokens, auditoria, doisFatores, despachos, inactividadeMin, chaveBi, agora })
  }

  // a impressão do BI (HMAC com a chave dos dados): entra-se com o BI sem o guardar em claro na conta
  impressaoBi(bi) {
    return crypto.createHmac('sha256', String(this.chaveBi)).update(`bi:${String(bi).trim().toUpperCase()}`).digest('hex')
  }

  // abre a sessão na base de dados e devolve o token com o id dela
  async #abrirSessao(u, ip = '', navegador = '') {
    const id = crypto.randomUUID()
    const agora = this.agora()
    await this.bd.sessao.create({ data: { id, utilizadorId: u.id, versao: u.versaoToken, ip: String(ip ?? '').slice(0, 60), navegador: navegadorDe(navegador), criadaEm: agora, usadaEm: agora } })
    return this.tokens.emitir(u, id)
  }

  #terminarSessoes(where) {
    return this.bd.sessao.updateMany({ where: { ...where, terminadaEm: null }, data: { terminadaEm: this.agora() } })
  }

  // entra-se com o e-mail, o NIP, o n.º de agente ou o BI
  async entrar({ email, senha, codigo }, ip, navegador = '') {
    const e = String(email ?? '').trim().toLowerCase()
    // na auditoria, o BI não fica em claro
    const registado = BI_ANGOLANO.test(e.toUpperCase()) ? `BI …${e.slice(-3).toUpperCase()}` : e
    const u = e.includes('@')
      ? await this.bd.utilizador.findUnique({ where: { email: e } })
      : BI_ANGOLANO.test(e.toUpperCase())
        ? await this.bd.utilizador.findUnique({ where: { biHash: this.impressaoBi(e) } })
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
      await this.auditoria.registar({ nome: registado }, 'entrada_falhada', '', {}, ip)
      throw erro
    }
    // verificação em dois passos: a palavra-passe está certa; falta (ou está errado) o código do telemóvel
    if (this.doisFatores && (await this.doisFatores.ativo(u.id))) {
      if (!codigo) throw new ErroDominio('Introduza o código de 6 algarismos da aplicação de autenticação.', 'codigo_2fa')
      if (!(await this.doisFatores.verificarEntrada(u.id, codigo))) {
        const falhas = u.falhas + 1
        await this.bd.utilizador.update({ where: { id: u.id }, data: falhas >= MAX_FALHAS ? { falhas: 0, bloqueadoAte: new Date(this.agora().getTime() + BLOQUEIO_MIN * 60_000) } : { falhas } })
        await this.auditoria.registar({ nome: registado }, 'entrada_falhada', 'código de dois passos errado', {}, ip)
        throw new ErroDominio('Código errado. Use o código que aparece agora na aplicação (ou um código de recuperação).', 'codigo_2fa')
      }
    }
    const g = await this.bd.utilizador.update({ where: { id: u.id }, data: { falhas: 0, bloqueadoAte: null, ultimoAcesso: this.agora() }, include: COM_UNIDADE })
    await this.auditoria.registar(g, 'entrar', descreverNavegador(navegador), {}, ip)
    return { token: await this.#abrirSessao(g, ip, navegador), utilizador: publico(g) }
  }

  /*
    Utilizador do token (ou erro). A conta tem de continuar ativa e com a mesma versão, e a sessão tem de estar
    aberta: termina se ficar sem uso mais do que a inactividade, ou se o token for usado noutro navegador
    (um cookie copiado deste computador não serve noutro).
  */
  async autenticar(token, { navegador = '', ip = '' } = {}) {
    const t = token && this.tokens.verificar(token)
    if (!t) throw naoAutenticado()
    const u = await this.bd.utilizador.findUnique({ where: { id: t.utilizadorId }, include: COM_UNIDADE })
    if (!u || !u.ativo || u.versaoToken !== t.versao) throw naoAutenticado('A sessão terminou. Entre novamente.')
    const s = t.sessao ? await this.bd.sessao.findUnique({ where: { id: t.sessao } }) : null
    if (!s || s.utilizadorId !== u.id || s.terminadaEm) throw naoAutenticado('A sessão terminou. Entre novamente.')
    const agora = this.agora()
    if (agora - s.usadaEm > this.inactividadeMin * 60_000) {
      await this.#terminarSessoes({ id: s.id })
      throw naoAutenticado(`A sessão terminou por estar ${this.inactividadeMin} minutos sem uso. Entre novamente.`)
    }
    if (s.navegador && s.navegador !== navegadorDe(navegador)) {
      await this.#terminarSessoes({ id: s.id })
      await this.auditoria.registar(u, 'sessao_recusada', `usada noutro navegador (${descreverNavegador(navegador)}); a sessão foi terminada`, {}, ip)
      throw naoAutenticado('A sessão terminou por segurança. Entre novamente.')
    }
    if (agora - s.usadaEm > ACTUALIZAR_USO_MS) await this.bd.sessao.update({ where: { id: s.id }, data: { usadaEm: agora } })
    u.sessaoId = s.id
    return u
  }

  // as sessões abertas da conta (a actual marcada), para a página Segurança da conta
  async sessoes(u) {
    const limite = new Date(this.agora().getTime() - this.inactividadeMin * 60_000)
    const l = await this.bd.sessao.findMany({ where: { utilizadorId: u.id, versao: u.versaoToken, terminadaEm: null, usadaEm: { gt: limite } }, orderBy: { usadaEm: 'desc' } })
    return l.map((x) => ({ id: x.id, navegador: descreverNavegador(x.navegador), ip: x.ip, criadaEm: x.criadaEm, usadaEm: x.usadaEm, atual: x.id === u.sessaoId }))
  }

  async terminarSessao(u, id) {
    const r = await this.#terminarSessoes({ id, utilizadorId: u.id })
    if (!r.count) throw naoEncontrado('Sessão não encontrada.')
    await this.auditoria.registar(u, 'terminar_sessao', id === u.sessaoId ? 'a actual' : 'noutro computador')
  }

  async terminarOutras(u) {
    const r = await this.#terminarSessoes({ utilizadorId: u.id, id: { not: u.sessaoId ?? '' } })
    await this.auditoria.registar(u, 'terminar_sessao', `as outras (${r.count})`)
    return { terminadas: r.count }
  }

  async eu(u) {
    const doisFatores = this.doisFatores ? await this.doisFatores.ativo(u.id) : false
    return { ...publico(u), doisFatores, deveAtivar2fa: Boolean(this.doisFatores?.obrigatorio(u) && !doisFatores), inactividadeMin: this.inactividadeMin }
  }

  async mudarSenha(u, { atual, nova }, ip = '', navegador = '') {
    if (!(await this.cifra.verificar(atual, u.senha))) throw invalido('A palavra-passe atual está errada.', 'atual')
    const p = u.pessoaId ? await this.bd.pessoa.findUnique({ where: { id: u.pessoaId }, select: { tipo: true, nip: true, numeroAgente: true, bi: true } }) : null
    validarSenha(nova, u.email, identificadorDe(p) ?? p?.nip, p ? NOME_IDENTIFICADOR(p) : 'NIP')
    if (p?.bi && String(nova).trim().toUpperCase() === String(p.bi).toUpperCase()) throw invalido('A palavra-passe não pode ser o BI: escolha uma nova.', 'nova')
    if (await this.cifra.verificar(nova, u.senha)) throw invalido('A nova palavra-passe tem de ser diferente da atual.', 'nova')
    const g = await this.bd.utilizador.update({ where: { id: u.id }, data: { senha: await this.cifra.cifrar(nova), deveMudar: false, versaoToken: { increment: 1 } } })
    // a palavra-passe nova termina todas as sessões (também as de outros computadores); esta abre outra
    await this.#terminarSessoes({ utilizadorId: u.id })
    await this.auditoria.registar(u, 'mudar_senha')
    return { token: await this.#abrirSessao(g, ip, navegador), utilizador: publico(g) }
  }

  async sair(u) {
    // termina esta sessão (as dos outros computadores terminam-se em Segurança da conta)
    await this.#terminarSessoes({ id: u.sessaoId ?? '', utilizadorId: u.id })
  }

  // gestão de utilizadores (só o administrador)
  async listar(u) {
    // quem supervisiona e o Comandante (que escolhe o que cada conta pode fazer)
    if (!pode(u, 'supervisionar') && !pode(u, 'despachar')) throw semPermissao()
    // a mudança de papel pedida e ainda por despachar
    const pendentes = await this.bd.pedidoDespacho.findMany({ where: { tipo: { in: ['utilizador_papel', 'utilizador_permissoes'] }, estado: 'pendente' } })
    const pedidos = new Map(pendentes.filter((x) => x.tipo === 'utilizador_papel').map((x) => [x.utilizadorId, x.dados?.papel]))
    const permissoes = new Map(pendentes.filter((x) => x.tipo === 'utilizador_permissoes').map((x) => [x.utilizadorId, x.resumo]))
    return ordenarLinhas(this.bd, (await this.bd.utilizador.findMany({ orderBy: { nome: 'asc' }, include: { ...COM_UNIDADE, pessoa: { select: { tipo: true, nip: true, numeroAgente: true } } } })).map((x) => ({ ...publico(x), nip: x.biHash ? null : identificadorDe(x.pessoa), identificador: x.biHash ? 'BI' : x.pessoa ? NOME_IDENTIFICADOR(x.pessoa) : null, papelPedido: pedidos.get(x.id) ?? null, papelPedidoNome: PAPEIS[pedidos.get(x.id)]?.nome ?? null, permissoesPedido: permissoes.get(x.id) ?? null })), (x) => x.pessoaId)
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
  /*
    Conta do Comandante pelo quadro orgânico: o militar que ocupa o cargo de Comandante (o das Assinaturas, ou o
    «Comandante da Escola Superior de Guerra») tem logo conta de Comandante — entra com o NIP e a palavra-passe
    inicial é o NIP (muda-a na primeira entrada). Se já tinha conta, passa a Comandante (fica a palavra-passe dele).
    Quem deixou o cargo perde o papel de Comandante (fica utente). Não precisa do despacho: a nomeação é que manda.
    Corre ao gravar uma ficha, no arranque e de minuto a minuto (apanha também os extractos e as importações).
  */
  async garantirContaDoComandante() {
    const sistema = { nome: 'Quadro orgânico (cargo de Comandante)' }
    const guardado = (await this.bd.definicao.findUnique({ where: { chave: 'assinaturas' } }))?.valor?.comandante ?? {}
    const cargo = guardado.cargoId
      ? await this.bd.cargo.findUnique({ where: { id: guardado.cargoId } })
      : (await this.bd.cargo.findMany({ select: { id: true, nome: true } })).find((c) => ASSINANTES.comandante.cargo.test(c.nome))
    if (!cargo) return { estado: 'sem_cargo' }
    const p = await this.bd.pessoa.findFirst({ where: { cargoId: cargo.id, ativo: true }, orderBy: [{ dataCargo: 'desc' }, { id: 'asc' }], include: { utilizador: true } })
    const r = { estado: 'vago' }
    if (p) {
      if (!senhaDoMilitar(p)) r.estado = 'sem_nip'
      else if (!p.utilizador) {
        const email = emailDaPessoa(p)
        const ocupado = await this.bd.utilizador.findUnique({ where: { email } })
        const c = await this.bd.utilizador.create({ data: { nome: p.nome, email: ocupado ? `${p.nip.toLowerCase().replace(/[^a-z0-9]/g, '')}@pessoal.interno` : email, papel: 'comandante', pessoaId: p.id, unidadeId: p.unidadeId ?? null, senha: await this.cifra.cifrar(senhaDoMilitar(p)), deveMudar: true } })
        await this.auditoria.registar(sistema, 'conta_comandante_criada', `${c.nome} (NIP ${p.nip})`, { cargo: cargo.nome })
        Object.assign(r, { estado: 'criada', utilizadorId: c.id })
      } else {
        const c = p.utilizador
        if (c.papel !== 'comandante' || !c.ativo || c.aguardaDespacho) {
          await this.bd.utilizador.update({ where: { id: c.id }, data: { papel: 'comandante', ativo: true, aguardaDespacho: false, versaoToken: { increment: 1 } } })
          await this.auditoria.registar(sistema, 'conta_comandante_papel', `${c.nome} (${c.email})`, { cargo: cargo.nome, de: c.papel })
          Object.assign(r, { estado: 'promovida', utilizadorId: c.id })
        } else Object.assign(r, { estado: 'ok', utilizadorId: c.id })
      }
    }
    // quem deixou o cargo (contas de Comandante ligadas a outra pessoa) deixa de ser Comandante — só quando o cargo tem
    // um novo titular com conta (com o cargo vago ou sem NIP, as contas feitas à mão ficam como estão)
    if (!r.utilizadorId) return { ...r, saidas: 0 }
    const antigos = await this.bd.utilizador.findMany({ where: { papel: 'comandante', pessoaId: { not: null }, NOT: { pessoaId: p.id } } })
    for (const c of antigos) {
      await this.bd.utilizador.update({ where: { id: c.id }, data: { papel: 'utente', versaoToken: { increment: 1 } } })
      await this.auditoria.registar(sistema, 'conta_comandante_saiu', `${c.nome} (${c.email})`, { cargo: cargo.nome })
    }
    return { ...r, saidas: antigos.length }
  }

  /*
    Contas automáticas dos civis da Repartição de Pessoal e Quadros (e das suas secções): entram com o BI e a
    palavra-passe inicial é o BI (mudam-na na primeira entrada), com o papel de Operador, sem despacho. Só para quem
    ainda não tem conta; o administrador ajusta depois. Corre como a do Comandante (ao gravar, no arranque, de minuto
    a minuto). Os civis da Direcção de Ensino têm conta no painel de gestão (vai pela ligação ao portal).
  */
  async garantirContasCivis() {
    const sistema = { nome: 'Contas automáticas (civis da Repartição de Pessoal e Quadros)' }
    const ids = await unidadesDe(this.bd, /^Reparti[çc][ãa]o de Pessoal e Quadros\b/i)
    if (!ids.length) return { criadas: 0 }
    const pessoas = await this.bd.pessoa.findMany({ where: { tipo: 'civil', ativo: true, vinculo: 'funcionario', unidadeId: { in: ids }, utilizador: null }, select: { id: true, nome: true, email: true, nip: true, numeroAgente: true, bi: true, unidadeId: true } })
    let criadas = 0
    for (const p of pessoas) {
      const bi = String(p.bi ?? '').trim().toUpperCase()
      if (!BI_ANGOLANO.test(bi)) continue
      const biHash = this.impressaoBi(bi)
      if (await this.bd.utilizador.findUnique({ where: { biHash } })) continue
      let email = emailDaPessoa(p)
      if (await this.bd.utilizador.findUnique({ where: { email } })) email = `bi${biHash.slice(0, 12)}@pessoal.interno`
      await this.bd.utilizador.create({ data: { nome: p.nome, email, papel: 'operador', pessoaId: p.id, unidadeId: p.unidadeId, biHash, senha: await this.cifra.cifrar(bi), deveMudar: true } })
      await this.auditoria.registar(sistema, 'conta_civil_criada', p.nome, { papel: 'operador', entra: 'BI' })
      criadas++
    }
    return { criadas }
  }

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
      senha = identificadorDe(p) ?? senha
      if (!identificadorDe(p)) validarSenha(senha, email)
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

  async editar(u, id, { nome, email, papel, ativo, senha, reporNip, unidadeId, permissoes }) {
    exigir(u, 'administrar')
    const alvo = await this.bd.utilizador.findUnique({ where: { id }, include: { pessoa: { select: { tipo: true, nip: true, numeroAgente: true } } } })
    if (!alvo) throw naoEncontrado('Utilizador não encontrado.')
    if (papel !== undefined && !PAPEIS[papel]) throw invalido('Papel desconhecido.', 'papel')
    if (alvo.id === u.id && ((papel && papel !== 'administrador') || ativo === false)) throw invalido('Não pode tirar a si próprio o papel de administrador nem desativar a sua conta.')
    const data = {}
    if (nome !== undefined) data.nome = nome
    // o e-mail (também numa conta que entra com o NIP: a do Comandante precisa dele para o painel de gestão)
    if (email !== undefined && String(email).trim().toLowerCase() !== alvo.email) {
      const e = String(email).trim().toLowerCase()
      if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(e)) throw invalido('E-mail inválido.', 'email')
      if (await this.bd.utilizador.findUnique({ where: { email: e } })) throw invalido('Já existe uma conta com este e-mail.', 'email')
      data.email = e
    }
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
    // repor: o militar volta a entrar com o NIP como palavra-passe, o civil com o n.º de agente (e muda-a logo)
    if (reporNip) {
      senha = alvo.biHash && alvo.pessoaId ? (await this.bd.pessoa.findUnique({ where: { id: alvo.pessoaId }, select: { bi: true } }))?.bi?.toUpperCase() : identificadorDe(alvo.pessoa)
      if (!senha) throw invalido('Só a conta de um militar (com NIP) ou de um civil (com n.º de agente) da Escola volta à palavra-passe inicial.', 'senha')
    } else if (senha) validarSenha(senha, alvo.email)
    if (senha) {
      Object.assign(data, { senha: await this.cifra.cifrar(senha), deveMudar: true, falhas: 0, bloqueadoAte: null })
    }
    if (data.papel !== undefined || data.ativo !== undefined || data.senha) data.versaoToken = { increment: 1 }
    // o que a conta pode fazer, ecrã a ecrã (null = voltar às do papel): espera pelo despacho do Comandante
    if (permissoes !== undefined) {
      const novas = permissoes === null ? null : limparAreas(permissoes)
      const atuais = areasDe(alvo)
      const finais = novas ?? MODELOS[data.papel ?? alvo.papel] ?? {}
      if (JSON.stringify(Object.entries(finais).sort()) !== JSON.stringify(Object.entries(atuais).sort()) || (novas === null) !== !alvo.permissoes) {
        if (alvo.id === u.id && !(finais.utilizadores === 'alterar')) throw invalido('Não pode tirar a si próprio a gestão dos utilizadores.')
        // o administrador dá e tira permissões directamente (fica na auditoria)
        data.permissoes = novas ?? Prisma.DbNull
      }
    }
    // o administrador pode activar uma conta à espera do despacho do Comandante: o pedido fica anulado (fica na auditoria)
    const activadaSemDespacho = alvo.aguardaDespacho && data.ativo === true
    if (activadaSemDespacho) data.aguardaDespacho = false
    const g = await this.bd.utilizador.update({ where: { id }, data, include: COM_UNIDADE })
    if (activadaSemDespacho) {
      await this.despachos?.anular(this.bd, { tipo: 'utilizador_novo', utilizadorId: id })
      await this.auditoria.registar(u, 'activar_sem_despacho', g.email, { papel: g.papel, nota: 'Activada pelo administrador (sem o despacho do Comandante)' })
    }
    if (pedirPapel) await this.despachos.pedir(this.bd, u, { tipo: 'utilizador_papel', utilizadorId: id, resumo: `${g.nome} (${g.email}): ${PAPEIS[alvo.papel]?.nome ?? alvo.papel} → ${PAPEIS[papel].nome}`, dados: { papel, anterior: alvo.papel } })
    await this.auditoria.registar(u, 'editar_utilizador', g.email, { papel: data.papel, ativo: data.ativo, senha: Boolean(senha), ...('permissoes' in data ? { permissoes: data.permissoes === Prisma.DbNull ? 'as do papel' : data.permissoes } : {}) })
    const aDespacho = pedirPapel ? ['utilizador_papel'] : []
    return { ...publico(g), ...(aDespacho.length ? { aDespacho } : {}) }
  }

  /*
    Contas de utente para as pessoas da Escola (todas as que ainda não têm, ou as indicadas): entram com o
    e-mail, o NIP ou o n.º de agente e uma palavra-passe inicial, que têm de mudar (a do militar é o NIP, a do civil o n.º de agente). Devolve as palavras-passe
    (só esta vez) para se imprimirem e entregarem em mão.
  */
  async criarContasPessoas(u, { pessoaIds } = {}) {
    exigir(u, 'administrar')
    const pessoas = await this.bd.pessoa.findMany({ where: { ativo: true, utilizador: null, vinculo: { not: 'domiciliar' }, ...(pessoaIds?.length ? { id: { in: pessoaIds } } : {}) }, orderBy: { nome: 'asc' } })
    const criadas = []
    for (const p of pessoas) {
      const senha = identificadorDe(p) ?? senhaInicial()
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
