import { useCallback, useEffect, useMemo, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import { api, definirAoExpirar, guardarToken, lerToken } from './api'
import { ContextoSessao } from './sessao'
import { Aviso, Carregando } from './componentes/Ui'
import Layout from './Layout'
import Entrar from './paginas/Entrar'
import MudarSenha from './paginas/MudarSenha'
import PainelInicial from './paginas/PainelInicial'
import Pessoas from './paginas/Pessoas'
import Perfil from './paginas/Perfil'
import FormularioFicha from './paginas/FormularioFicha'
import Propostas from './paginas/Propostas'
import Proposta from './paginas/Proposta'
import Elegiveis from './paginas/Elegiveis'
import Antiguidade from './paginas/Antiguidade'
import Reserva from './paginas/Reserva'
import Licencas from './paginas/Licencas'
import QuadroOrganico from './paginas/QuadroOrganico'
import Utilizadores from './paginas/Utilizadores'
import Auditoria from './paginas/Auditoria'
import Portal from './paginas/Portal'

export default function App() {
  const [utilizador, setUtilizador] = useState(null)
  const [ref, setRef] = useState(null)
  const [aCarregar, setACarregar] = useState(Boolean(lerToken()))
  const [aviso, setAviso] = useState(null)

  const terminar = useCallback(() => { guardarToken(null); setUtilizador(null); setRef(null) }, [])
  useEffect(() => { definirAoExpirar(terminar) }, [terminar])

  // a conta e as tabelas de referência (postos, ramos, carreiras…) — ao abrir e depois de entrar
  const carregar = useCallback(() => api('/eu')
    .then(async (u) => {
      const r = u.deveMudar ? null : await api('/referencias')
      setUtilizador(u)
      setRef(r)
    })
    .catch(terminar)
    .finally(() => setACarregar(false)), [terminar])
  useEffect(() => { if (lerToken()) carregar() }, [carregar])

  const sessao = useMemo(() => ({
    utilizador,
    ref,
    pode: (p) => Boolean(utilizador?.permissoes.includes(p)),
    avisar: (texto, tipo = 'ok') => setAviso({ texto, tipo, id: Date.now() }),
    async entrar(email, senha) {
      const r = await api('/entrar', { metodo: 'POST', corpo: { email, senha } })
      guardarToken(r.token)
      await carregar()
    },
    async mudouSenha(token) {
      guardarToken(token)
      await carregar()
    },
    async sair() {
      await api('/sair', { metodo: 'POST' }).catch(() => {})
      terminar()
    },
  }), [utilizador, ref, carregar, terminar])

  if (aCarregar) return <Carregando />
  let conteudo
  if (!utilizador) conteudo = <Entrar />
  else if (utilizador.deveMudar) conteudo = <MudarSenha obrigatoria />
  else if (!ref) conteudo = <Carregando />
  else {
    conteudo = (
      <Layout>
        <Routes>
          <Route path="/" element={<PainelInicial />} />
          <Route path="/pessoas" element={<Pessoas />} />
          <Route path="/pessoas/nova" element={<FormularioFicha />} />
          <Route path="/pessoas/:id" element={<Perfil />} />
          <Route path="/pessoas/:id/editar" element={<FormularioFicha />} />
          <Route path="/propostas" element={<Propostas />} />
          <Route path="/propostas/:id" element={<Proposta />} />
          <Route path="/elegiveis" element={<Elegiveis />} />
          <Route path="/antiguidade" element={<Antiguidade />} />
          <Route path="/reserva" element={<Reserva />} />
          <Route path="/licencas" element={<Licencas />} />
          <Route path="/quadro" element={<QuadroOrganico />} />
          <Route path="/utilizadores" element={<Utilizadores />} />
          <Route path="/auditoria" element={<Auditoria />} />
          <Route path="/portal" element={<Portal />} />
          <Route path="/senha" element={<MudarSenha />} />
          <Route path="*" element={<div className="alert alert-warning">Página não encontrada.</div>} />
        </Routes>
      </Layout>
    )
  }
  return (
    <ContextoSessao.Provider value={sessao}>
      {conteudo}
      <Aviso aviso={aviso} aoFechar={() => setAviso(null)} />
    </ContextoSessao.Provider>
  )
}
