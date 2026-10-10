import crypto from 'node:crypto'

const ID_EXTERNO = /^[a-zA-Z0-9-]{8,64}$/

// identificador de cada pedido (aparece na resposta e nos registos, para seguir um erro)
export function idPedido(req, res, next) {
  const externo = req.get('x-request-id')
  req.id = externo && ID_EXTERNO.test(externo) ? externo : crypto.randomUUID()
  res.set('X-Request-Id', req.id)
  next()
}

// uma linha JSON por pedido: o que se pediu, a resposta e quanto tempo demorou (sem corpo nem tokens)
export function registoPedidos(escrever = (linha) => process.stdout.write(`${linha}\n`)) {
  return (req, res, next) => {
    const inicio = process.hrtime.bigint()
    res.on('finish', () => {
      escrever(JSON.stringify({
        t: new Date().toISOString(),
        id: req.id,
        metodo: req.method,
        caminho: req.originalUrl.split('?')[0],
        estado: res.statusCode,
        ms: Number((process.hrtime.bigint() - inicio) / 1_000_000n),
        ip: req.ip,
        utilizador: req.contexto?.actor?.id ?? undefined,
      }))
    })
    next()
  }
}

// contexto passado à camada de aplicação
export function contextoAnonimo(req) {
  return { actor: null, ip: req.ip, agente: req.get('user-agent') || '' }
}

export function semCache(req, res, next) {
  res.set('Cache-Control', 'no-store')
  next()
}
