import { createContext, useContext } from 'react'

export const SessaoContexto = createContext(null)

export const useSessao = () => useContext(SessaoContexto)
