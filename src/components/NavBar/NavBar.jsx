import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import Logo from '../../assets/Logo-ecra.webp'
import AlternarTema from '../AlternarTema/AlternarTema'
import SeletorLingua from '../SeletorLingua/SeletorLingua'
import style from './NavBar.module.css'
import { t } from '../../i18n/linguas'

// o portal académico é uma aplicação à parte, em /portal/
const PORTAL = `${import.meta.env.BASE_URL}portal/`

const LIGACOES = [
  { para: '/Institucional', texto: 'Institucional' },
  { para: '/Cursos', texto: 'Cursos' },
  { para: '/Noticias', texto: 'Notícias' },
  { para: '/Eventos', texto: 'Eventos' },
  { para: '/Artigos', texto: 'Artigos' },
  { para: '/Revista', texto: 'Revista' },
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
          <span>{t('Forças Armadas Angolanas')}</span>
          <span className={style.faixaDireita}>{t('Estabelecimento de Ensino Superior Militar')}</span>
        </div>
      </div>

      <nav className={style.nav} aria-label={t('Navegação principal')}>
        <Link to="/" className={style.marca} onClick={fecharMenu}>
          <img src={Logo} alt="" className={style.logo} />
          <span className={style.nome}>
            <small>{t('Forças Armadas Angolanas')}</small>
            {t('Escola Superior de Guerra')}
          </span>
        </Link>

        <ul className={`${style.menu} ${menuAberto ? style.menuAberto : ''}`}>
          {LIGACOES.map((l) => (
            <li key={l.para}>
              <NavLink to={l.para} onClick={fecharMenu} className={({ isActive }) => (isActive || pathname.startsWith(`${l.para}/`) ? style.ativo : undefined)}>
                {t(l.texto)}
              </NavLink>
            </li>
          ))}
          <li className={style.portalMovel}>
            <a href={PORTAL} className={style.botao}>{t('Portal Académico')}</a>
          </li>
        </ul>

        <div className={style.acoes}>
          <AlternarTema />
          <SeletorLingua />
          <a href={PORTAL} className={`${style.botao} ${style.portalDesktop}`}>{t('Portal Académico')} <span aria-hidden="true">→</span></a>
          <button
            className={`${style.hamburguer} ${menuAberto ? style.hamburguerAberto : ''}`}
            onClick={() => setMenuAberto(!menuAberto)}
            aria-label={menuAberto ? t('Fechar menu') : t('Abrir menu')}
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
