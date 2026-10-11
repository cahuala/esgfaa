import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import Logo from '../../assets/Logo.png'
import AlternarTema from '../AlternarTema/AlternarTema'
import style from './NavBar.module.css'

const LIGACOES = [
  { para: '/Institucional', texto: 'Institucional' },
  { para: '/Cursos', texto: 'Cursos' },
  { para: '/Noticias', texto: 'Notícias' },
  { para: '/Eventos', texto: 'Eventos' },
  { para: '/Artigos', texto: 'Artigos' },
  { para: '/Contactos', texto: 'Contactos' },
]

function NavBar() {
  const [menuAberto, setMenuAberto] = useState(false)
  const [rolou, setRolou] = useState(false)
  const { pathname } = useLocation()
  const fecharMenu = () => setMenuAberto(false)

  useEffect(() => {
    const aoRolar = () => setRolou(window.scrollY > 8)
    aoRolar()
    window.addEventListener('scroll', aoRolar, { passive: true })
    return () => window.removeEventListener('scroll', aoRolar)
  }, [])

  return (
    <header className={`${style.cabecalho} ${rolou || menuAberto ? style.comSombra : ''}`}>
      {/* faixa institucional */}
      <div className={style.faixa}>
        <div className={style.faixaConteudo}>
          <span>Forças Armadas Angolanas</span>
          <span className={style.faixaDireita}>Estabelecimento de Ensino Superior Militar</span>
        </div>
      </div>

      <nav className={style.nav} aria-label="Navegação principal">
        <Link to="/" className={style.marca} onClick={fecharMenu}>
          <img src={Logo} alt="" className={style.logo} />
          <span className={style.nome}>
            <small>Forças Armadas Angolanas</small>
            Escola Superior de Guerra
          </span>
        </Link>

        <ul className={`${style.menu} ${menuAberto ? style.menuAberto : ''}`}>
          {LIGACOES.map((l) => (
            <li key={l.para}>
              <NavLink to={l.para} onClick={fecharMenu} className={({ isActive }) => (isActive || pathname.startsWith(`${l.para}/`) ? style.ativo : undefined)}>
                {l.texto}
              </NavLink>
            </li>
          ))}
          <li className={style.portalMovel}>
            <a href="#" className={style.botao}>Portal Académico</a>
          </li>
        </ul>

        <div className={style.acoes}>
          <AlternarTema />
          <a href="#" className={`${style.botao} ${style.portalDesktop}`}>Portal Académico <span aria-hidden="true">→</span></a>
          <button
            className={`${style.hamburguer} ${menuAberto ? style.hamburguerAberto : ''}`}
            onClick={() => setMenuAberto(!menuAberto)}
            aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={menuAberto}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </nav>
    </header>
  )
}

export default NavBar
