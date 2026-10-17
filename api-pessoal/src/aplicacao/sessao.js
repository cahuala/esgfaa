import { ErroDominio, conflito, invalido, naoAutenticado, naoEncontrado, semPermissao } from '../erros.js'
import { eDuplicado } from '../infraestrutura/bd.js'

/*
  Quem usa o sistema e o que pode fazer:
  administrador — tudo, incluindo utilizadores e a ligação ao portal;
  chefe — consulta, edita e decide as propostas (aprova ou rejeita);
  operador — consulta, edita fichas e prepara propostas;
  consulta — só vê.
*/
export const PAPEIS = {
  administrador: { nome: 'Administrador', permissoes: ['ver', 'editar', 'propor', 'decidir', 'administrar'] },
  chefe: { nome: 'Chefe de Pessoal e Quadros', permissoes: ['ver', 'editar', 'propor', 'decidir'] },
  operador: { nome: 'Operador', permissoes: ['ver', 'editar', 'propor'] },
  consulta: { nome: 'Consulta', permissoes: ['ver'] },
}
const MAX_FALHAS = 5
const BLOQUEIO_MIN = 15

export const pode = (u, permissao) => Boolean(PAPEIS[u?.papel]?.permissoes.includes(permissao))
export function exigir(u, permissao) {
  if (!pode(u, permissao)) throw semPermissao()
}

const publico = (u) => ({ id: u.id, nome: u.nome, email: u.email, papel: u.papel, papelNome: PAPEIS[u.papel]?.nome, ativo: u.ativo, deveMudar: u.deveMudar, ultimoAcesso: u.ultimoAcesso, permissoes: PAPEIS[u.papel]?.permissoes ?? [] })

export function validarSenha(senha, email = '') {
  const s = String(senha ?? '')
  if (s.length < 10) throw invalido('A palavra-passe deve ter pelo menos 10 caracteres.', 'senha')
  if (!/[a-zA-Z]/.test(s) || !/\d/.test(s)) throw invalido('A palavra-passe deve ter letras e números.', 'senha')
  if (email && s.toLowerCase().includes(email.split('@')[0].toLowerCase())) throw invalido('A palavra-passe não pode conter o nome do e-mail.', 'senha')
}

export class ServicoSessao {
  constructor({ bd, cifra, tokens, auditoria, agora = () => new Date() }) {
    Object.assign(this, { bd, cifra, tokens, auditoria, agora })
  }

  async entrar({ email, senha }, ip) {
    const e = String(email ?? '').trim().toLowerCase()
    const u = await this.bd.utilizador.findUnique({ where: { email: e } })
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
    const g = await this.bd.utilizador.update({ where: { id: u.id }, data: { falhas: 0, bloqueadoAte: null, ultimoAcesso: this.agora() } })
    await this.auditoria.registar(g, 'entrar', '', {}, ip)
    return { token: this.tokens.emitir(g), utilizador: publico(g) }
  }

  // utilizador do token (ou erro); a conta tem de continuar ativa e com a mesma versão
  async autenticar(token) {
    const t = token && this.tokens.verificar(token)
    if (!t) throw naoAutenticado()
    const u = await this.bd.utilizador.findUnique({ where: { id: t.utilizadorId } })
    if (!u || !u.ativo || u.versaoToken !== t.versao) throw naoAutenticado('A sessão terminou. Entre novamente.')
    return u
  }

  eu(u) {
    return publico(u)
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
    exigir(u, 'administrar')
    return (await this.bd.utilizador.findMany({ orderBy: { nome: 'asc' } })).map(publico)
  }

  async criar(u, { nome, email, papel, senha }) {
    exigir(u, 'administrar')
    if (!PAPEIS[papel]) throw invalido('Papel desconhecido.', 'papel')
    validarSenha(senha, email)
    try {
      const n = await this.bd.utilizador.create({ data: { nome, email: email.toLowerCase(), papel, senha: await this.cifra.cifrar(senha) } })
      await this.auditoria.registar(u, 'criar_utilizador', n.email, { papel })
      return publico(n)
    } catch (e) {
      if (eDuplicado(e)) throw conflito('Já existe um utilizador com esse e-mail.')
      throw e
    }
  }

  async editar(u, id, { nome, papel, ativo, senha }) {
    exigir(u, 'administrar')
    const alvo = await this.bd.utilizador.findUnique({ where: { id } })
    if (!alvo) throw naoEncontrado('Utilizador não encontrado.')
    if (papel !== undefined && !PAPEIS[papel]) throw invalido('Papel desconhecido.', 'papel')
    if (alvo.id === u.id && ((papel && papel !== 'administrador') || ativo === false)) throw invalido('Não pode tirar a si próprio o papel de administrador nem desativar a sua conta.')
    const data = {}
    if (nome !== undefined) data.nome = nome
    if (papel !== undefined) data.papel = papel
    if (ativo !== undefined) data.ativo = ativo
    if (senha) {
      validarSenha(senha, alvo.email)
      Object.assign(data, { senha: await this.cifra.cifrar(senha), deveMudar: true, falhas: 0, bloqueadoAte: null })
    }
    if (data.papel !== undefined || data.ativo !== undefined || data.senha) data.versaoToken = { increment: 1 }
    const g = await this.bd.utilizador.update({ where: { id }, data })
    await this.auditoria.registar(u, 'editar_utilizador', g.email, { papel: data.papel, ativo: data.ativo, senha: Boolean(senha) })
    return publico(g)
  }

  // primeiro arranque: cria o administrador indicado na configuração
  async garantirAdministrador({ nome, email, senha }) {
    if (await this.bd.utilizador.count()) return null
    if (!senha) throw new Error('Primeiro arranque: defina ADMIN_PASSWORD para criar o administrador do sistema de pessoal.')
    validarSenha(senha, email)
    return this.bd.utilizador.create({ data: { nome, email, papel: 'administrador', senha: await this.cifra.cifrar(senha), deveMudar: false } })
  }
}
