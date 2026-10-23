import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, confirmarSessao, definirAoExpirar, marcarSessao, temSessao } from './api'
import { SessaoContexto } from './sessaoContexto'

export function SessaoProvider({ children }) {
  const [utilizador, setUtilizador] = useState(null)
  const [aVerificar, setAVerificar] = useState(() => Boolean(temSessao()))

  const terminar = useCallback(() => {
    marcarSessao(null)
    setUtilizador(null)
  }, [])

  useEffect(() => {
    definirAoExpirar(terminar)
    if (!temSessao()) return
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
    async entrar(email, senha, codigo, prova) {
      const r = await api('/entrar', { metodo: 'POST', corpo: { email, senha, ...(codigo ? { codigo } : {}), ...(prova ? { prova } : {}) } })
      await confirmarSessao(r)
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
