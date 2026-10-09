import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import config from './config.js'
import db from './db.js'

// ---------- palavras-passe (scrypt, sem dependências externas) ----------

export function cifrarSenha(senha) {
  const sal = crypto.randomBytes(16)
  const hash = crypto.scryptSync(senha, sal, 64)
  return `scrypt$${sal.toString('hex')}$${hash.toString('hex')}`
}

export function verificarSenha(senha, guardada) {
  const [esquema, salHex, hashHex] = String(guardada).split('$')
  if (esquema !== 'scrypt' || !salHex || !hashHex) return false
  const esperado = Buffer.from(hashHex, 'hex')
  const calculado = crypto.scryptSync(senha, Buffer.from(salHex, 'hex'), esperado.length)
  return crypto.timingSafeEqual(esperado, calculado)
}

export function senhaValida(senha) {
  return typeof senha === 'string' && senha.length >= 8 && /[A-Za-z]/.test(senha) && /\d/.test(senha)
}

// ---------- sessões ----------

export function criarToken(utilizador) {
  return jwt.sign({ sub: utilizador.id, papel: utilizador.papel }, config.segredoJwt, { expiresIn: config.duracaoSessao })
}

// Exige sessão válida e um utilizador ativo; põe o utilizador em req.utilizador
export function autenticar(req, res, next) {
  const cabecalho = req.get('authorization') || ''
  const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7) : null
  if (!token) return res.status(401).json({ erro: 'Sessão em falta. Entre novamente.' })

  try {
    const { sub } = jwt.verify(token, config.segredoJwt)
    const utilizador = db.prepare('SELECT id, nome, email, papel, ativo FROM utilizadores WHERE id = ?').get(sub)
    if (!utilizador || !utilizador.ativo) {
      return res.status(401).json({ erro: 'Conta inexistente ou desativada.' })
    }
    req.utilizador = utilizador
    next()
  } catch {
    res.status(401).json({ erro: 'Sessão expirada. Entre novamente.' })
  }
}

export function exigirPapel(...papeis) {
  return (req, res, next) => {
    if (!papeis.includes(req.utilizador?.papel)) {
      return res.status(403).json({ erro: 'Não tem permissão para esta ação.' })
    }
    next()
  }
}

// ---------- limite de tentativas (em memória) ----------

export function limitador({ janelaMs, maximo, chave = (req) => req.ip, mensagem }) {
  const registos = new Map()
  return (req, res, next) => {
    const agora = Date.now()
    const k = chave(req)
    const recentes = (registos.get(k) || []).filter((t) => agora - t < janelaMs)
    if (recentes.length >= maximo) {
      res.set('Retry-After', String(Math.ceil(janelaMs / 1000)))
      return res.status(429).json({ erro: mensagem || 'Demasiados pedidos. Tente mais tarde.' })
    }
    recentes.push(agora)
    registos.set(k, recentes)
    next()
  }
}
