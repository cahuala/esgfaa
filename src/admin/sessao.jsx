import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, definirAoExpirar, guardarToken, lerToken } from './api'
import { SessaoContexto } from './sessaoContexto'

export function SessaoProvider({ children }) {
  const [utilizador, setUtilizador] = useState(null)
  const [aVerificar, setAVerificar] = useState(() => Boolean(lerToken()))

  const terminar = useCallback(() => {
    guardarToken(null)
    setUtilizador(null)
  }, [])

  useEffect(() => {
    definirAoExpirar(terminar)
    if (!lerToken()) return
    api('/eu')
      .then(setUtilizador)
      .catch(terminar)
      .finally(() => setAVerificar(false))
  }, [terminar])

  const valor = useMemo(() => ({
    utilizador,
    aVerificar,
    eAdministrador: utilizador?.papel === 'administrador',
    async entrar(email, senha) {
      const r = await api('/entrar', { metodo: 'POST', corpo: { email, senha } })
      guardarToken(r.token)
      setUtilizador(r.utilizador)
    },
    async sair() {
      await api('/sair', { metodo: 'POST' }).catch(() => {})
      terminar()
    },
  }), [utilizador, aVerificar, terminar])

  return <SessaoContexto.Provider value={valor}>{children}</SessaoContexto.Provider>
}
