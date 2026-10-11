import { useCallback, useState } from 'react'
import { aplicarTema, guardarTema, lerTemaGuardado, outroTema, temaInicial } from './tema'

/** Tema atual do site e o botão que o troca (a escolha fica guardada no navegador). */
export function useTema() {
  const [tema, setTema] = useState(() => {
    const noHtml = globalThis.document?.documentElement.getAttribute('data-tema')
    if (noHtml === 'light' || noHtml === 'dark') return noHtml
    return temaInicial(lerTemaGuardado(), globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches)
  })

  const alternar = useCallback(() => {
    const seguinte = outroTema(tema)
    aplicarTema(seguinte)
    guardarTema(seguinte)
    setTema(seguinte)
  }, [tema])

  return { tema, alternar }
}
