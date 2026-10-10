import { ipKeyGenerator, rateLimit } from 'express-rate-limit'

// limite de pedidos por IP numa janela de tempo (resposta 429 com Retry-After)
export function limitar({ janelaMs, maximo }, { mensagem = 'Demasiados pedidos. Tente mais tarde.', chave } = {}) {
  return rateLimit({
    windowMs: janelaMs,
    limit: maximo,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: chave ? (req) => `${ipKeyGenerator(req.ip)}|${chave(req)}` : (req) => ipKeyGenerator(req.ip),
    handler: (req, res) => res.status(429).json({ erro: mensagem, codigo: 'limite' }),
  })
}
