import { ErroValidacao, NaoEncontrado } from '../../../dominio/comum/erros.js'

const mensagem = (erro) => {
  const p = erro.issues[0]
  const campo = p.path.join('.')
  return campo ? `${campo}: ${p.message}` : p.message
}

/*
  Valida params, body e query com esquemas zod. O resultado limpo fica em req.dados
  (no Express 5 req.query é só de leitura). Campos a mais no corpo são descartados pelos esquemas.
*/
export function validar({ params, body, query } = {}) {
  return (req, res, next) => {
    const dados = {}
    for (const [parte, esquema] of Object.entries({ params, body, query })) {
      if (!esquema) continue
      const r = esquema.safeParse(req[parte] ?? {})
      // um endereço com coleção/identificador inválido é um recurso que não existe
      if (!r.success) throw parte === 'params' ? new NaoEncontrado(r.error.issues[0].message) : new ErroValidacao(mensagem(r.error))
      dados[parte] = r.data
    }
    req.dados = dados
    next()
  }
}
