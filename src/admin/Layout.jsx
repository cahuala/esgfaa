import { useState } from 'react'
import { Link, NavLink, useLocation, useMatch } from 'react-router-dom'
import { useSessao } from './sessaoContexto'
import { COLECOES, PAGINAS } from './esquemas'
import Brasao from '../assets/Logo.png'

const SITE = import.meta.env.BASE_URL

// o Color Admin destaca o item ativo pela classe "active" no menu-item
function ItemMenu({ para, icone, texto, fim }) {
  const ativo = useMatch({ path: para, end: Boolean(fim) })
  return (
    <div className={`menu-item ${ativo ? 'active' : ''}`}>
      <NavLink to={para} end={fim} className="menu-link">
        <div className="menu-icon"><i className={`fa ${icone}`} /></div>
        <div className="menu-text">{texto}</div>
      </NavLink>
    </div>
  )
}

function Layout({ children }) {
  const { utilizador, pode, sair } = useSessao()
  const { pathname } = useLocation()
  // os menus guardam o endereço em que foram abertos: ao mudar de página ficam fechados
  const [menuMovelEm, setMenuMovelEm] = useState(null)
  const [menuUtilizadorEm, setMenuUtilizadorEm] = useState(null)
  const menuMovel = menuMovelEm === pathname
  const menuUtilizador = menuUtilizadorEm === pathname
  const setMenuMovel = (aberto) => setMenuMovelEm(aberto ? pathname : null)
  const setMenuUtilizador = (aberto) => setMenuUtilizadorEm(aberto ? pathname : null)
  const [minimizado, setMinimizado] = useState(false)
  const [paginasAberto, setPaginasAberto] = useState(pathname.startsWith('/paginas'))

  const iniciais = utilizador.nome.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div
      id="app"
      className={`app app-header-fixed app-sidebar-fixed ${menuMovel ? 'app-sidebar-mobile-toggled' : ''} ${minimizado ? 'app-sidebar-minified' : ''}`}
    >
      {/* Cabeçalho */}
      <div id="header" className="app-header">
        <div className="navbar-header">
          <Link to="/" className="navbar-brand">
            <img src={Brasao} alt="" className="admin-brasao" /> <b className="me-1">ESGFAA</b> Painel
          </Link>
          <button type="button" className="navbar-mobile-toggler" onClick={() => setMenuMovel(!menuMovel)} aria-label="Abrir menu">
            <span className="icon-bar" /><span className="icon-bar" /><span className="icon-bar" />
          </button>
        </div>

        <div className="navbar-nav">
          <div className="navbar-item">
            <a href={SITE} target="_blank" rel="noreferrer" className="navbar-link icon" title="Ver o site">
              <i className="fa fa-external-link-alt" />
            </a>
          </div>
          <div className={`navbar-item navbar-user dropdown ${menuUtilizador ? 'show' : ''}`}>
            <button type="button" className="navbar-link dropdown-toggle d-flex align-items-center btn btn-link text-decoration-none" onClick={() => setMenuUtilizador(!menuUtilizador)}>
              <span className="admin-avatar">{iniciais}</span>
              <span>
                <span className="d-none d-md-inline fw-bold">{utilizador.nome}</span>
                <b className="caret" />
              </span>
            </button>
            <div className={`dropdown-menu dropdown-menu-end me-1 ${menuUtilizador ? 'show' : ''}`}>
              <div className="dropdown-header">{utilizador.email}</div>
              <Link to="/perfil" className="dropdown-item">O meu perfil</Link>
              <div className="dropdown-divider" />
              <button type="button" className="dropdown-item" onClick={sair}>Sair</button>
            </div>
          </div>
        </div>
      </div>

      {/* Barra lateral */}
      <div id="sidebar" className="app-sidebar" data-bs-theme="dark">
        <div className="app-sidebar-content admin-sidebar-rolavel">
          <div className="menu">
            <div className="menu-profile">
              <div className="menu-profile-link">
                <div className="menu-profile-cover with-shadow" />
                <div className="menu-profile-image"><span className="admin-avatar admin-avatar-grande">{iniciais}</span></div>
                <div className="menu-profile-info">
                  {utilizador.nome}
                  <small>{utilizador.nomePapel}</small>
                </div>
              </div>
            </div>

            <div className="menu-header">Geral</div>
            <ItemMenu para="/" fim icone="fa-th-large" texto="Painel" />
            {pode('estatisticas.ver') && <ItemMenu para="/estatisticas" icone="fa-chart-line" texto="Estatísticas" />}

            <div className="menu-header">Conteúdos</div>
            {Object.entries(COLECOES).filter(([chave]) => chave !== 'publicidade' && pode(`${chave}.ver`)).map(([chave, c]) => (
              <ItemMenu key={chave} para={`/colecao/${chave}`} icone={c.icone} texto={c.titulo} />
            ))}

            {pode('paginas.ver') && (
            <div className={`menu-item has-sub ${paginasAberto ? 'expand' : ''} ${pathname.startsWith('/paginas') ? 'active' : ''}`}>
              <button type="button" className="menu-link w-100 border-0 bg-transparent text-start" onClick={() => setPaginasAberto(!paginasAberto)}>
                <div className="menu-icon"><i className="fa fa-file-alt" /></div>
                <div className="menu-text">Páginas do site</div>
                <div className="menu-caret" />
              </button>
              <div className="menu-submenu" style={{ display: paginasAberto ? 'block' : 'none' }}>
                {Object.entries(PAGINAS).map(([chave, p]) => (
                  <div key={chave} className={`menu-item ${pathname === `/paginas/${chave}` ? 'active' : ''}`}>
                    <NavLink to={`/paginas/${chave}`} className="menu-link">
                      <div className="menu-text">{p.titulo}</div>
                    </NavLink>
                  </div>
                ))}
              </div>
            </div>
            )}

            {(pode('comentarios.ver') || pode('publicidade.ver')) && <div className="menu-header">Interação e publicidade</div>}
            {pode('comentarios.ver') && <ItemMenu para="/comentarios" icone="fa-comments" texto="Comentários" />}
            {pode('publicidade.ver') && <ItemMenu para="/colecao/publicidade" icone="fa-bullhorn" texto="Publicidade" />}

            {(pode('utilizadores.ver') || pode('papeis.ver') || pode('atividades.ver')) && <div className="menu-header">Segurança</div>}
            {pode('utilizadores.ver') && <ItemMenu para="/utilizadores" icone="fa-users-cog" texto="Utilizadores" />}
            {(pode('papeis.ver') || pode('papeis.gerir')) && <ItemMenu para="/papeis" icone="fa-user-shield" texto="Papéis e permissões" />}
            {pode('atividades.ver') && <ItemMenu para="/atividades" icone="fa-shield-alt" texto="Registo de atividades" />}

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
      <div className="app-sidebar-mobile-backdrop">
        <button type="button" className="stretched-link border-0 bg-transparent w-100 h-100" onClick={() => setMenuMovel(false)} aria-label="Fechar menu" />
      </div>

      {/* Conteúdo */}
      <div id="content" className="app-content">
        {children}
      </div>
    </div>
  )
}

export default Layout
