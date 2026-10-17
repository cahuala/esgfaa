import crypto from 'node:crypto'
import { ErroDominio } from '../erros.js'
import { tokenDoPedido } from './sessaoCookie.js'

export const COOKIE_PESSOAL = 'esg_pessoal'

const ESTADOS = { validacao: 400, nao_autenticado: 401, sem_permissao: 403, mudar_senha: 403, nao_encontrado: 404, conflito: 409, conta_bloqueada: 423 }

// valida o corpo, a consulta e os parâmetros com zod; o resultado fica em req.dados
export const validar = (esquemas) => (req, res, next) => {
  req.dados = {}
  for (const [onde, esquema] of Object.entries(esquemas)) {
    const r = esquema.safeParse(req[onde] ?? {})
    if (!r.success) {
      const p = r.error.issues[0]
      return next(new ErroDominio(p.message.startsWith('Invalid') || p.message.startsWith('Too') ? `Campo inválido: ${p.path.join('.') || onde}.` : p.message, 'validacao', { campo: p.path.join('.') }))
    }
    req.dados[onde] = r.data
  }
  next()
}

// sessão: cookie HttpOnly do navegador (com "X-Sessao: cookie") ou "Authorization: Bearer <token>"; com a palavra-passe inicial só pode mudá-la
export const autenticar = (sessao) => async (req, res, next) => {
  try {
    const t = tokenDoPedido(req, COOKIE_PESSOAL)
    req.utilizador = await sessao.autenticar(t)
    if (req.utilizador.deveMudar && !['/eu', '/mudar-senha', '/sair'].includes(req.path)) throw new ErroDominio('Mude a palavra-passe inicial antes de continuar.', 'mudar_senha')
    next()
  } catch (e) {
    next(e)
  }
}

export const semCache = (req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
}

export const idPedido = (req, res, next) => {
  req.id = crypto.randomUUID()
  next()
}

export function tratarErros(registar) {
  // eslint-disable-next-line no-unused-vars
  return (erro, req, res, next) => {
    if (erro instanceof ErroDominio) {
      const corpo = { erro: erro.message, codigo: erro.codigo, ...(erro.detalhes?.campo ? { campo: erro.detalhes.campo } : {}), ...(erro.detalhes?.ate ? { ate: erro.detalhes.ate } : {}) }
      return res.status(ESTADOS[erro.codigo] || 400).json(corpo)
    }
    if (erro.type === 'entity.parse.failed') return res.status(400).json({ erro: 'Pedido mal formado.', codigo: 'validacao' })
    if (erro.type === 'entity.too.large') return res.status(413).json({ erro: 'Conteúdo demasiado grande.', codigo: 'demasiado_grande' })
    if (erro.name === 'MulterError') return res.status(400).json({ erro: erro.code === 'LIMIT_FILE_SIZE' ? 'Fotografia demasiado grande.' : 'Envio de ficheiro inválido.', codigo: 'validacao' })
    if (erro.code === 'P2025') return res.status(404).json({ erro: 'Não encontrado.', codigo: 'nao_encontrado' })
    registar({ id: req.id, erro })
    res.status(500).json({ erro: 'Erro interno do servidor.', codigo: 'interno', pedido: req.id })
  }
}
