import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useMatch, useNavigate } from 'react-router-dom'
import Brasao from '../assets/Logo.png'
import Sede from '../assets/Escola De Guerra.png'
import { useTema } from '../tema/useTema'
import { useSessao } from './sessaoContexto'
import { iniciais } from './formatar'
import FotoConta from '../admin/componentes/FotoConta'
import { comSessao as comSessaoPortal } from './api'

// a fotografia do próprio (vinda do Pessoal), com as iniciais se não houver
const FotoPortal = ({ conta, grande }) => (conta.temFoto ? <FotoConta caminho="/api/portal/eu/foto" sessao={comSessaoPortal} nome={conta.nome} tamanho={grande ? 56 : 30} /> : <span className={`admin-avatar ${grande ? 'admin-avatar-grande' : ''}`}>{iniciais(conta.nome)}</span>)
import CabecalhoAvisos from './CabecalhoAvisos'
import { t as tx } from '../i18n/linguas'
import SeletorLinguaPainel from '../i18n/SeletorLinguaPainel'
import AvisoPrivacidade from '../components/AvisoPrivacidade'
import { api } from './api'

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
// aviso de privacidade na primeira entrada (fixos: não mudam entre desenhos)
const obterPrivacidade = () => api('/eu/privacidade')
const aceitarPrivacidade = () => api('/eu/privacidade', { metodo: 'POST' })

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

  // numa turma com plano de curso da ESG: «Auditor» ou «Discente»
  const papel = eDocente ? tx('Docente') : tx(conta.termos?.pessoa || 'Estudante')
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
              <b>{tx('Portal Académico')}</b>
              <small>{tx('Escola Superior de Guerra')}</small>
            </span>
          </Link>
          <button type="button" className="navbar-mobile-toggler" onClick={() => setMenuMovelEm(menuMovel ? null : pathname)} aria-label={tx('Abrir menu')}>
            <span className="icon-bar" /><span className="icon-bar" /><span className="icon-bar" />
          </button>
        </div>

        <div className="navbar-nav">
          <div className="navbar-item navbar-form d-none d-md-block">
            <form onSubmit={(e) => { e.preventDefault(); const q = e.currentTarget.q.value.trim(); if (q) navegar(`/pesquisa?q=${encodeURIComponent(q)}`) }} role="search">
              <div className="form-group">
                <input name="q" type="search" className="form-control" placeholder={tx('Pesquisar no portal')} aria-label={tx('Pesquisar no portal')} />
                <button type="submit" className="btn btn-search" aria-label={tx('Pesquisar')}><i className="fa fa-search" /></button>
              </div>
            </form>
          </div>
          <div className="navbar-item d-md-none">
            <Link to="/pesquisa" className="navbar-link icon" aria-label={tx('Pesquisar')}><i className="fa fa-search" /></Link>
          </div>
          <div className="navbar-item">
            <button type="button" className="navbar-link icon border-0 bg-transparent" onClick={alternar} title={tema === 'dark' ? tx('Modo claro') : tx('Modo escuro')} aria-label={tema === 'dark' ? tx('Mudar para o modo claro') : tx('Mudar para o modo escuro')}>
              <i className={`fa ${tema === 'dark' ? 'fa-sun' : 'fa-moon'}`} />
            </button>
          </div>
          <CabecalhoAvisos />
          <div className="navbar-item d-none d-md-block">
            <a href={SITE} target="_blank" rel="noreferrer" className="navbar-link icon" title={tx('Site da Escola')}>
              <i className="fa fa-globe" />
            </a>
          </div>
          <SeletorLinguaPainel />
          <div ref={caixa} className={`navbar-item navbar-user dropdown esg-menu-utilizador ${menuConta ? 'show' : ''}`}>
            <button type="button" className="navbar-link dropdown-toggle d-flex align-items-center p-conta-botao" aria-expanded={menuConta} onClick={() => setContaEm(menuConta ? null : pathname)}>
              <FotoPortal conta={conta} grande={false} />
              <span>
                <span className="d-none d-md-inline fw-bold">{conta.nome}</span>
                <b className="caret" />
              </span>
            </button>
            {menuConta && (
              <div className="dropdown-menu dropdown-menu-end show esg-menu-lista" data-bs-popper="static">
                <div className="esg-menu-cabecalho">
                  <FotoPortal conta={conta} grande />
                  <div>
                    <strong>{conta.nome}</strong>
                    <small>{conta.email}</small>
                    <span className="esg-menu-papel">{papel} · {conta.numero}</span>
                  </div>
                </div>
                <Link to="/perfil" className="dropdown-item"><i className="fa fa-user-circle fa-fw me-2" />{tx('O meu perfil')}</Link>
                {!eDocente && <Link to="/percurso" className="dropdown-item"><i className="fa fa-route fa-fw me-2" />{tx('Percurso académico')}</Link>}
                <a href={SITE} className="dropdown-item"><i className="fa fa-globe fa-fw me-2" />{tx('Site da Escola')}</a>
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
              <div className="esg-marca-sub">{tx('Portal Académico')}</div>
              <Link to="/perfil" className="esg-marca-utilizador">
                <FotoPortal conta={conta} grande />
                <span>
                  <strong>{conta.nome}</strong>
                  <small>{papel}{turma ? ` · ${turma}` : ''}</small>
                </span>
              </Link>
            </div>

            <div className="menu-header">{tx('Geral')}</div>
            {eDocente ? <ItemMenu para="/" fim icone="fa-th-large" texto={tx('Painel')} /> : <ItemMenu para="/" fim icone="fa-users" texto={tx('A minha turma')} />}
            {eDocente && <ItemMenu para="/cadeiras" icone="fa-book" texto={tx('As minhas cadeiras')} />}
            <ItemMenu para="/calendario" icone="fa-calendar-alt" texto={tx('Calendário')} />
            <ItemMenu para="/horario" icone="fa-clock" texto={tx('Horário')} />
            {eDocente && <ItemMenu para="/banco" icone="fa-archive" texto={tx('Banco de perguntas')} />}
            {eDocente && <ItemMenu para="/integridade" icone="fa-fingerprint" texto={tx('Originalidade')} />}

            {!eDocente && (
              <>
                <div className="menu-header">{tx('Avaliação')}</div>
                <ItemMenu para="/notas" icone="fa-clipboard-list" texto={tx('Notas')} />
                <ItemMenu para="/percurso" icone="fa-route" texto={tx('Percurso académico')} />
                <ItemMenu para="/emblemas" icone="fa-medal" texto={tx('Os meus emblemas')} />

                <div className="menu-header">{tx('Administração Escolar')}</div>
                <ItemMenu para="/avisos" icone="fa-bullhorn" texto={tx('Avisos')} />
                <ItemMenu para="/pedidos" icone="fa-file-signature" texto={tx('Pedidos de documentos')} />
              </>
            )}

            <div className="menu-header">{tx('Biblioteca')}</div>
            <ItemMenu para="/biblioteca" fim icone="fa-book-reader" texto={tx('Catálogo')} />
            <ItemMenu para="/biblioteca/emprestimos" icone="fa-hand-holding" texto={tx('Os meus livros')} />

            <div className="menu-header">{tx('Comunicação')}</div>
            <ItemMenu para="/mensagens" icone="fa-envelope" texto={tx('Mensagens')} />
            <ItemMenu para="/notificacoes" icone="fa-bell" texto={tx('Notificações')} />
            <ItemMenu para="/inqueritos" icone="fa-poll" texto={tx('Inquéritos')} />

            <div className="menu-header">{tx('Conta')}</div>
            <ItemMenu para="/perfil" icone="fa-user-circle" texto={tx('O meu perfil')} />

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
      <div className="app-sidebar-mobile-backdrop"><button type="button" className="stretched-link border-0 bg-transparent w-100" onClick={() => setMenuMovelEm(null)} aria-label={tx('Fechar menu')} /></div>

      {/* Conteúdo */}
      <div id="content" className="app-content">
        {children}
      </div>
      <AvisoPrivacidade obter={obterPrivacidade} aceitar={aceitarPrivacidade} area="portal" />
    </div>
  )
}

export default Layout
