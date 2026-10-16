import textos1 from './textos1'
import textos2 from './textos2'

// { en: { "texto em português": "tradução" }, fr: {…}, es: {…} }
const linhas = [...textos1, ...textos2]
export const DICIONARIOS = Object.fromEntries(['en', 'fr', 'es'].map((l, k) => [l, Object.fromEntries(linhas.map((x) => [x[0], x[k + 1]]))]))
