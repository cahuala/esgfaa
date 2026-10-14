import { normalizarEmail } from '../../identidade/email.js'
import { erro } from '../comum/validacao.js'

// Contas do portal: tipos, e-mail da Escola e número de estudante ou docente.

export const TIPOS_CONTA = ['estudante', 'docente']

/*
  O e-mail de entrada é o da Escola (ex.: nome@esgfaa.gov.ao).
  dominio vazio = aceita qualquer domínio (útil em testes ou instalações sem domínio próprio).
*/
export function emailDaEscola(email, dominio) {
  const e = normalizarEmail(email)
  if (dominio && !e.endsWith(`@${dominio}`)) throw erro('email', `Use o e-mail da Escola (…@${dominio}).`)
  return e
}

// "E2026-0007" / "D2026-0003"
export function numeroConta(tipo, ano, sequencia) {
  return `${tipo === 'docente' ? 'D' : 'E'}${ano}-${String(sequencia).padStart(4, '0')}`
}
