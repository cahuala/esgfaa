import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { api, definirAoExpirar, marcarSessao, temSessao } from './api'
import { ContextoSessao } from './sessao'
import { Aviso, Carregando, NaoEncontrado } from './componentes/Ui'
import Layout from './Layout'
import Entrar from './paginas/Entrar'
import DoisFatores from './componentes/DoisFatores'
import MudarSenha from './paginas/MudarSenha'
import PainelInicial from './paginas/PainelInicial'
import Pessoas from './paginas/Pessoas'
import Academicos from './paginas/Academicos'
import Perfil from './paginas/Perfil'
import FormularioFicha from './paginas/FormularioFicha'
import Propostas from './paginas/Propostas'
import Proposta from './paginas/Proposta'
import NovaProposta from './paginas/NovaProposta'
import Elegiveis from './paginas/Elegiveis'
import Ausencias from './paginas/Ausencias'
import FaltasCivis from './paginas/FaltasCivis'
import LivroPonto from './paginas/LivroPonto'
import Secretaria from './paginas/Secretaria'
import ImportarOrganica from './paginas/ImportarOrganica'
import Antiguidade from './paginas/Antiguidade'
import Reserva from './paginas/Reserva'
import Licencas from './paginas/Licencas'
import Organica from './paginas/Organica'
import Importar from './paginas/Importar'
import Processos from './paginas/Processos'
import Extractos from './paginas/Extractos'
import Extracto from './paginas/Extracto'
import Domiciliares from './paginas/Domiciliares'
import Documentos from './paginas/Documentos'
import Assinaturas from './paginas/Assinaturas'
import TabelaSalarial from './paginas/TabelaSalarial'
import TabelaSalarialCivis from './paginas/TabelaSalarialCivis'
import PlanoFerias from './paginas/PlanoFerias'
import Declaracoes from './paginas/Declaracoes'
import HistoricoEfectivos from './paginas/HistoricoEfectivos'
import Expediente from './paginas/Expediente'
import Mensagens from './paginas/Mensagens'
import Privacidade from './paginas/Privacidade'
import PedidosDados from './paginas/PedidosDados'
import Utilizadores from './paginas/Utilizadores'
import Auditoria from './paginas/Auditoria'
import Portal from './paginas/Portal'

// o formulário recomeça quando se muda de ficha (sem ficar com os dados da anterior)
function FichaPorId() {
  const { id } = useParams()
  return <FormularioFicha key={id} />
}

export default function App() {
  const [utilizador, setUtilizador] = useState(null)
  const [ref, setRef] = useState(null)
  const [aCarregar, setACarregar] = useState(Boolean(temSessao()))
  const [aviso, setAviso] = useState(null)

  const terminar = useCallback(() => { marcarSessao(null); setUtilizador(null); setRef(null) }, [])
  useEffect(() => { definirAoExpirar(terminar) }, [terminar])

  // a conta e as tabelas de referência (postos, ramos, carreiras…) — ao abrir e depois de entrar
  const carregar = useCallback(() => api('/eu')
    .then(async (u) => {
      const r = u.deveMudar || u.deveAtivar2fa ? null : await api('/referencias')
      setUtilizador(u)
      setRef(r)
    })
    .catch(terminar)
    .finally(() => setACarregar(false)), [terminar])
  useEffect(() => { if (temSessao()) carregar() }, [carregar])

  const sessao = useMemo(() => ({
    utilizador,
    ref,
    pode: (p) => Boolean(utilizador?.permissoes.includes(p)),
    avisar: (texto, tipo = 'ok') => setAviso({ texto, tipo, id: Date.now() }),
    recarregar: carregar,
    async entrar(email, senha, codigo, prova) {
      const r = await api('/entrar', { metodo: 'POST', corpo: { email, senha, ...(codigo ? { codigo } : {}), ...(prova ? { prova } : {}) } })
      marcarSessao(Boolean(r.sessao || r.token))
      await carregar()
    },
    async mudouSenha() {
      marcarSessao(true)
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
  // o papel exige a verificação em dois passos: liga-se antes de entrar no sistema
  else if (utilizador.deveAtivar2fa) conteudo = <div className="container py-5" style={{ maxWidth: 760 }}><DoisFatores obrigatoria aoMudar={carregar} /><button type="button" className="btn btn-link" onClick={sessao.sair}>Sair</button></div>
  else if (!ref) conteudo = <Carregando />
  else {
    conteudo = (
      <Layout>
        <Routes>
          <Route path="/" element={utilizador.permissoes.includes('ver') ? <PainelInicial /> : <Navigate to="/expediente" replace />} />
          <Route path="/pessoas" element={<Pessoas />} />
          <Route path="/estudantes" element={<Academicos key="estudante" tipo="estudante" />} />
          <Route path="/docentes" element={<Academicos key="docente" tipo="docente" />} />
          <Route path="/pessoas/nova" element={<FormularioFicha />} />
          <Route path="/pessoas/:id" element={<Perfil />} />
          <Route path="/pessoas/:id/editar" element={<FichaPorId />} />
          <Route path="/propostas" element={<Propostas />} />
          <Route path="/propostas/nova" element={<NovaProposta />} />
          <Route path="/propostas/:id" element={<Proposta />} />
          <Route path="/elegiveis" element={<Elegiveis />} />
          <Route path="/antiguidade" element={<Antiguidade />} />
          <Route path="/reserva" element={<Reserva />} />
          <Route path="/licencas" element={<Licencas />} />
          <Route path="/ausencias" element={<Ausencias />} />
          <Route path="/faltas-civis" element={<FaltasCivis />} />
          <Route path="/ponto" element={<LivroPonto />} />
          <Route path="/secretaria" element={<Secretaria />} />
          <Route path="/quadro" element={<Navigate to="/organica" replace />} />
          <Route path="/organica/importar" element={<ImportarOrganica />} />
          <Route path="/organica" element={<Organica />} />
          <Route path="/organica/:id" element={<Organica />} />
          <Route path="/importar" element={<Importar />} />
          <Route path="/processos" element={<Processos />} />
          <Route path="/extractos" element={<Extractos />} />
          <Route path="/extractos/:id" element={<Extracto />} />
          <Route path="/domiciliares" element={<Domiciliares />} />
          <Route path="/assinaturas" element={<Assinaturas />} />
          <Route path="/tabela-salarial" element={<TabelaSalarial />} />
          <Route path="/tabela-salarial-civis" element={<TabelaSalarialCivis />} />
          <Route path="/plano-ferias" element={<PlanoFerias />} />
          <Route path="/declaracoes" element={<Declaracoes />} />
          <Route path="/historico-efectivos" element={<HistoricoEfectivos />} />
          <Route path="/documentos" element={<Documentos />} />
          <Route path="/documentos/:grupo" element={<Documentos />} />
          <Route path="/expediente" element={<Expediente />} />
          <Route path="/expediente/:id" element={<Expediente />} />
          <Route path="/mensagens" element={<Mensagens />} />
          <Route path="/mensagens/:id" element={<Mensagens />} />
          <Route path="/utilizadores" element={<Utilizadores />} />
          <Route path="/auditoria" element={<Auditoria />} />
          <Route path="/portal" element={<Portal />} />
          <Route path="/senha" element={<MudarSenha />} />
          <Route path="/privacidade" element={<Privacidade />} />
          <Route path="/pedidos-dados" element={<PedidosDados />} />
          <Route path="*" element={<NaoEncontrado />} />
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
