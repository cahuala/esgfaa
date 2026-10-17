import { useEffect } from 'react'
import { Link } from 'react-router-dom'

export function Cabecalho({ titulo, subtitulo, migalhas = [], children }) {
  return (
    <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
      <div className="me-auto">
        {migalhas.length > 0 && (
          <ol className="breadcrumb mb-1">
            <li className="breadcrumb-item"><Link to="/">Painel</Link></li>
            {migalhas.map(([t, para]) => <li key={t} className="breadcrumb-item">{para ? <Link to={para}>{t}</Link> : t}</li>)}
          </ol>
        )}
        <h1 className="page-header mb-0">{titulo} {subtitulo && <small>{subtitulo}</small>}</h1>
      </div>
      {children}
    </div>
  )
}

export function Painel({ titulo, icone, acoes, children, className = '', corpo = true }) {
  return (
    <div className={`panel panel-inverse ${className}`}>
      {(titulo || acoes) && (
        <div className="panel-heading">
          <h4 className="panel-title">{icone && <i className={`fa ${icone} me-2`} />}{titulo}</h4>
          {acoes && <div className="panel-heading-btn gap-1">{acoes}</div>}
        </div>
      )}
      {corpo ? <div className="panel-body">{children}</div> : children}
    </div>
  )
}

export function Modal({ titulo, aoFechar, children, rodape, largo = false }) {
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') aoFechar() }
    document.addEventListener('keydown', esc)
    document.body.classList.add('modal-open')
    return () => { document.removeEventListener('keydown', esc); document.body.classList.remove('modal-open') }
  }, [aoFechar])
  return (
    <>
      <div className="modal fade show d-block" role="dialog" aria-modal="true" aria-label={titulo} onMouseDown={(e) => { if (e.target === e.currentTarget) aoFechar() }}>
        <div className={`modal-dialog modal-dialog-scrollable ${largo ? 'modal-xl' : 'modal-lg'}`}>
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">{titulo}</h4>
              <button type="button" className="btn-close" onClick={aoFechar} aria-label="Fechar" />
            </div>
            <div className="modal-body">{children}</div>
            {rodape && <div className="modal-footer">{rodape}</div>}
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  )
}

export const Carregando = () => <div className="text-center text-muted py-5"><i className="fa fa-spinner fa-spin fa-2x" /></div>

export function Erro({ texto, aoRepetir }) {
  return (
    <div className="alert alert-danger d-flex align-items-center gap-2">
      <i className="fa fa-exclamation-triangle" /> <span className="me-auto">{texto}</span>
      {aoRepetir && <button type="button" className="btn btn-sm btn-outline-danger" onClick={aoRepetir}>Tentar de novo</button>}
    </div>
  )
}

// mensagem temporária no canto (sucesso ou erro)
export function Aviso({ aviso, aoFechar }) {
  useEffect(() => {
    if (!aviso) return undefined
    const t = setTimeout(aoFechar, aviso.tipo === 'erro' ? 8000 : 4000)
    return () => clearTimeout(t)
  }, [aviso, aoFechar])
  if (!aviso) return null
  return (
    <div className={`pes-aviso alert ${aviso.tipo === 'erro' ? 'alert-danger' : 'alert-success'} shadow`} role="status">
      <i className={`fa ${aviso.tipo === 'erro' ? 'fa-exclamation-circle' : 'fa-check-circle'} me-2`} />{aviso.texto}
      <button type="button" className="btn-close ms-3" onClick={aoFechar} aria-label="Fechar" />
    </div>
  )
}

const ESTADO_CONDICAO = { ok: ['fa-check-circle', 'text-success', 'Cumpre'], falta: ['fa-times-circle', 'text-danger', 'Não cumpre'], confirmar: ['fa-question-circle', 'text-warning', 'Confirmar'] }
// condições da lei (cada uma com o artigo) — promoção, graduação, nomeação, licença…
export function Condicoes({ condicoes = [] }) {
  return (
    <ul className="pes-condicoes">
      {condicoes.map((c) => {
        const [icone, cor, nome] = ESTADO_CONDICAO[c.estado] ?? ESTADO_CONDICAO.confirmar
        return (
          <li key={c.id}>
            <i className={`fa ${icone} ${cor}`} title={nome} aria-label={nome} />
            <div>
              <strong>{c.texto}</strong> <span className="text-muted small">({c.artigo})</span>
              {c.detalhe && <div className="small text-muted">{c.detalhe}</div>}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

const CORES_ESTADO = { rascunho: 'secondary', submetida: 'warning', aprovada: 'success', rejeitada: 'danger', cancelada: 'dark', pendente: 'warning', enviado: 'success', erro: 'danger', em_curso: 'success', futura: 'info', terminada: 'secondary' }
export const Estado = ({ estado, texto }) => <span className={`badge bg-${CORES_ESTADO[estado] ?? 'secondary'}`}>{texto ?? estado}</span>

// campo de formulário simples (rótulo + controlo)
export function Campo({ rotulo, children, ajuda, col = 'col-md-6', obrigatorio }) {
  return (
    <div className={`${col} mb-2`}>
      <label className="form-label small fw-semibold mb-1">{rotulo}{obrigatorio && <span className="text-danger"> *</span>}</label>
      {children}
      {ajuda && <div className="form-text">{ajuda}</div>}
    </div>
  )
}

export function Escolha({ valor, aoMudar, opcoes, vazio = '—', ...resto }) {
  const lista = Array.isArray(opcoes) ? opcoes.map((o) => (Array.isArray(o) ? o : [o, o])) : Object.entries(opcoes).map(([k, v]) => [k, typeof v === 'string' ? v : v.nome])
  return (
    <select className="form-select form-select-sm" value={valor ?? ''} onChange={(e) => aoMudar(e.target.value)} {...resto}>
      {vazio !== null && <option value="">{vazio}</option>}
      {lista.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
    </select>
  )
}
