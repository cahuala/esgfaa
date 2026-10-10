import { ErroValidacao } from './erros.js'

export const PROFUNDIDADE_MAXIMA = 32
export const CHAVES_PROIBIDAS = new Set(['__proto__', 'constructor', 'prototype'])

/*
  Verifica a forma dos dados antes de qualquer função recursiva lhes tocar:
  - profundidade limitada (um JSON com milhares de níveis faria rebentar a pilha);
  - sem chaves que mexem em protótipos (__proto__, constructor, prototype).
  Feito com uma pilha explícita: nunca é recursivo.
*/
export function verificarEstrutura(valor, { profundidadeMaxima = PROFUNDIDADE_MAXIMA } = {}) {
  const pilha = [[valor, 1]]
  while (pilha.length) {
    const [v, nivel] = pilha.pop()
    if (!v || typeof v !== 'object') continue
    if (nivel > profundidadeMaxima) throw new ErroValidacao('Os dados têm demasiados níveis.')
    for (const k of Object.keys(v)) {
      if (CHAVES_PROIBIDAS.has(k)) throw new ErroValidacao('Os dados contêm campos não permitidos.')
      pilha.push([v[k], nivel + 1])
    }
  }
  return valor
}
