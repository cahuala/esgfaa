import { ErroValidacao } from '../comum/erros.js'

export const SENHA_MINIMO = 10

// palavras-passe demasiado comuns (lista curta; o resto é coberto pelas regras)
const COMUNS = new Set([
  'password1', 'password12', 'password123', 'qwerty1234', '1234567890', 'abc1234567', 'admin12345',
  'mudar12345', 'angola2024', 'angola2025', 'angola2026', 'esgfaa2026', 'luanda2026', 'passw0rd123',
])

const MENSAGEM = `A palavra-passe deve ter pelo menos ${SENHA_MINIMO} caracteres, com letras e números.`

// devolve o motivo pelo qual a palavra-passe é fraca, ou null se for aceitável
export function motivoSenhaFraca(senha, { email = '', nome = '' } = {}) {
  if (typeof senha !== 'string' || senha.length < SENHA_MINIMO || senha.length > 128) return MENSAGEM
  if (!/[A-Za-zÀ-ÿ]/.test(senha) || !/\d/.test(senha)) return MENSAGEM
  const baixa = senha.toLowerCase()
  if (COMUNS.has(baixa)) return 'Essa palavra-passe é demasiado comum. Escolha outra.'
  if (/^(.)\1+$/.test(senha)) return 'A palavra-passe não pode repetir sempre o mesmo carácter.'
  const parteEmail = String(email).split('@')[0].toLowerCase()
  if (parteEmail.length >= 4 && baixa.includes(parteEmail)) return 'A palavra-passe não pode conter o seu e-mail.'
  const partesNome = String(nome).toLowerCase().split(/\s+/).filter((p) => p.length >= 4)
  if (partesNome.some((p) => baixa.includes(p))) return 'A palavra-passe não pode conter o seu nome.'
  return null
}

export function validarSenha(senha, contexto) {
  const motivo = motivoSenhaFraca(senha, contexto)
  if (motivo) throw new ErroValidacao(motivo)
}
