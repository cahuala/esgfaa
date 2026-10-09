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

// recria a página (e o seu estado) quando muda a coleção, o item ou a página editada
function PorEndereco({ children }) {
  const p = useParams()
  return <Fragment key={JSON.stringify(p)}>{children}</Fragment>
}

function App() {
  const { utilizador, aVerificar, eAdministrador } = useSessao()

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
        <Route path="/paginas/:chave" element={<PorEndereco><EditarPagina /></PorEndereco>} />
        <Route path="/comentarios" element={<Comentarios />} />
        <Route path="/perfil" element={<Perfil />} />
        {eAdministrador && <Route path="/utilizadores" element={<Utilizadores />} />}
        {eAdministrador && <Route path="/atividades" element={<Atividades />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default App
