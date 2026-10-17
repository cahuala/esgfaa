import { contextoAnonimo } from './pedido.js'
import { tokenDoPedido } from './sessaoCookie.js'

export const COOKIE_PAINEL = 'esg_painel'

// exige sessão válida; põe em req.contexto quem faz o pedido
export function autenticar(sessao) {
  return async (req, res, next) => {
    const token = tokenDoPedido(req, COOKIE_PAINEL)
    const { actor, sessao: s } = await sessao.autenticar(token)
    req.contexto = { ...contextoAnonimo(req), actor, sessao: s }
    next()
  }
}
