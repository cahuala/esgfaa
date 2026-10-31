import { useEffect, useState } from 'react'
import { API, api, comSessao } from './api'
import { ouvirTempoReal } from '../utils/tempoReal'
import AvisoPrivacidade from '../components/AvisoPrivacidade'
import PesquisaGeral from './componentes/PesquisaGeral'
import { Link, NavLink, useLocation, useMatch } from 'react-router-dom'
import { useSessao } from './sessao'
import Brasao from '../assets/Logo-ecra.webp'
import Sede from '../assets/Escola De Guerra-ecra.webp'

function Item({ para, icone, texto, fim, contador = 0 }) {
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

const obterPrivacidade = () => api('/eu/privacidade')
const aceitarPrivacidade = () => api('/eu/privacidade', { metodo: 'POST' })

export default function Layout({ children }) {
  const { utilizador, pode, sair } = useSessao()
  const { pathname } = useLocation()
  const [menuEm, setMenuEm] = useState(null)
  const [minimizado, setMinimizado] = useState(false)
  const menuMovel = menuEm === pathname
  // documentos por receber e mensagens por ler (de 30 em 30 segundos, e logo que se lê uma conversa)
  const [avisos, setAvisos] = useState({ porReceber: 0, mensagens: 0 })
  useEffect(() => {
    const ver = () => api('/avisos').then(setAvisos).catch(() => {})
    ver()
    const id = setInterval(ver, 30_000)
    window.addEventListener('pes-avisos', ver)
    return () => { clearInterval(id); window.removeEventListener('pes-avisos', ver) }
  }, [])
  // avisos instantâneos: quando alguém grava alguma coisa, o menu e as listas abertas atualizam-se
  useEffect(() => ouvirTempoReal(`${API}/api/eventos`, () => comSessao(), () => {
    window.dispatchEvent(new Event('pes-avisos'))
    window.dispatchEvent(new Event('pes-tempo-real'))
  }), [])
  const gestao = pode('ver')
  const iniciais = utilizador.nome.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div id="app" style={{ '--esg-sede': `url("${Sede}")` }} className={`app app-header-fixed app-sidebar-fixed ${menuMovel ? 'app-sidebar-mobile-toggled' : ''} ${minimizado ? 'app-sidebar-minified' : ''}`}>
      <div id="header" className="app-header">
        <div className="navbar-header">
          <Link to="/" className="navbar-brand">
            <img src={Brasao} alt="" className="admin-brasao" />
            <span className="esg-cabecalho-titulo">
              <b>{gestao ? 'Gestão de Pessoal' : 'Expediente e Mensagens'}</b>
              <small>Escola Superior de Guerra</small>
            </span>
          </Link>
          <button type="button" className="navbar-mobile-toggler" onClick={() => setMenuEm(menuMovel ? null : pathname)} aria-label="Abrir menu">
            <span className="icon-bar" /><span className="icon-bar" /><span className="icon-bar" />
          </button>
        </div>
        {gestao && <div className="navbar-form flex-grow-1 d-none d-md-flex align-items-center px-3"><PesquisaGeral /></div>}
        <div className="navbar-nav">
          <div className="navbar-item d-none d-xl-flex align-items-center me-2">
            <span className="badge bg-success-subtle text-success border border-success"><i className="fa fa-network-wired me-1" />Rede interna</span>
          </div>
          <div className="navbar-item navbar-user d-flex align-items-center gap-2 pe-3">
            <span className="admin-avatar">{iniciais}</span>
            <span className="d-none d-lg-inline pes-cab-utilizador" title={utilizador.nome}>
              <span className="fw-bold lh-1">{utilizador.nome}</span>
              <small className="text-muted">{utilizador.unidadeNome || utilizador.papelNome}</small>
            </span>
            <button type="button" className="btn btn-sm btn-outline-secondary ms-2" onClick={sair} title="Sair"><i className="fa fa-sign-out-alt" /></button>
          </div>
        </div>
      </div>

      <div id="sidebar" className="app-sidebar" data-bs-theme="dark">
        <div className="app-sidebar-content admin-sidebar-rolavel">
          <div className="menu">
            <div className="esg-marca">
              <img src={Brasao} alt="Brasão da Escola Superior de Guerra" className="esg-marca-brasao" />
              <div className="esg-marca-nome">{gestao ? 'Pessoal e Quadros' : 'Sistema interno'}</div>
              <div className="esg-marca-sub">Exército · Força Aérea · Marinha · Civis</div>
            </div>
            {gestao && <>
              <div className="menu-header">Geral</div>
              <Item para="/" fim icone="fa-chart-pie" texto="Painel" />
              <Item para="/pessoas" icone="fa-users" texto="Pessoal" />
              <Item para="/estudantes" icone="fa-user-graduate" texto="Estudantes" />
              <Item para="/docentes" icone="fa-chalkboard-teacher" texto="Docentes" />
              {pode('editar') && <Item para="/pessoas/nova" icone="fa-user-plus" texto="Nova ficha" />}
              {pode('editar') && <Item para="/importar" icone="fa-file-import" texto="Importar Excel e fotos" />}
              <Item para="/processos" icone="fa-folder-open" texto="Processos individuais" />

              <div className="menu-header">Carreiras</div>
              <Item para="/propostas" icone="fa-file-signature" texto="Propostas" />
              <Item para="/extractos" icone="fa-file-contract" texto="Extractos" />
              <Item para="/elegiveis" icone="fa-medal" texto="Em condições de promoção" />
              <Item para="/antiguidade" icone="fa-list-ol" texto="Listas de antiguidade" />
              <Item para="/reserva" icone="fa-hourglass-half" texto="Reserva e reforma" />
              <Item para="/licencas" icone="fa-plane-departure" texto="Licenças" />
              <Item para="/ausencias" icone="fa-user-clock" texto="Faltas e ausências" />
              <Item para="/faltas-civis" icone="fa-calendar-check" texto="Controlo de faltas (civis)" />
              <Item para="/plano-ferias" icone="fa-umbrella-beach" texto="Plano de férias" />
              <Item para="/tabela-salarial" icone="fa-coins" texto="Tabela salarial (militares)" />
              <Item para="/tabela-salarial-civis" icone="fa-coins" texto="Tabela salarial (civis)" />

              <div className="menu-header">Documentos</div>
              <Item para="/declaracoes" icone="fa-file-signature" texto="Declarações" />
              <Item para="/historico-efectivos" icone="fa-archive" texto="Histórico dos efectivos" />
              <Item para="/documentos/efectividade" icone="fa-table" texto="Efectividade" />
              <Item para="/documentos/mapas" icone="fa-chart-bar" texto="Mapas estatísticos" />
              <Item para="/documentos/propostas" icone="fa-file-signature" texto="Pessoal proposto" />
              <Item para="/documentos/listas" icone="fa-list" texto="Listas" />

              <div className="menu-header">Organização</div>
              <Item para="/organica" icone="fa-sitemap" texto="Orgânica e planeamento" />
              <Item para="/domiciliares" icone="fa-house-user" texto="Empregados domiciliares" />
            </>}

            <div className="menu-header">Comunicação</div>
            {pode('despachar') && <Item para="/secretaria" icone="fa-stamp" texto="Secretária digital" contador={avisos.porDespachar} />}
            <Item para="/expediente" icone="fa-inbox" texto="Expediente" contador={avisos.porReceber} />
            <Item para="/mensagens" icone="fa-comments" texto="Mensagens" contador={avisos.mensagens} />
            {utilizador.pessoaId && <Item para={`/pessoas/${utilizador.pessoaId}`} icone="fa-id-badge" texto="A minha ficha" />}

            {pode('supervisionar') && <div className="menu-header">Administração</div>}
            {pode('supervisionar') && <Item para="/utilizadores" icone="fa-users-cog" texto="Utilizadores" />}
            {pode('administrar') && <Item para="/assinaturas" icone="fa-signature" texto="Assinaturas dos documentos" />}
            {pode('supervisionar') && <Item para="/auditoria" icone="fa-shield-alt" texto="Auditoria" />}
            {gestao && <Item para="/portal" icone="fa-exchange-alt" texto="Ligação ao portal" />}
            {pode('editar') && <Item para="/pedidos-dados" icone="fa-user-lock" texto="Pedidos sobre dados pessoais" />}
            <Item para="/privacidade" icone="fa-user-shield" texto="Privacidade" />
            <Item para="/senha" icone="fa-key" texto="Segurança da conta" />
            <div className="menu-item"><a href="manual/index.html" target="_blank" rel="noreferrer" className="menu-link"><div className="menu-icon"><i className="fa fa-book" /></div><div className="menu-text">Manual</div></a></div>

            <div className="menu-divider" />
            <div className="menu-item d-flex">
              <button type="button" className="app-sidebar-minify-btn ms-auto border-0" onClick={() => setMinimizado(!minimizado)} aria-label="Encolher o menu"><i className="fa fa-angle-double-left" /></button>
            </div>
          </div>
        </div>
      </div>
      <div className="app-sidebar-bg" data-bs-theme="dark" />
      <div className="app-sidebar-mobile-backdrop"><button type="button" className="stretched-link border-0 bg-transparent" onClick={() => setMenuEm(null)} aria-label="Fechar menu" /></div>

      <div id="content" className="app-content">{children}<AvisoPrivacidade obter={obterPrivacidade} aceitar={aceitarPrivacidade} area="painel" ligacao="#/privacidade" /></div>
    </div>
  )
}
