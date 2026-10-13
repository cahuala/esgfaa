import { useEffect, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { FaBook, FaCalendarAlt, FaChevronDown, FaClipboardList, FaFileAlt, FaHome, FaSignOutAlt, FaUser, FaBullhorn } from 'react-icons/fa'
import Logo from '../assets/Logo.png'
import AlternarTema from '../components/AlternarTema/AlternarTema'
import { useSessao } from './sessaoContexto'
import { iniciais, primeiroNome } from './formatar'

const SITE = import.meta.env.BASE_URL

// moldura do portal: cabeçalho com o menu e a conta
function Layout({ children }) {
  const { conta, eDocente, sair } = useSessao()
  const [menu, setMenu] = useState(false)
  const caixa = useRef(null)
  useEffect(() => {
    const fora = (e) => { if (!caixa.current?.contains(e.target)) setMenu(false) }
    document.addEventListener('click', fora)
    return () => document.removeEventListener('click', fora)
  }, [])

  const ligacoes = [
    { para: '/', texto: 'Início', Icone: FaHome, fim: true },
    { para: '/cadeiras', texto: eDocente ? 'As minhas cadeiras' : 'Cadeiras', Icone: FaBook },
    ...(eDocente ? [] : [{ para: '/notas', texto: 'Notas', Icone: FaClipboardList }]),
    { para: '/horario', texto: 'Horário', Icone: FaCalendarAlt },
    ...(eDocente ? [] : [{ para: '/avisos', texto: 'Avisos', Icone: FaBullhorn }, { para: '/pedidos', texto: 'Pedidos', Icone: FaFileAlt }]),
  ]

  return (
    <div className="p-app">
      <header className="p-cabecalho">
        <div className="p-faixa">
          <div className="p-contentor">Escola Superior de Guerra · Portal Académico</div>
        </div>
        <div className="p-contentor p-barra">
          <Link to="/" className="p-marca">
            <img src={Logo} alt="" />
            <span><small>Escola Superior de Guerra</small>Portal Académico</span>
          </Link>
          <nav className="p-menu" aria-label="Portal">
            {ligacoes.map(({ para, texto, Icone, fim }) => (
              <NavLink key={para} to={para} end={fim} className={({ isActive }) => (isActive ? 'p-ativo' : undefined)}>
                <Icone aria-hidden="true" /> <span>{texto}</span>
              </NavLink>
            ))}
          </nav>
          <div className="p-conta" ref={caixa}>
            <AlternarTema />
            <button type="button" className="p-conta-botao" onClick={() => setMenu(!menu)} aria-expanded={menu}>
              <span className="p-avatar">{iniciais(conta.nome)}</span>
              <span className="p-conta-nome">{primeiroNome(conta.nome)}</span>
              <FaChevronDown aria-hidden="true" />
            </button>
            {menu && (
              <div className="p-conta-menu">
                <strong>{conta.nome}</strong>
                <span>{eDocente ? 'Docente' : 'Estudante'} · {conta.numero}</span>
                <Link to="/perfil" onClick={() => setMenu(false)}><FaUser aria-hidden="true" /> O meu perfil</Link>
                <a href={SITE}>Site da Escola</a>
                <button type="button" onClick={sair}><FaSignOutAlt aria-hidden="true" /> Sair</button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="p-contentor p-principal">{children}</main>
      <footer className="p-rodape">
        <div className="p-contentor">© {new Date().getFullYear()} Escola Superior de Guerra das Forças Armadas Angolanas · Secretaria Académica</div>
      </footer>
    </div>
  )
}

export default Layout
