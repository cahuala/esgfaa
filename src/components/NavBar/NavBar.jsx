import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import Logo from '../../assets/Logo.png'
import style from './NavBar.module.css'

function NavBar() {
  const [menuAberto, setMenuAberto] = useState(false)
  const fecharMenu = () => setMenuAberto(false)

  return (
    <nav>
      <div className={style.topo}>
        <img src={Logo} alt="ESGFAA" className={style.Logo} />

        <div className={style.acoes}>
          <button className={`${style.Btn} ${style.BtnCompacto}`}>Portal Académico</button>
          <button
            className={`${style.hamburguer} ${menuAberto ? style.hamburguerAberto : ''}`}
            onClick={() => setMenuAberto(!menuAberto)}
            aria-label="Abrir menu"
            aria-expanded={menuAberto}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </div>

      <ul className={`${style.menu} ${menuAberto ? style.menuAberto : ''}`}>
        <li><NavLink to="/Institucional" onClick={fecharMenu}>Institucional</NavLink></li>
        <li><NavLink to="/Eventos" onClick={fecharMenu}>Eventos</NavLink></li>
        <li><NavLink to="/Cursos" onClick={fecharMenu}>Cursos</NavLink></li>
        <li><NavLink to="/Noticias" onClick={fecharMenu}>Notícias</NavLink></li>
        <li><NavLink to="/Artigos" onClick={fecharMenu}>Artigos</NavLink></li>
        <li><NavLink to="/Contactos" onClick={fecharMenu}>Contactos</NavLink></li>
      </ul>

      <div className={style.BtnCaixaDesktop}>
        <button className={style.Btn}>Portal Académico</button>
      </div>
    </nav>
  )
}

export default NavBar