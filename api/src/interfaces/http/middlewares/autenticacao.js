import { contextoAnonimo } from './pedido.js'

// exige sessão válida; põe em req.contexto quem faz o pedido
export function autenticar(sessao) {
  return (req, res, next) => {
    const cabecalho = req.get('authorization') || ''
    const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7).trim() : null
    const { actor, sessao: s } = sessao.autenticar(token)
    req.contexto = { ...contextoAnonimo(req), actor, sessao: s }
    next()
  }
}
