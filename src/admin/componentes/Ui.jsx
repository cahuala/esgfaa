import { useEffect } from 'react'
import { Link } from 'react-router-dom'

// Cabeçalho de página no estilo Color Admin: migalhas à direita + título
export function CabecalhoPagina({ titulo, subtitulo, migalhas = [], children }) {
  return (
    <div className="d-flex align-items-start flex-wrap gap-2 mb-3">
      <div className="flex-grow-1">
        <ol className="breadcrumb mb-1">
          <li className="breadcrumb-item"><Link to="/">Painel</Link></li>
          {migalhas.map((m) => (
            <li key={m.rotulo} className={`breadcrumb-item ${m.para ? '' : 'active'}`}>
              {m.para ? <Link to={m.para}>{m.rotulo}</Link> : m.rotulo}
            </li>
          ))}
        </ol>
        <h1 className="page-header mb-0">{titulo} {subtitulo && <small>{subtitulo}</small>}</h1>
      </div>
      {children && <div className="d-flex gap-2 flex-wrap">{children}</div>}
    </div>
  )
}

// Painel (panel-inverse) do Color Admin
export function Painel({ titulo, acoes, children, corpo = true, className = '' }) {
  return (
    <div className={`panel panel-inverse ${className}`}>
      {titulo && (
        <div className="panel-heading">
          <h4 className="panel-title">{titulo}</h4>
          {acoes && <div className="panel-heading-btn">{acoes}</div>}
        </div>
      )}
      {corpo ? <div className="panel-body">{children}</div> : children}
    </div>
  )
}

// Mensagem temporária no canto do ecrã
export function Aviso({ aviso, onFechar }) {
  useEffect(() => {
    if (!aviso) return
    const id = setTimeout(onFechar, aviso.tipo === 'erro' ? 6000 : 3000)
    return () => clearTimeout(id)
  }, [aviso, onFechar])

  if (!aviso) return null
  return (
    <div className="aviso-flutuante">
      <div className={`alert ${aviso.tipo === 'erro' ? 'alert-danger' : 'alert-success'} d-flex align-items-center shadow mb-0`} role="status">
        <i className={`fa ${aviso.tipo === 'erro' ? 'fa-exclamation-circle' : 'fa-check-circle'} fa-lg me-2`} />
        <span className="flex-grow-1">{aviso.texto}</span>
        <button type="button" className="btn-close ms-3" onClick={onFechar} aria-label="Fechar" />
      </div>
    </div>
  )
}

// Janela de confirmação (modal Bootstrap controlado pelo React)
export function Confirmar({ pedido, onCancelar }) {
  if (!pedido) return null
  return (
    <>
      <div className="modal d-block" tabIndex={-1} role="dialog" aria-modal="true" onClick={onCancelar}>
        <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">{pedido.titulo}</h4>
              <button type="button" className="btn-close" onClick={onCancelar} aria-label="Fechar" />
            </div>
            <div className="modal-body">{pedido.texto}</div>
            <div className="modal-footer">
              <button type="button" className="btn btn-white" onClick={onCancelar}>Cancelar</button>
              <button type="button" className={`btn ${pedido.perigo ? 'btn-danger' : 'btn-primary'}`} onClick={pedido.confirmar}>
                {pedido.botao || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  )
}

export function Carregando() {
  return (
    <div className="text-center text-muted py-5">
      <span className="spinner-border spinner-border-sm me-2" /> A carregar…
    </div>
  )
}

export function Erro({ texto, onRepetir }) {
  return (
    <div className="alert alert-danger d-flex align-items-center">
      <i className="fa fa-exclamation-triangle me-2" />
      <span className="flex-grow-1">{texto}</span>
      {onRepetir && <button className="btn btn-sm btn-white" onClick={onRepetir}>Tentar de novo</button>}
    </div>
  )
}
