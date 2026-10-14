import { ErroValidacao } from '../../comum/erros.js'
import { limparTexto } from '../../comum/texto.js'

// Validações comuns do contexto académico (texto, escolhas, datas e horas).

export const erro = (campo, mensagem) => new ErroValidacao(mensagem, { campo })

export function texto(valor, campo, rotulo, { min = 1, max = 200, obrigatorio = true } = {}) {
  const t = limparTexto(valor)
  if (!t && !obrigatorio) return ''
  if (t.length < min || t.length > max) throw erro(campo, `${rotulo}: entre ${min} e ${max} caracteres.`)
  return t
}

export function escolha(valor, campo, rotulo, opcoes) {
  if (!opcoes.includes(valor)) throw erro(campo, `${rotulo}: escolha uma das opções.`)
  return valor
}

export const HORA = /^([01]\d|2[0-3]):[0-5]\d$/

export const dataValida = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '') && !Number.isNaN(Date.parse(d))
