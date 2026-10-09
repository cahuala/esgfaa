import { createContext, useContext } from 'react'

export const ConteudoContexto = createContext(null)

// { noticias, artigos, eventos, cursos, pessoas, paginas, estatisticas, online, ...procuras }
export function useConteudo() {
  return useContext(ConteudoContexto)
}
