import { Navigate, Route, Routes } from 'react-router-dom'
import { useSessao } from './sessaoContexto'
import { Carregando } from './componentes'
import Layout from './Layout'
import Entrar from './paginas/Entrar'
import MudarSenha from './paginas/MudarSenha'
import Inicio from './paginas/Inicio'
import Cadeiras from './paginas/Cadeiras'
import Cadeira from './cadeira/Cadeira'
import Notas from './paginas/Notas'
import Percurso from './paginas/Percurso'
import Calendario from './paginas/Calendario'
import Horario from './paginas/Horario'
import Pedidos from './paginas/Pedidos'
import Avisos from './paginas/Avisos'
import Perfil from './paginas/Perfil'

function App() {
  const { conta, aVerificar, eDocente } = useSessao()
  if (aVerificar) return <div className="p-ecra-centro"><Carregando /></div>
  if (!conta) return <Entrar />
  // com a palavra-passe inicial (o e-mail) não se usa mais nada
  if (conta.deveMudarSenha) return <MudarSenha obrigatoria />

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/cadeiras" element={<Cadeiras />} />
        <Route path="/cadeiras/:id" element={<Cadeira />} />
        <Route path="/horario" element={<Horario />} />
        <Route path="/calendario" element={<Calendario />} />
        {!eDocente && <Route path="/notas" element={<Notas />} />}
        {!eDocente && <Route path="/percurso" element={<Percurso />} />}
        {!eDocente && <Route path="/pedidos" element={<Pedidos />} />}
        {!eDocente && <Route path="/avisos" element={<Avisos />} />}
        <Route path="/perfil" element={<Perfil />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default App
