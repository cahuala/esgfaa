import { erro } from '../comum/validacao.js'

// Nota (0 a 20) e classificação qualitativa.

export const NOTA_MINIMA_APROVACAO = 10

export function validarNota(valor) {
  if (valor === '' || valor === null || valor === undefined) return null // sem nota (apaga)
  const n = Number(String(valor).replace(',', '.'))
  if (!Number.isFinite(n) || n < 0 || n > 20) throw erro('nota', 'A nota deve estar entre 0 e 20.')
  return Math.round(n * 100) / 100
}

export function classificacao(nota) {
  if (nota === null || nota === undefined) return null
  if (nota < NOTA_MINIMA_APROVACAO) return 'Reprovado'
  if (nota < 14) return 'Suficiente'
  if (nota < 17) return 'Bom'
  return 'Muito bom'
}
