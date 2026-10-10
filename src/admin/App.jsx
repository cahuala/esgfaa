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
import Utilizadores from './paginas/Utilizadores'
import Atividades from './paginas/Atividades'
import Perfil from './paginas/Perfil'
import Papeis from './paginas/Papeis'
import Estatisticas from './paginas/Estatisticas'

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
      <Routes>
        <Route path="/" element={<Painel />} />
        <Route path="/colecao/:colecao" element={<PorEndereco><ListaColecao /></PorEndereco>} />
        <Route path="/colecao/:colecao/novo" element={<PorEndereco><EditarItem /></PorEndereco>} />
        <Route path="/colecao/:colecao/:id" element={<PorEndereco><EditarItem /></PorEndereco>} />
        {pode('paginas.ver') && <Route path="/paginas/:chave" element={<PorEndereco><EditarPagina /></PorEndereco>} />}
        {pode('comentarios.ver') && <Route path="/comentarios" element={<Comentarios />} />}
        {pode('estatisticas.ver') && <Route path="/estatisticas" element={<Estatisticas />} />}
        <Route path="/perfil" element={<Perfil />} />
        {pode('utilizadores.ver') && <Route path="/utilizadores" element={<Utilizadores />} />}
        {(pode('papeis.ver') || pode('papeis.gerir')) && <Route path="/papeis" element={<Papeis />} />}
        {pode('atividades.ver') && <Route path="/atividades" element={<Atividades />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default App
