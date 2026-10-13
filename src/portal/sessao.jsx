import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, definirOuvintes, guardarToken, lerToken } from './api'
import { ContextoSessao } from './sessaoContexto'

// sessão do portal: conta atual, entrar, sair e mudar a palavra-passe
export function SessaoPortal({ children }) {
  const [conta, setConta] = useState(null)
  const [aVerificar, setAVerificar] = useState(() => Boolean(lerToken()))

  const terminar = useCallback(() => {
    guardarToken(null)
    setConta(null)
  }, [])

  const recarregar = useCallback(async () => setConta(await api('/eu')), [])

  useEffect(() => {
    definirOuvintes({ expirou: terminar, mudarSenha: () => setConta((c) => (c ? { ...c, deveMudarSenha: true } : c)) })
    if (!lerToken()) return
    api('/eu').then(setConta).catch(terminar).finally(() => setAVerificar(false))
  }, [terminar])

  const valor = useMemo(() => ({
    conta,
    aVerificar,
    eDocente: conta?.tipo === 'docente',
    async entrar(email, senha) {
      const r = await api('/entrar', { metodo: 'POST', corpo: { email, senha } })
      guardarToken(r.token)
      setConta(await api('/eu'))
    },
    async sair() {
      await api('/sair', { metodo: 'POST' }).catch(() => {})
      terminar()
    },
    async mudarSenha(atual, nova) {
      const { token } = await api('/eu/senha', { metodo: 'PUT', corpo: { atual, nova } })
      guardarToken(token)
      setConta(await api('/eu'))
    },
    recarregar,
  }), [conta, aVerificar, terminar, recarregar])

  return <ContextoSessao.Provider value={valor}>{children}</ContextoSessao.Provider>
}
