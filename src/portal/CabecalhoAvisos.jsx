import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { api } from './api'
import { ICONES_NOTIFICACAO, ha } from './formatar'

const INTERVALO = 60_000

/*
  Sino de notificações e envelope de mensagens no cabeçalho (como no Color Admin / Moodle).
  Atualiza de minuto a minuto e quando se muda de página.
*/
function CabecalhoAvisos() {
  const { pathname } = useLocation()
  const navegar = useNavigate()
  const [resumo, setResumo] = useState({ notificacoes: 0, mensagens: 0 })
  const [aberto, setAberto] = useState(false)
  const [lista, setLista] = useState(null)
  const caixa = useRef(null)

  const atualizar = useCallback(() => api('/eu/avisos').then(setResumo).catch(() => {}), [])
  useEffect(() => {
    atualizar()
    const t = setInterval(atualizar, INTERVALO)
    // as páginas avisam quando algo foi lido (mensagens, notificações)
    window.addEventListener('portal-avisos', atualizar)
    return () => { clearInterval(t); window.removeEventListener('portal-avisos', atualizar) }
  }, [atualizar, pathname])
  useEffect(() => {
    if (!aberto) return undefined
    const fora = (e) => { if (!caixa.current?.contains(e.target)) setAberto(false) }
    const esc = (e) => { if (e.key === 'Escape') setAberto(false) }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc) }
  }, [aberto])

  function abrir() {
    if (aberto) return setAberto(false)
    setAberto(true)
    api('/notificacoes').then((r) => setLista(r.lista.slice(0, 8))).catch(() => setLista([]))
  }

  async function seguir(n) {
    setAberto(false)
    if (!n.lida) await api('/notificacoes/lidas', { metodo: 'PUT', corpo: { ids: [n.id] } }).catch(() => {})
    atualizar()
    if (n.ligacao) navegar(n.ligacao)
  }

  async function lerTodas() {
    await api('/notificacoes/lidas', { metodo: 'PUT', corpo: { todas: true } }).catch(() => {})
    setLista((l) => l?.map((x) => ({ ...x, lida: true })))
    atualizar()
  }

  return (
    <>
      <div className="navbar-item">
        <Link to="/mensagens" className="navbar-link icon" title="Mensagens" aria-label={`Mensagens${resumo.mensagens ? ` (${resumo.mensagens} por ler)` : ''}`}>
          <i className="fa fa-envelope" />
          {resumo.mensagens > 0 && <span className="badge">{resumo.mensagens}</span>}
        </Link>
      </div>
      <div ref={caixa} className={`navbar-item dropdown ${aberto ? 'show' : ''}`}>
        <button type="button" className="navbar-link dropdown-toggle icon border-0 bg-transparent" onClick={abrir} aria-expanded={aberto} aria-label={`Notificações${resumo.notificacoes ? ` (${resumo.notificacoes} por ler)` : ''}`}>
          <i className="fa fa-bell" />
          {resumo.notificacoes > 0 && <span className="badge">{resumo.notificacoes > 99 ? '99+' : resumo.notificacoes}</span>}
        </button>
        {aberto && (
          <div className="dropdown-menu media-list dropdown-menu-end show p-notif-menu">
            <div className="dropdown-header d-flex justify-content-between align-items-center">
              <span>NOTIFICAÇÕES ({resumo.notificacoes})</span>
              {resumo.notificacoes > 0 && <button type="button" className="btn btn-link btn-sm p-0 text-decoration-none" onClick={lerTodas}>Marcar todas como lidas</button>}
            </div>
            {!lista && <div className="dropdown-item text-muted small">A carregar…</div>}
            {lista?.length === 0 && <div className="dropdown-item text-center text-muted py-4"><i className="fa fa-bell-slash fa-2x d-block mb-2 opacity-50" />Sem notificações.</div>}
            {lista?.map((n) => {
              const [icone, cor] = ICONES_NOTIFICACAO[n.tipo] || ICONES_NOTIFICACAO.geral
              return (
                <button key={n.id} type="button" className={`dropdown-item media ${n.lida ? '' : 'p-notif-nova'}`} onClick={() => seguir(n)}>
                  <div className="media-left"><i className={`fa ${icone} media-object ${cor}`} /></div>
                  <div className="media-body">
                    <h6 className="media-heading text-wrap">{n.titulo}</h6>
                    {n.texto && <p className="text-wrap mb-0">{n.texto}</p>}
                    <div className="text-muted fs-10px">{ha(n.criadaEm)}</div>
                  </div>
                </button>
              )
            })}
            <div className="dropdown-footer text-center">
              <Link to="/notificacoes" className="text-decoration-none" onClick={() => setAberto(false)}>Ver todas</Link>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default CabecalhoAvisos
