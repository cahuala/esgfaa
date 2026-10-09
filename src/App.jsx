import { Routes, Route } from 'react-router-dom'
import NavBar from './components/NavBar/NavBar'
import Footer from './components/Footer/Footer'
import GestorScroll from './components/GestorScroll/GestorScroll'
import Home from './pages/Home/Home'
import Institucional from './pages/Institucional/Institucional'
import Noticias from './pages/Noticias/Noticias'
import NoticiaDetalhe from './pages/Noticias/NoticiaDetalhe'
import Eventos from './pages/Eventos/Eventos'
import EventoDetalhe from './pages/Eventos/EventoDetalhe'
import Artigos from './pages/Artigos/Artigos'
import ArtigoDetalhe from './pages/Artigos/ArtigoDetalhe'
import Contactos from './pages/Contactos/Contactos'
import NaoEncontrado from './pages/NaoEncontrado/NaoEncontrado'

function App() {
  return (
    <div>
      <GestorScroll />
      <NavBar/>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/Institucional" element={<Institucional />} />
        <Route path="/Noticias" element={<Noticias />} />
        <Route path="/Noticias/:slug" element={<NoticiaDetalhe />} />
        <Route path="/Eventos" element={<Eventos />} />
        <Route path="/Eventos/:id" element={<EventoDetalhe />} />
        <Route path="/Artigos" element={<Artigos />} />
        <Route path="/Artigos/:slug" element={<ArtigoDetalhe />} />
        <Route path="/Contactos" element={<Contactos />} />
        <Route path="*" element={<NaoEncontrado />} />
      </Routes>
       <Footer/>
    </div>
  )
}

export default App
