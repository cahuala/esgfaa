import { ErroValidacao } from '../comum/erros.js'

export function normalizarEmail(email) {
  const e = String(email ?? '').trim().toLowerCase()
  if (e.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) throw new ErroValidacao('E-mail inválido.')
  return e
}
