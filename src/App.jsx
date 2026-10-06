import { Routes, Route } from 'react-router-dom'
import NavBar from './components/NavBar/NavBar'
import Footer from './components/Footer/Footer'
import Home from './pages/Home/Home'
import Institucional from './pages/Institucional'
import Eventos from './pages/Eventos'

function App() {
  return (
    <div>
      <NavBar/>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/Institucional" element={<Institucional />} />
        <Route path="/Eventos" element={<Eventos />} />
      </Routes>
       <Footer/>
    </div>
  )
}

export default App
