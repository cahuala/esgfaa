import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useSessao } from './sessaoContexto'
import { Carregando } from './componentes'
import Layout from './Layout'
import Entrar from './paginas/Entrar'
import MudarSenha from './paginas/MudarSenha'
import Inicio from './paginas/Inicio'
import MinhaTurma from './paginas/MinhaTurma'
import Cadeiras from './paginas/Cadeiras'
import Cadeira from './cadeira/Cadeira'
import Notas from './paginas/Notas'
import Percurso from './paginas/Percurso'
import Calendario from './paginas/Calendario'
import Notificacoes from './paginas/Notificacoes'
import Mensagens from './paginas/Mensagens'
import Banco from './cadeira/Banco'
import Horario from './paginas/Horario'
import Pedidos from './paginas/Pedidos'
import Avisos from './paginas/Avisos'
import Perfil from './paginas/Perfil'
import Certificado from './cadeira/Certificado'
import Verificar from './paginas/Verificar'
import Pesquisa from './paginas/Pesquisa'
import Inqueritos from './paginas/Inqueritos'
import Biblioteca, { LerObra, MeusEmprestimos } from './paginas/Biblioteca'
import Originalidade from './paginas/Originalidade'
import JanelaDialogo from './JanelaDialogo'

function App() {
  const { conta, aVerificar, eDocente } = useSessao()
  const { pathname } = useLocation()
  // a verificação de certificados é pública: não precisa de sessão
  if (pathname.startsWith('/verificar')) {
    return <Routes><Route path="/verificar" element={<Verificar />} /><Route path="/verificar/:codigo" element={<Verificar />} /></Routes>
  }
  if (aVerificar) return <div className="p-ecra-centro"><Carregando /></div>
  if (!conta) return <Entrar />
  // com a palavra-passe inicial (o e-mail) não se usa mais nada
  if (conta.deveMudarSenha) return <MudarSenha obrigatoria />

  return (
    <Layout>
      <JanelaDialogo />
      <Routes>
        {/* o estudante entra na sua turma; o docente no painel */}
        <Route path="/" element={eDocente ? <Inicio /> : <MinhaTurma />} />
        {!eDocente && <Route path="/painel" element={<Inicio />} />}
        <Route path="/cadeiras" element={<Cadeiras />} />
        <Route path="/cadeiras/:id" element={<Cadeira />} />
        <Route path="/horario" element={<Horario />} />
        <Route path="/calendario" element={<Calendario />} />
        <Route path="/notificacoes" element={<Notificacoes />} />
        <Route path="/mensagens" element={<Mensagens />} />
        <Route path="/mensagens/:id" element={<Mensagens />} />
        {eDocente && <Route path="/banco" element={<Banco />} />}
        {!eDocente && <Route path="/cadeiras/:id/certificado" element={<Certificado />} />}
        {!eDocente && <Route path="/notas" element={<Notas />} />}
        {!eDocente && <Route path="/percurso" element={<Percurso />} />}
        {!eDocente && <Route path="/pedidos" element={<Pedidos />} />}
        {!eDocente && <Route path="/avisos" element={<Avisos />} />}
        <Route path="/pesquisa" element={<Pesquisa />} />
        <Route path="/inqueritos" element={<Inqueritos />} />
        <Route path="/inqueritos/:id" element={<Inqueritos />} />
        <Route path="/integridade" element={<Originalidade />} />
        <Route path="/integridade/:id" element={<Originalidade />} />
        <Route path="/biblioteca" element={<Biblioteca />} />
        <Route path="/biblioteca/emprestimos" element={<MeusEmprestimos />} />
        <Route path="/biblioteca/:id" element={<Biblioteca />} />
        <Route path="/biblioteca/:id/ler" element={<LerObra />} />
        <Route path="/perfil" element={<Perfil />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default App
