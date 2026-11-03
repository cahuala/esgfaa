import { createContext, createElement, useContext, useMemo } from 'react'

export const ContextoSessao = createContext(null)
// o ecrã (área) onde se está: os botões de alterar só aparecem se a conta puder alterar esse ecrã
export const ContextoArea = createContext(null)
const DE_ALTERAR = new Set(['editar', 'propor', 'administrar'])

export function useSessao() {
  const s = useContext(ContextoSessao)
  const area = useContext(ContextoArea)
  return useMemo(() => {
    if (!s?.utilizador) return s
    const areas = s.utilizador.areas ?? {}
    // decidir as propostas e despachar têm ecrã próprio; editar/propor/administrar valem no ecrã onde se está
    const pode = (p) => {
      if (!s.pode(p)) return false
      if (p === 'decidir') return areas.decidirPropostas === 'alterar'
      if (p === 'despachar') return areas.secretaria === 'alterar'
      return !area || !DE_ALTERAR.has(p) || areas[area] === 'alterar'
    }
    return { ...s, pode, area, ve: (a) => Boolean(areas[a]), alteraEm: (a) => areas[a] === 'alterar' }
  }, [s, area])
}

export const Area = ({ id, children }) => createElement(ContextoArea.Provider, { value: id }, children)
