import { createContext, useContext } from 'react'

export const ContextoSessao = createContext(null)
export const useSessao = () => useContext(ContextoSessao)
