import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useMatch } from 'react-router-dom'
import { useSessao } from './sessaoContexto'
import { COLECOES, PAGINAS } from './esquemas'
import Brasao from '../assets/Logo.png'
import Sede from '../assets/Escola De Guerra.png'

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
  const menuRef = useRef(null)

  // fecha o menu do utilizador ao clicar fora ou com Esc
  useEffect(() => {
    if (!menuUtilizador) return
    const fora = (e) => { if (!menuRef.current?.contains(e.target)) setMenuUtilizadorEm(null) }
    const esc = (e) => { if (e.key === 'Escape') setMenuUtilizadorEm(null) }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [menuUtilizador])
  const [paginasAberto, setPaginasAberto] = useState(pathname.startsWith('/paginas'))

  const iniciais = utilizador.nome.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()

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
              <b>Painel de gestão</b>
              <small>Escola Superior de Guerra</small>
            </span>
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
          <div ref={menuRef} className={`navbar-item navbar-user dropdown esg-menu-utilizador ${menuUtilizador ? 'show' : ''}`}>
            <button type="button" className="navbar-link dropdown-toggle d-flex align-items-center" aria-expanded={menuUtilizador} onClick={() => setMenuUtilizador(!menuUtilizador)}>
              <span className="admin-avatar">{iniciais}</span>
              <span>
                <span className="d-none d-md-inline fw-bold">{utilizador.nome}</span>
                <b className="caret" />
              </span>
            </button>
            {menuUtilizador && (
              <div className="dropdown-menu dropdown-menu-end show esg-menu-lista" data-bs-popper="static">
                <div className="esg-menu-cabecalho">
                  <span className="admin-avatar admin-avatar-grande">{iniciais}</span>
                  <div>
                    <strong>{utilizador.nome}</strong>
                    <small>{utilizador.email}</small>
                    <span className="esg-menu-papel">{utilizador.nomePapel}</span>
                  </div>
                </div>
                <Link to="/perfil" className="dropdown-item"><i className="fa fa-user-circle fa-fw me-2" />O meu perfil</Link>
                <Link to="/perfil" className="dropdown-item"><i className="fa fa-key fa-fw me-2" />Alterar palavra-passe</Link>
                <a href={SITE} target="_blank" rel="noreferrer" className="dropdown-item"><i className="fa fa-globe fa-fw me-2" />Ver o site</a>
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
              <div className="esg-marca-sub">Forças Armadas Angolanas</div>
              <Link to="/perfil" className="esg-marca-utilizador">
                <span className="admin-avatar admin-avatar-grande">{iniciais}</span>
                <span>
                  <strong>{utilizador.nome}</strong>
                  <small>{utilizador.nomePapel}</small>
                </span>
              </Link>
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
        {utilizador.deveMudarSenha && (
          <div className="alert alert-warning d-flex align-items-center mb-3" role="alert">
            <i className="fa fa-shield-alt fa-lg me-3" />
            <div className="flex-fill">
              <strong>Mude a sua palavra-passe.</strong> A atual foi definida por outra pessoa ou já não cumpre as regras de segurança
              (mínimo de 10 caracteres, com letras e números).
            </div>
            <Link to="/perfil" className="btn btn-sm btn-warning ms-3">Mudar agora</Link>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

export default Layout
