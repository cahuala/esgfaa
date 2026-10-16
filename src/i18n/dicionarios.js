import textos1 from './textos1'
import textos2 from './textos2'

// todas as tabelas [português, inglês, francês, espanhol] (site, portal, painel, mensagens da API)
const tabelas = import.meta.glob('./app/*.js', { eager: true, import: 'default' })
const linhas = [...textos1, ...textos2, ...Object.values(tabelas).flat()]
const COLUNA = { en: 1, fr: 2, es: 3 }

// { "texto em português": "tradução" } para uma língua
export function dicionarioDe(lingua) {
  const k = COLUNA[lingua]
  return k ? Object.fromEntries(linhas.filter((x) => x[k]).map((x) => [x[0], x[k]])) : {}
}

export const todasAsLinhas = linhas
