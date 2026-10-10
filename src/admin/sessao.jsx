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
    // pode('noticias.publicar') — o painel só mostra o que o papel permite (a API volta a verificar)
    pode: (permissao) => Boolean(utilizador?.permissoes?.includes(permissao)),
    async entrar(email, senha) {
      const r = await api('/entrar', { metodo: 'POST', corpo: { email, senha } })
      guardarToken(r.token)
      setUtilizador(await api('/eu'))
    },
    // volta a ler a conta (ex.: depois de mudar a palavra-passe)
    async recarregar() {
      setUtilizador(await api('/eu'))
    },
    async sair() {
      await api('/sair', { metodo: 'POST' }).catch(() => {})
      terminar()
    },
  }), [utilizador, aVerificar, terminar])

  return <SessaoContexto.Provider value={valor}>{children}</SessaoContexto.Provider>
}
