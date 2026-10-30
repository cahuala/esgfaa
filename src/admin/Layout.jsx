import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useMatch } from 'react-router-dom'
import { useSessao } from './sessaoContexto'
import { COLECOES, PAGINAS } from './esquemas'
import Brasao from '../assets/Logo-ecra.webp'
import Sede from '../assets/Escola De Guerra-ecra.webp'
import { t as tx } from '../i18n/linguas'
import SeletorLinguaPainel from '../i18n/SeletorLinguaPainel'
import { api } from './api'
import AvisoPrivacidade from '../components/AvisoPrivacidade'

const SITE = import.meta.env.BASE_URL

// o Color Admin destaca o item ativo pela classe "active" no menu-item
function ItemMenu({ para, icone, texto, fim, contador = 0 }) {
  const ativo = useMatch({ path: para, end: Boolean(fim) })
  return (
    <div className={`menu-item ${ativo ? 'active' : ''}`}>
      <NavLink to={para} end={fim} className="menu-link">
        <div className="menu-icon"><i className={`fa ${icone}`} /></div>
        <div className="menu-text">{texto}</div>
        {contador > 0 && <div className="menu-badge"><span className="badge bg-danger">{contador}</span></div>}
      </NavLink>
    </div>
  )
}

// aviso de privacidade na primeira entrada no painel
const obterPrivacidade = () => api('/eu/privacidade')
const aceitarPrivacidade = () => api('/eu/privacidade', { metodo: 'POST' })

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
  // mensagens novas do formulário de contacto (contador no menu)
  const [contactosNovos, setContactosNovos] = useState(0)
  const verContactos = pode('contactos.ver')
  useEffect(() => {
    if (!verContactos) return undefined
    const contar = () => api('/contactos/novas').then((r) => setContactosNovos(r.novas)).catch(() => {})
    contar()
    const id = setInterval(contar, 120_000)
    window.addEventListener('esg-contactos', contar)
    return () => { clearInterval(id); window.removeEventListener('esg-contactos', contar) }
  }, [verContactos])
  // o que espera por decisão na gestão académica (provas por imprimir, alterações de notas, docentes por verificar)
  const [pendentes, setPendentes] = useState({})
  const verAcademico = pode('academico.ver')
  useEffect(() => {
    if (!verAcademico) return undefined
    const contar = () => api('/academico/pendentes').then(setPendentes).catch(() => {})
    contar()
    const id = setInterval(contar, 120_000)
    window.addEventListener('esg-pendentes', contar)
    return () => { clearInterval(id); window.removeEventListener('esg-pendentes', contar) }
  }, [verAcademico])
  // publicações à espera do Comandante (contador no menu)
  const [porAprovar, setPorAprovar] = useState(0)
  const aprova = pode('publicacoes.aprovar')
  useEffect(() => {
    if (!aprova) return undefined
    const contar = () => api('/publicacoes/contagem').then((r) => setPorAprovar(r.pendentes)).catch(() => {})
    contar()
    const id = setInterval(contar, 120_000)
    window.addEventListener('esg-publicacoes', contar)
    return () => { clearInterval(id); window.removeEventListener('esg-publicacoes', contar) }
  }, [aprova])
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
              <b>{tx('Painel de gestão')}</b>
              <small>{tx('Escola Superior de Guerra')}</small>
            </span>
          </Link>
          <button type="button" className="navbar-mobile-toggler" onClick={() => setMenuMovel(!menuMovel)} aria-label={tx('Abrir menu')}>
            <span className="icon-bar" /><span className="icon-bar" /><span className="icon-bar" />
          </button>
        </div>

        <div className="navbar-nav">
          <div className="navbar-item">
            <a href={SITE} target="_blank" rel="noreferrer" className="navbar-link icon" title={tx('Ver o site')}>
              <i className="fa fa-external-link-alt" />
            </a>
          </div>
          <SeletorLinguaPainel />
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
                    <span className="esg-menu-papel">{tx(utilizador.nomePapel)}</span>
                  </div>
                </div>
                <Link to="/perfil" className="dropdown-item"><i className="fa fa-user-circle fa-fw me-2" />{tx('O meu perfil')}</Link>
                <Link to="/perfil" className="dropdown-item"><i className="fa fa-key fa-fw me-2" />{tx('Alterar palavra-passe')}</Link>
                <a href={SITE} target="_blank" rel="noreferrer" className="dropdown-item"><i className="fa fa-globe fa-fw me-2" />{tx('Ver o site')}</a>
                {/* o painel usa o manual do Portal Académico (tem as partes da administração, da redação e da biblioteca) */}
                <a href={`${SITE}portal/manual/index.html`} target="_blank" rel="noreferrer" className="dropdown-item"><i className="fa fa-book fa-fw me-2" />{tx('Manual de utilização')}</a>
                <div className="dropdown-divider" />
                <button type="button" className="dropdown-item text-danger" onClick={sair}><i className="fa fa-sign-out-alt fa-fw me-2" />{tx('Sair')}</button>
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
              <img src={Brasao} alt={tx('Brasão da Escola Superior de Guerra')} className="esg-marca-brasao" />
              <div className="esg-marca-nome">{tx('Escola Superior de Guerra')}</div>
              <div className="esg-marca-sub">{tx('Forças Armadas Angolanas')}</div>
              <Link to="/perfil" className="esg-marca-utilizador">
                <span className="admin-avatar admin-avatar-grande">{iniciais}</span>
                <span>
                  <strong>{utilizador.nome}</strong>
                  <small>{tx(utilizador.nomePapel)}</small>
                </span>
              </Link>
            </div>

            <div className="menu-header">{tx('Geral')}</div>
            <ItemMenu para="/" fim icone="fa-th-large" texto={tx('Painel')} />
            {aprova && <ItemMenu para="/publicacoes" icone="fa-stamp" texto={tx('Publicações por aprovar')} contador={porAprovar} />}
            {pode('estatisticas.ver') && <ItemMenu para="/estatisticas" icone="fa-chart-line" texto={tx('Estatísticas')} />}

            {(pode('paginas.ver') || Object.keys(COLECOES).some((chave) => chave !== 'publicidade' && pode(`${chave}.ver`))) && <div className="menu-header">{tx('Conteúdos')}</div>}
            {Object.entries(COLECOES).filter(([chave]) => chave !== 'publicidade' && pode(`${chave}.ver`)).map(([chave, c]) => (
              <ItemMenu key={chave} para={`/colecao/${chave}`} icone={c.icone} texto={c.titulo} />
            ))}

            {pode('paginas.ver') && (
            <div className={`menu-item has-sub ${paginasAberto ? 'expand' : ''} ${pathname.startsWith('/paginas') ? 'active' : ''}`}>
              <button type="button" className="menu-link w-100 border-0 bg-transparent text-start" onClick={() => setPaginasAberto(!paginasAberto)}>
                <div className="menu-icon"><i className="fa fa-file-alt" /></div>
                <div className="menu-text">{tx('Páginas do site')}</div>
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
            {pode('paginas.editar') && <ItemMenu para="/traducoes-dados" icone="fa-language" texto={tx('Traduções dos dados')} />}

            {pode('biblioteca.ver') && <div className="menu-header">{tx('Biblioteca')}</div>}
            {pode('biblioteca.ver') && <ItemMenu para="/biblioteca" icone="fa-book" texto={tx('Catálogo')} fim />}
            {pode('biblioteca.ver') && <ItemMenu para="/biblioteca/emprestimos" icone="fa-hand-holding" texto={tx('Empréstimos')} />}

            {pode('pessoal.ver') && <div className="menu-header">{tx('Pessoal e Quadros')}</div>}
            {pode('pessoal.ver') && <ItemMenu para="/pessoal/registo" icone="fa-id-card" texto={tx('Estudantes e docentes')} />}

            {pode('academico.ver') && <div className="menu-header">{tx('Administração Escolar')}</div>}
            {pode('academico.ver') && <ItemMenu para="/academico/alteracoes-notas" icone="fa-user-shield" texto={tx('Alterações de notas')} contador={pode('academico.homologar') ? pendentes.alteracoesPendentes : 0} />}
            {pode('academico.ver') && <ItemMenu para="/academico/docentes" icone="fa-user-check" texto={tx('Docentes (verificação)')} contador={pode('academico.homologar') ? pendentes.docentesPorVerificar : 0} />}
            {pode('academico.ver') && <ItemMenu para="/academico/provas-escritas" icone="fa-print" texto={tx('Provas para imprimir')} contador={pode('academico.gerir') ? pendentes.provasPorImprimir : 0} />}
            {pode('academico.ver') && <ItemMenu para="/academico/indicadores" icone="fa-chart-pie" texto={tx('Indicadores académicos')} />}
            {pode('academico.ver') && <ItemMenu para="/academico/satisfacao" icone="fa-poll" texto={tx('Inquéritos de satisfação')} />}
            {pode('integridade.ver') && <ItemMenu para="/integridade" icone="fa-fingerprint" texto={tx('Integridade académica')} />}
            {pode('academico.ver') && <ItemMenu para="/academico/turmas" icone="fa-users" texto={tx('Turmas e matrículas')} />}
            {pode('academico.ver') && <ItemMenu para="/academico/alocacao" icone="fa-chalkboard-teacher" texto={tx('Alocação de docentes')} />}
            {pode('academico.ver') && <ItemMenu para="/academico/calendario" icone="fa-calendar-alt" texto={tx('Calendário académico')} />}
            {pode('academico.ver') && !pode('pessoal.ver') && <ItemMenu para="/pessoal/registo" icone="fa-id-card" texto={tx('Consultar registo de pessoas')} />}
            {pode('academico.ver') && <ItemMenu para="/academico/pedidos" icone="fa-file-signature" texto={tx('Pedidos de documentos')} />}
            {pode('academico.ver') && <ItemMenu para="/academico/avisos" icone="fa-bullhorn" texto={tx('Avisos do portal')} />}
            {pode('academico.ver') && <ItemMenu para="/academico/lti" icone="fa-plug" texto={tx('Ferramentas externas (LTI)')} />}

            {(pode('comentarios.ver') || pode('publicidade.ver') || verContactos) && <div className="menu-header">{tx('Interação e publicidade')}</div>}
            {verContactos && <ItemMenu para="/mensagens-site" icone="fa-envelope-open-text" texto={tx('Mensagens do site')} contador={contactosNovos} />}
            {pode('comentarios.ver') && <ItemMenu para="/comentarios" icone="fa-comments" texto={tx('Comentários')} />}
            {pode('publicidade.ver') && <ItemMenu para="/colecao/publicidade" icone="fa-bullhorn" texto={tx('Publicidade')} />}

            {(pode('utilizadores.ver') || pode('papeis.ver') || pode('atividades.ver') || pode('seguranca.ver')) && <div className="menu-header">{tx('Segurança')}</div>}
            {pode('seguranca.ver') && <ItemMenu para="/seguranca" icone="fa-user-shield" texto={tx('Centro de segurança')} />}
            {pode('utilizadores.ver') && <ItemMenu para="/utilizadores" icone="fa-users-cog" texto={tx('Utilizadores')} />}
            {(pode('papeis.ver') || pode('papeis.gerir')) && <ItemMenu para="/papeis" icone="fa-user-shield" texto={tx('Papéis e permissões')} />}
            {pode('atividades.ver') && <ItemMenu para="/atividades" icone="fa-shield-alt" texto={tx('Registo de atividades')} />}
            {pode('atividades.ver') && <ItemMenu para="/privacidade" icone="fa-user-lock" texto={tx('Pedidos sobre dados pessoais')} />}

            <div className="menu-divider" />
            <div className="menu-item d-flex">
              <button type="button" className="app-sidebar-minify-btn ms-auto border-0" onClick={() => setMinimizado(!minimizado)} aria-label={tx('Minimizar menu')}>
                <i className="fa fa-angle-double-left" />
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="app-sidebar-bg" data-bs-theme="dark" />
      <div className="app-sidebar-mobile-backdrop">
        <button type="button" className="stretched-link border-0 bg-transparent w-100 h-100" onClick={() => setMenuMovel(false)} aria-label={tx('Fechar menu')} />
      </div>

      {/* Conteúdo */}
      <div id="content" className="app-content">
        <AvisoPrivacidade obter={obterPrivacidade} aceitar={aceitarPrivacidade} area="painel" />
        {utilizador.deveAtivar2fa && (
          <div className="alert alert-danger d-flex align-items-center mb-3" role="alert">
            <i className="fa fa-mobile-alt fa-lg me-3" />
            <div className="flex-fill"><strong>{tx('Ligue a verificação em dois passos.')}</strong> {tx('O seu papel exige-a: até a ligar, o painel só deixa usar o perfil.')}</div>
            <Link to="/perfil" className="btn btn-sm btn-danger ms-3">{tx('Ligar agora')}</Link>
          </div>
        )}
        {utilizador.deveMudarSenha && (
          <div className="alert alert-warning d-flex align-items-center mb-3" role="alert">
            <i className="fa fa-shield-alt fa-lg me-3" />
            <div className="flex-fill">
              <strong>{tx('Mude a sua palavra-passe.')}</strong> {tx('A atual foi definida por outra pessoa ou já não cumpre as regras de segurança (mínimo de 10 caracteres, com letras e números).')}
            </div>
            <Link to="/perfil" className="btn btn-sm btn-warning ms-3">{tx('Mudar agora')}</Link>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

export default Layout
