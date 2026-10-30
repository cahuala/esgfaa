import crypto from 'node:crypto'
import { ErroDominio, conflito, invalido, naoAutenticado, naoEncontrado, semPermissao } from '../erros.js'
import { eDuplicado } from '../infraestrutura/bd.js'

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
const MAX_FALHAS = 5
const BLOQUEIO_MIN = 15

export const pode = (u, permissao) => Boolean(PAPEIS[u?.papel]?.permissoes.includes(permissao))
export function exigir(u, permissao) {
  if (!pode(u, permissao)) throw semPermissao()
}

const publico = (u) => ({ id: u.id, nome: u.nome, email: u.email, papel: u.papel, papelNome: PAPEIS[u.papel]?.nome, ativo: u.ativo, deveMudar: u.deveMudar, ultimoAcesso: u.ultimoAcesso, permissoes: PAPEIS[u.papel]?.permissoes ?? [], pessoaId: u.pessoaId ?? null, unidadeId: u.unidadeId ?? null, unidadeNome: u.unidade?.nome ?? '' })
// palavra-passe inicial: 10 caracteres sem os que se confundem (0/O, 1/l), com letras e números
const ALFABETO = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function senhaInicial() {
  for (;;) {
    const s = Array.from(crypto.randomBytes(10), (b) => ALFABETO[b % ALFABETO.length]).join('')
    if (/\d/.test(s) && /[a-zA-Z]/.test(s)) return s
  }
}
const COM_UNIDADE = { unidade: { select: { nome: true } } }

export function validarSenha(senha, email = '') {
  const s = String(senha ?? '')
  if (s.length < 10) throw invalido('A palavra-passe deve ter pelo menos 10 caracteres.', 'senha')
  if (!/[a-zA-Z]/.test(s) || !/\d/.test(s)) throw invalido('A palavra-passe deve ter letras e números.', 'senha')
  if (email && s.toLowerCase().includes(email.split('@')[0].toLowerCase())) throw invalido('A palavra-passe não pode conter o nome do e-mail.', 'senha')
}

export class ServicoSessao {
  constructor({ bd, cifra, tokens, auditoria, doisFatores = null, agora = () => new Date() }) {
    Object.assign(this, { bd, cifra, tokens, auditoria, doisFatores, agora })
  }

  // entra-se com o e-mail, o NIP ou o n.º de agente
  async entrar({ email, senha, codigo }, ip) {
    const e = String(email ?? '').trim().toLowerCase()
    const u = e.includes('@')
      ? await this.bd.utilizador.findUnique({ where: { email: e } })
      : await this.bd.utilizador.findFirst({ where: { pessoa: { OR: [{ nip: e.toUpperCase() }, { nip: e }, { numeroAgente: e }, { numeroAgente: e.toUpperCase() }] } } })
    const erro = new ErroDominio('E-mail ou palavra-passe incorretos.', 'nao_autenticado')
    if (!u) {
      await this.cifra.verificarFicticio(senha)
      throw erro
    }
    if (u.bloqueadoAte && u.bloqueadoAte > this.agora()) throw new ErroDominio(`Conta bloqueada por tentativas falhadas. Tente depois das ${u.bloqueadoAte.toTimeString().slice(0, 5)}.`, 'conta_bloqueada', { ate: u.bloqueadoAte.toISOString() })
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
    return { ...publico(u), doisFatores, deveAtivar2fa: Boolean(this.doisFatores?.obrigatorio(u.papel) && !doisFatores) }
  }

  async mudarSenha(u, { atual, nova }) {
    if (!(await this.cifra.verificar(atual, u.senha))) throw invalido('A palavra-passe atual está errada.', 'atual')
    validarSenha(nova, u.email)
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
    exigir(u, 'supervisionar')
    return (await this.bd.utilizador.findMany({ orderBy: { nome: 'asc' }, include: COM_UNIDADE })).map(publico)
  }

  async criar(u, { nome, email, papel, senha, unidadeId = null }) {
    exigir(u, 'administrar')
    if (!PAPEIS[papel]) throw invalido('Papel desconhecido.', 'papel')
    validarSenha(senha, email)
    try {
      const n = await this.bd.utilizador.create({ data: { nome, email: email.toLowerCase(), papel, unidadeId, senha: await this.cifra.cifrar(senha) }, include: COM_UNIDADE })
      await this.auditoria.registar(u, 'criar_utilizador', n.email, { papel })
      return publico(n)
    } catch (e) {
      if (eDuplicado(e)) throw conflito('Já existe um utilizador com esse e-mail.')
      throw e
    }
  }

  async editar(u, id, { nome, papel, ativo, senha, unidadeId }) {
    exigir(u, 'administrar')
    const alvo = await this.bd.utilizador.findUnique({ where: { id } })
    if (!alvo) throw naoEncontrado('Utilizador não encontrado.')
    if (papel !== undefined && !PAPEIS[papel]) throw invalido('Papel desconhecido.', 'papel')
    if (alvo.id === u.id && ((papel && papel !== 'administrador') || ativo === false)) throw invalido('Não pode tirar a si próprio o papel de administrador nem desativar a sua conta.')
    const data = {}
    if (nome !== undefined) data.nome = nome
    if (papel !== undefined) data.papel = papel
    if (ativo !== undefined) data.ativo = ativo
    if (unidadeId !== undefined) data.unidadeId = unidadeId
    if (senha) {
      validarSenha(senha, alvo.email)
      Object.assign(data, { senha: await this.cifra.cifrar(senha), deveMudar: true, falhas: 0, bloqueadoAte: null })
    }
    if (data.papel !== undefined || data.ativo !== undefined || data.senha) data.versaoToken = { increment: 1 }
    const g = await this.bd.utilizador.update({ where: { id }, data, include: COM_UNIDADE })
    await this.auditoria.registar(u, 'editar_utilizador', g.email, { papel: data.papel, ativo: data.ativo, senha: Boolean(senha) })
    return publico(g)
  }

  /*
    Contas de utente para as pessoas da Escola (todas as que ainda não têm, ou as indicadas): entram com o
    e-mail, o NIP ou o n.º de agente e uma palavra-passe inicial, que têm de mudar. Devolve as palavras-passe
    (só esta vez) para se imprimirem e entregarem em mão.
  */
  async criarContasPessoas(u, { pessoaIds } = {}) {
    exigir(u, 'administrar')
    const pessoas = await this.bd.pessoa.findMany({ where: { ativo: true, utilizador: null, vinculo: { not: 'domiciliar' }, ...(pessoaIds?.length ? { id: { in: pessoaIds } } : {}) }, orderBy: { nome: 'asc' } })
    const criadas = []
    for (const p of pessoas) {
      const senha = senhaInicial()
      const email = (p.email || `${(p.nip || p.numeroAgente || `pessoa${p.id}`).toLowerCase().replace(/[^a-z0-9]/g, '')}@pessoal.interno`).toLowerCase()
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
