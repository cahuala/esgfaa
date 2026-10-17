import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, confirmarSessao, definirOuvintes, marcarSessao, temSessao } from './api'
import { ContextoSessao } from './sessaoContexto'

// sessão do portal: conta atual, entrar, sair e mudar a palavra-passe
export function SessaoPortal({ children }) {
  const [conta, setConta] = useState(null)
  const [aVerificar, setAVerificar] = useState(() => Boolean(temSessao()))

  const terminar = useCallback(() => {
    marcarSessao(null)
    setConta(null)
  }, [])

  const recarregar = useCallback(async () => setConta(await api('/eu')), [])

  useEffect(() => {
    definirOuvintes({ expirou: terminar, mudarSenha: () => setConta((c) => (c ? { ...c, deveMudarSenha: true } : c)) })
    if (!temSessao()) return
    api('/eu').then(setConta).catch(terminar).finally(() => setAVerificar(false))
  }, [terminar])

  const valor = useMemo(() => ({
    conta,
    aVerificar,
    eDocente: conta?.tipo === 'docente',
    async entrar(email, senha) {
      const r = await api('/entrar', { metodo: 'POST', corpo: { email, senha } })
      await confirmarSessao(r)
      setConta(await api('/eu'))
    },
    async sair() {
      await api('/sair', { metodo: 'POST' }).catch(() => {})
      terminar()
    },
    async mudarSenha(atual, nova) {
      // o servidor renova o cookie da sessão (as sessões antigas deixam de valer)
      await confirmarSessao(await api('/eu/senha', { metodo: 'PUT', corpo: { atual, nova } }))
      setConta(await api('/eu'))
    },
    recarregar,
  }), [conta, aVerificar, terminar, recarregar])

  return <ContextoSessao.Provider value={valor}>{children}</ContextoSessao.Provider>
}
