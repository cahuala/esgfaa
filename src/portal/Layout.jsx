import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useMatch, useNavigate } from 'react-router-dom'
import Brasao from '../assets/Logo.png'
import Sede from '../assets/Escola De Guerra.png'
import { useTema } from '../tema/useTema'
import { useSessao } from './sessaoContexto'
import { iniciais } from './formatar'
import CabecalhoAvisos from './CabecalhoAvisos'

const SITE = import.meta.env.BASE_URL

// o Color Admin destaca o item ativo pela classe "active" no menu-item
function ItemMenu({ para, icone, texto, fim, etiqueta }) {
  const ativo = useMatch({ path: para, end: Boolean(fim) })
  return (
    <div className={`menu-item ${ativo ? 'active' : ''}`}>
      <NavLink to={para} end={fim} className="menu-link">
        <div className="menu-icon"><i className={`fa ${icone}`} /></div>
        <div className="menu-text">{texto}</div>
        {etiqueta ? <div className="menu-badge">{etiqueta}</div> : null}
      </NavLink>
    </div>
  )
}

// moldura do portal no tema do painel (Color Admin): cabeçalho, barra lateral com o perfil e o menu
function Layout({ children }) {
  const { conta, eDocente, sair } = useSessao()
  const { pathname } = useLocation()
  const navegar = useNavigate()
  const { tema, alternar } = useTema()
  // os menus guardam o endereço em que foram abertos: ao mudar de página ficam fechados
  const [menuMovelEm, setMenuMovelEm] = useState(null)
  const [contaEm, setContaEm] = useState(null)
  const [minimizado, setMinimizado] = useState(false)
  const caixa = useRef(null)
  const menuMovel = menuMovelEm === pathname
  const menuConta = contaEm === pathname

  useEffect(() => { document.documentElement.setAttribute('data-bs-theme', tema) }, [tema])
  useEffect(() => {
    if (!menuConta) return undefined
    const fora = (e) => { if (!caixa.current?.contains(e.target)) setContaEm(null) }
    const esc = (e) => { if (e.key === 'Escape') setContaEm(null) }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [menuConta])

  const papel = eDocente ? 'Docente' : 'Estudante'
  const turma = conta.matriculas?.find((m) => m.estado === 'ativa')?.turma?.nome

  return (
    <div
      id="app"
      style={{ '--esg-sede': `url("${Sede}")` }}
      className={`app app-header-fixed app-sidebar-fixed ${menuMovel ? 'app-sidebar-mobile-toggled' : ''} ${minimizado ? 'app-sidebar-minified' : ''}`}
    >
      {/* Cabeçalho */}
      <div id="header" className="app-header">
        <div className="navbar-header">
          <Link to="/" className="navbar-brand">
            <img src={Brasao} alt="" className="admin-brasao" />
            <span className="esg-cabecalho-titulo">
              <b>Portal Académico</b>
              <small>Escola Superior de Guerra</small>
            </span>
          </Link>
          <button type="button" className="navbar-mobile-toggler" onClick={() => setMenuMovelEm(menuMovel ? null : pathname)} aria-label="Abrir menu">
            <span className="icon-bar" /><span className="icon-bar" /><span className="icon-bar" />
          </button>
        </div>

        <div className="navbar-nav">
          <div className="navbar-item navbar-form d-none d-md-block">
            <form onSubmit={(e) => { e.preventDefault(); const q = e.currentTarget.q.value.trim(); if (q) navegar(`/pesquisa?q=${encodeURIComponent(q)}`) }} role="search">
              <div className="form-group">
                <input name="q" type="search" className="form-control" placeholder="Pesquisar no portal" aria-label="Pesquisar no portal" />
                <button type="submit" className="btn btn-search" aria-label="Pesquisar"><i className="fa fa-search" /></button>
              </div>
            </form>
          </div>
          <div className="navbar-item d-md-none">
            <Link to="/pesquisa" className="navbar-link icon" aria-label="Pesquisar"><i className="fa fa-search" /></Link>
          </div>
          <div className="navbar-item">
            <button type="button" className="navbar-link icon border-0 bg-transparent" onClick={alternar} title={tema === 'dark' ? 'Modo claro' : 'Modo escuro'} aria-label={tema === 'dark' ? 'Mudar para o modo claro' : 'Mudar para o modo escuro'}>
              <i className={`fa ${tema === 'dark' ? 'fa-sun' : 'fa-moon'}`} />
            </button>
          </div>
          <CabecalhoAvisos />
          <div className="navbar-item d-none d-md-block">
            <a href={SITE} target="_blank" rel="noreferrer" className="navbar-link icon" title="Site da Escola">
              <i className="fa fa-globe" />
            </a>
          </div>
          <div ref={caixa} className={`navbar-item navbar-user dropdown esg-menu-utilizador ${menuConta ? 'show' : ''}`}>
            <button type="button" className="navbar-link dropdown-toggle d-flex align-items-center p-conta-botao" aria-expanded={menuConta} onClick={() => setContaEm(menuConta ? null : pathname)}>
              <span className="admin-avatar">{iniciais(conta.nome)}</span>
              <span>
                <span className="d-none d-md-inline fw-bold">{conta.nome}</span>
                <b className="caret" />
              </span>
            </button>
            {menuConta && (
              <div className="dropdown-menu dropdown-menu-end show esg-menu-lista" data-bs-popper="static">
                <div className="esg-menu-cabecalho">
                  <span className="admin-avatar admin-avatar-grande">{iniciais(conta.nome)}</span>
                  <div>
                    <strong>{conta.nome}</strong>
                    <small>{conta.email}</small>
                    <span className="esg-menu-papel">{papel} · {conta.numero}</span>
                  </div>
                </div>
                <Link to="/perfil" className="dropdown-item"><i className="fa fa-user-circle fa-fw me-2" />O meu perfil</Link>
                {!eDocente && <Link to="/percurso" className="dropdown-item"><i className="fa fa-route fa-fw me-2" />Percurso académico</Link>}
                <a href={SITE} className="dropdown-item"><i className="fa fa-globe fa-fw me-2" />Site da Escola</a>
                <div className="dropdown-divider" />
                <button type="button" className="dropdown-item text-danger" onClick={sair}><i className="fa fa-sign-out-alt fa-fw me-2" />Sair</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Barra lateral */}
      <div id="sidebar" className="app-sidebar" data-bs-theme="dark">
        <div className="app-sidebar-content admin-sidebar-rolavel">
          <div className="menu">
            <div className="esg-marca">
              <img src={Brasao} alt="Brasão da Escola Superior de Guerra" className="esg-marca-brasao" />
              <div className="esg-marca-nome">Escola Superior de Guerra</div>
              <div className="esg-marca-sub">Portal Académico</div>
              <Link to="/perfil" className="esg-marca-utilizador">
                <span className="admin-avatar admin-avatar-grande">{iniciais(conta.nome)}</span>
                <span>
                  <strong>{conta.nome}</strong>
                  <small>{papel}{turma ? ` · ${turma}` : ''}</small>
                </span>
              </Link>
            </div>

            <div className="menu-header">Geral</div>
            <ItemMenu para="/" fim icone="fa-th-large" texto="Painel" />
            <ItemMenu para="/calendario" icone="fa-calendar-alt" texto="Calendário" />
            <ItemMenu para="/cadeiras" icone="fa-book" texto={eDocente ? 'As minhas cadeiras' : 'As minhas cadeiras'} />
            <ItemMenu para="/horario" icone="fa-clock" texto="Horário" />
            {eDocente && <ItemMenu para="/banco" icone="fa-archive" texto="Banco de perguntas" />}

            {!eDocente && (
              <>
                <div className="menu-header">Avaliação</div>
                <ItemMenu para="/notas" icone="fa-clipboard-list" texto="Notas" />
                <ItemMenu para="/percurso" icone="fa-route" texto="Percurso académico" />

                <div className="menu-header">Administração Escolar</div>
                <ItemMenu para="/avisos" icone="fa-bullhorn" texto="Avisos" />
                <ItemMenu para="/pedidos" icone="fa-file-signature" texto="Pedidos de documentos" />
              </>
            )}

            <div className="menu-header">Comunicação</div>
            <ItemMenu para="/mensagens" icone="fa-envelope" texto="Mensagens" />
            <ItemMenu para="/notificacoes" icone="fa-bell" texto="Notificações" />

            <div className="menu-header">Conta</div>
            <ItemMenu para="/perfil" icone="fa-user-circle" texto="O meu perfil" />

            <div className="menu-divider" />
            <div className="menu-item d-flex">
              <button type="button" className="app-sidebar-minify-btn ms-auto border-0" onClick={() => setMinimizado(!minimizado)} aria-label="Minimizar menu">
                <i className="fa fa-angle-double-left" />
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="app-sidebar-bg" data-bs-theme="dark" />
      <div className="app-sidebar-mobile-backdrop"><button type="button" className="stretched-link border-0 bg-transparent w-100" onClick={() => setMenuMovelEm(null)} aria-label="Fechar menu" /></div>

      {/* Conteúdo */}
      <div id="content" className="app-content">
        {children}
      </div>
    </div>
  )
}

export default Layout
