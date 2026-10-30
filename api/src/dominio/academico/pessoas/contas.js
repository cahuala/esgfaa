import { randomInt } from 'node:crypto'
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

/*
  Palavra-passe inicial de uma conta do portal: aleatória (nunca o e-mail, que qualquer colega sabe),
  em três grupos fáceis de ler e de escrever («Kx7m-Pq4r-Zt9w»), sem letras e números que se confundem.
  Mostra-se uma só vez, na ficha de acesso que a Repartição entrega; o portal obriga a mudá-la ao entrar.
*/
const LETRAS = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'
const ALGARISMOS = '23456789'
export function senhaInicial() {
  const sorte = (lista) => lista[randomInt(lista.length)]
  const grupo = () => sorte(LETRAS).toUpperCase() + sorte(LETRAS) + sorte(ALGARISMOS) + sorte(LETRAS)
  return [grupo(), grupo(), grupo()].join('-')
}
