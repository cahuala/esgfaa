import { createContext, useContext } from 'react'

export const IdiomaContexto = createContext({ lingua: 'pt', mudar: () => {} })
export const useIdioma = () => useContext(IdiomaContexto)
