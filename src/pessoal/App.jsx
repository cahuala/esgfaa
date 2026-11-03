import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { api, definirAoExpirar, marcarSessao, temSessao } from './api'
import { Area, ContextoSessao } from './sessao'
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
import ListasSistema from './paginas/ListasSistema'
import PermissoesContas from './paginas/PermissoesContas'
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
          <Route path="/pessoas" element={<Area id="fichas"><Pessoas /></Area>} />
          <Route path="/estudantes" element={<Area id="academicos"><Academicos key="estudante" tipo="estudante" /></Area>} />
          <Route path="/docentes" element={<Area id="academicos"><Academicos key="docente" tipo="docente" /></Area>} />
          <Route path="/pessoas/nova" element={<Area id="fichas"><FormularioFicha /></Area>} />
          <Route path="/pessoas/:id" element={<Area id="fichas"><Perfil /></Area>} />
          <Route path="/pessoas/:id/editar" element={<Area id="fichas"><FichaPorId /></Area>} />
          <Route path="/propostas" element={<Area id="propostas"><Propostas /></Area>} />
          <Route path="/propostas/nova" element={<Area id="propostas"><NovaProposta /></Area>} />
          <Route path="/propostas/:id" element={<Area id="propostas"><Proposta /></Area>} />
          <Route path="/elegiveis" element={<Area id="carreiras"><Elegiveis /></Area>} />
          <Route path="/antiguidade" element={<Area id="carreiras"><Antiguidade /></Area>} />
          <Route path="/reserva" element={<Area id="carreiras"><Reserva /></Area>} />
          <Route path="/licencas" element={<Area id="licencas"><Licencas /></Area>} />
          <Route path="/ausencias" element={<Area id="ausencias"><Ausencias /></Area>} />
          <Route path="/faltas-civis" element={<Area id="ausencias"><FaltasCivis /></Area>} />
          <Route path="/ponto" element={<Area id="ponto"><LivroPonto /></Area>} />
          <Route path="/secretaria" element={<Area id="secretaria"><Secretaria /></Area>} />
          <Route path="/quadro" element={<Navigate to="/organica" replace />} />
          <Route path="/organica/importar" element={<Area id="organica"><ImportarOrganica /></Area>} />
          <Route path="/organica" element={<Area id="organica"><Organica /></Area>} />
          <Route path="/organica/:id" element={<Area id="organica"><Organica /></Area>} />
          <Route path="/importar" element={<Area id="importar"><Importar /></Area>} />
          <Route path="/processos" element={<Area id="processos"><Processos /></Area>} />
          <Route path="/extractos" element={<Area id="propostas"><Extractos /></Area>} />
          <Route path="/extractos/:id" element={<Area id="propostas"><Extracto /></Area>} />
          <Route path="/domiciliares" element={<Area id="fichas"><Domiciliares /></Area>} />
          <Route path="/assinaturas" element={<Area id="configuracoes"><Assinaturas /></Area>} />
          <Route path="/listas" element={<Area id="configuracoes"><ListasSistema /></Area>} />
          <Route path="/permissoes" element={<Area id="secretaria"><PermissoesContas /></Area>} />
          <Route path="/tabela-salarial" element={<Area id="salarios"><TabelaSalarial /></Area>} />
          <Route path="/tabela-salarial-civis" element={<Area id="salarios"><TabelaSalarialCivis /></Area>} />
          <Route path="/plano-ferias" element={<Area id="licencas"><PlanoFerias /></Area>} />
          <Route path="/declaracoes" element={<Area id="documentos"><Declaracoes /></Area>} />
          <Route path="/historico-efectivos" element={<Area id="documentos"><HistoricoEfectivos /></Area>} />
          <Route path="/documentos" element={<Area id="documentos"><Documentos /></Area>} />
          <Route path="/documentos/:grupo" element={<Area id="documentos"><Documentos /></Area>} />
          <Route path="/expediente" element={<Expediente />} />
          <Route path="/expediente/:id" element={<Expediente />} />
          <Route path="/mensagens" element={<Mensagens />} />
          <Route path="/mensagens/:id" element={<Mensagens />} />
          <Route path="/utilizadores" element={<Area id="utilizadores"><Utilizadores /></Area>} />
          <Route path="/auditoria" element={<Area id="auditoria"><Auditoria /></Area>} />
          <Route path="/portal" element={<Area id="configuracoes"><Portal /></Area>} />
          <Route path="/senha" element={<MudarSenha />} />
          <Route path="/privacidade" element={<Privacidade />} />
          <Route path="/pedidos-dados" element={<Area id="privacidade"><PedidosDados /></Area>} />
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
