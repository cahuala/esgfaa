import { Fragment } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { useSessao } from './sessaoContexto'
import Layout from './Layout'
import Entrar from './paginas/Entrar'
import Painel from './paginas/Painel'
import ListaColecao from './paginas/ListaColecao'
import EditarItem from './paginas/EditarItem'
import EditarPagina from './paginas/EditarPagina'
import Comentarios from './paginas/Comentarios'
import TraducoesDados from './paginas/TraducoesDados'
import MensagensSite from './paginas/MensagensSite'
import FerramentasLti from './paginas/academico/FerramentasLti'
import CentroSeguranca from './paginas/CentroSeguranca'
import Monitorizacao from './paginas/Monitorizacao'
import Turmas from './paginas/academico/Turmas'
import AnosLetivos from './paginas/academico/AnosLetivos'
import Turma from './paginas/academico/Turma'
import CadeiraAcademica from './paginas/academico/Cadeira'
import Alocacao from './paginas/academico/Alocacao'
import Indicadores from './paginas/academico/Indicadores'
import PautaTurma from './paginas/academico/documentos/PautaTurma'
import ListaTurma from './paginas/academico/documentos/ListaTurma'
import ListaCurso from './paginas/academico/documentos/ListaCurso'
import DistribuicaoDocente from './paginas/academico/documentos/DistribuicaoDocente'
import PautaCadeira from './paginas/academico/documentos/PautaCadeira'
import FolhaPresencas from './paginas/academico/documentos/FolhaPresencas'
import ListaProva from './paginas/academico/documentos/ListaProva'
import Historico from './paginas/academico/documentos/Historico'
import CertificadoCurso from './paginas/academico/documentos/CertificadoCurso'
import DocumentosAno from './paginas/academico/documentos/DocumentosAno'
import Estrutura from './paginas/academico/Estrutura'
import Arquivo from './paginas/academico/Arquivo'
import HorarioMensal from './paginas/academico/documentos/HorarioMensal'
import Oficios from './paginas/academico/documentos/Oficios'
import PautaFinal from './paginas/academico/documentos/PautaFinal'
import CalendarioAcademico from './paginas/academico/Calendario'
import Registo from './paginas/pessoal/Registo'
import Satisfacao from './paginas/academico/Satisfacao'
import Catalogo from './paginas/biblioteca/Catalogo'
import Obra from './paginas/biblioteca/Obra'
import Circulacao from './paginas/biblioteca/Circulacao'
import Integridade from './paginas/integridade/Integridade'
import PedidosAcademicos from './paginas/academico/Pedidos'
import ProvasImprimir from './paginas/academico/ProvasImprimir'
import Publicacoes from './paginas/Publicacoes'
import Acontecimentos from './paginas/Acontecimentos'
import AlteracoesNotas from './paginas/academico/AlteracoesNotas'
import VerificarDocentes from './paginas/academico/VerificarDocentes'
import AvisosGerais from './paginas/academico/AvisosGerais'
import Utilizadores from './paginas/Utilizadores'
import Atividades from './paginas/Atividades'
import PedidosDados from './paginas/PedidosDados'
import Perfil from './paginas/Perfil'
import Papeis from './paginas/Papeis'
import Estatisticas from './paginas/Estatisticas'
import JanelaDialogo from '../portal/JanelaDialogo'
import FichaConta from './paginas/pessoal/FichaConta'

// recria a página (e o seu estado) quando muda a coleção, o item ou a página editada
function PorEndereco({ children }) {
  const p = useParams()
  return <Fragment key={JSON.stringify(p)}>{children}</Fragment>
}

function App() {
  const { utilizador, aVerificar, pode } = useSessao()

  if (aVerificar) {
    return <div className="app-loader"><span className="spinner" /></div>
  }
  if (!utilizador) return <Entrar />

  return (
    <Layout>
      <JanelaDialogo />
      <Routes>
        <Route path="/" element={<Painel />} />
        <Route path="/colecao/:colecao" element={<PorEndereco><ListaColecao /></PorEndereco>} />
        <Route path="/colecao/:colecao/novo" element={<PorEndereco><EditarItem /></PorEndereco>} />
        <Route path="/colecao/:colecao/:id" element={<PorEndereco><EditarItem /></PorEndereco>} />
        {pode('paginas.ver') && <Route path="/paginas/:chave" element={<PorEndereco><EditarPagina /></PorEndereco>} />}
        {pode('comentarios.ver') && <Route path="/comentarios" element={<Comentarios />} />}
        {pode('paginas.editar') && <Route path="/traducoes-dados" element={<TraducoesDados />} />}
        {pode('contactos.ver') && <Route path="/mensagens-site" element={<MensagensSite />} />}
        {pode('academico.ver') && <Route path="/academico/anos-letivos" element={<AnosLetivos />} />}
        {pode('academico.ver') && <Route path="/academico/turmas" element={<Turmas />} />}
        {pode('academico.ver') && <Route path="/academico/turmas/:id" element={<Turma />} />}
        {pode('academico.ver') && <Route path="/academico/cadeiras/:id" element={<CadeiraAcademica />} />}
        {pode('academico.ver') && <Route path="/academico/alocacao" element={<Alocacao />} />}
        {pode('academico.ver') && <Route path="/academico/indicadores" element={<Indicadores />} />}
        {pode('academico.ver') && <Route path="/academico/satisfacao" element={<Satisfacao />} />}
        {pode('integridade.ver') && <Route path="/integridade" element={<Integridade />} />}
        {pode('integridade.ver') && <Route path="/integridade/analises/:id" element={<Integridade />} />}
        {pode('biblioteca.ver') && <Route path="/biblioteca" element={<Catalogo />} />}
        {pode('biblioteca.ver') && <Route path="/biblioteca/obras/:id" element={<Obra />} />}
        {pode('biblioteca.ver') && <Route path="/biblioteca/emprestimos" element={<Circulacao />} />}
        {pode('academico.ver') && <Route path="/academico/turmas/:id/pauta-final" element={<PautaFinal />} />}
        {pode('academico.ver') && <Route path="/academico/turmas/:id/oficios" element={<Oficios />} />}
        {pode('academico.ver') && <Route path="/academico/turmas/:id/horario-mensal" element={<HorarioMensal />} />}
        {pode('academico.ver') && <Route path="/academico/estrutura" element={<Estrutura />} />}
        {pode('academico.ver') && <Route path="/academico/arquivo" element={<Arquivo />} />}
        {pode('academico.ver') && <Route path="/academico/documentos/ano/:tipo" element={<DocumentosAno />} />}
        {pode('academico.ver') && <Route path="/academico/documentos/turma/:id/pauta" element={<PautaTurma />} />}
        {pode('academico.ver') && <Route path="/academico/documentos/turma/:id/lista" element={<ListaTurma />} />}
        {pode('academico.ver') && <Route path="/academico/documentos/curso/:curso/lista" element={<ListaCurso />} />}
        {pode('academico.ver') && <Route path="/academico/documentos/distribuicao" element={<DistribuicaoDocente />} />}
        {pode('academico.ver') && <Route path="/academico/documentos/cadeira/:id/pauta" element={<PautaCadeira />} />}
        {pode('academico.ver') && <Route path="/academico/documentos/cadeira/:id/presencas" element={<FolhaPresencas />} />}
        {pode('academico.ver') && <Route path="/academico/documentos/cadeira/:id/prova" element={<ListaProva />} />}
        {pode('academico.ver') && <Route path="/academico/documentos/estudante/:id/historico" element={<Historico />} />}
        {pode('academico.gerir') && <Route path="/academico/documentos/turma/:turmaId/certificado/:estudanteId" element={<CertificadoCurso />} />}
        {pode('academico.ver') && <Route path="/academico/calendario" element={<CalendarioAcademico />} />}
        {(pode('pessoal.ver') || pode('academico.ver')) && <Route path="/pessoal/registo/:id/ficha" element={<FichaConta />} />}
        {(pode('pessoal.ver') || pode('academico.ver')) && <Route path="/pessoal/registo" element={<Registo />} />}
        <Route path="/academico/contas" element={<Navigate to="/pessoal/registo" replace />} />
        {pode('academico.ver') && <Route path="/academico/pedidos" element={<PedidosAcademicos />} />}
        {pode('academico.ver') && <Route path="/academico/provas-escritas" element={<ProvasImprimir />} />}
        {(pode('publicacoes.aprovar') || pode('utilizadores.aprovar')) && <Route path="/publicacoes" element={<Publicacoes />} />}
        {pode('atividades.ver') && <Route path="/acontecimentos" element={<Acontecimentos />} />}
        {pode('academico.ver') && <Route path="/academico/alteracoes-notas" element={<AlteracoesNotas />} />}
        {pode('academico.ver') && <Route path="/academico/docentes" element={<VerificarDocentes />} />}
        {pode('academico.ver') && <Route path="/academico/avisos" element={<AvisosGerais />} />}
        {pode('academico.ver') && <Route path="/academico/lti" element={<FerramentasLti />} />}
        {pode('estatisticas.ver') && <Route path="/estatisticas" element={<Estatisticas />} />}
        <Route path="/perfil" element={<Perfil />} />
        {pode('utilizadores.ver') && <Route path="/utilizadores" element={<Utilizadores />} />}
        {(pode('papeis.ver') || pode('papeis.gerir')) && <Route path="/papeis" element={<Papeis />} />}
        {pode('atividades.ver') && <Route path="/atividades" element={<Atividades />} />}
        {pode('atividades.ver') && <Route path="/privacidade" element={<PedidosDados />} />}
        {pode('seguranca.ver') && <Route path="/seguranca" element={<CentroSeguranca />} />}
        {pode('seguranca.ver') && <Route path="/monitorizacao" element={<Monitorizacao />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default App
