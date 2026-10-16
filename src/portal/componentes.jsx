import { Children, cloneElement, isValidElement, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { textoBloqueio } from './formatar'
import { t as tx } from '../i18n/linguas'

// peças comuns do portal, no markup do Color Admin (o mesmo tema do painel)

// cabeçalho de página: migalhas + título (page-header), com ações à direita
export function Titulo({ rotulo, titulo, sub, migalhas = [], children }) {
  return (
    <div className="d-flex align-items-start flex-wrap gap-2 mb-3">
      <div className="flex-grow-1 min-w-0">
        <ol className="breadcrumb mb-1">
          <li className="breadcrumb-item"><Link to="/">{tx('Portal')}</Link></li>
          {rotulo && !migalhas.length && <li className="breadcrumb-item active">{rotulo}</li>}
          {migalhas.map((m) => (
            <li key={m.rotulo} className={`breadcrumb-item ${m.para ? '' : 'active'}`}>{m.para ? <Link to={m.para}>{m.rotulo}</Link> : m.rotulo}</li>
          ))}
        </ol>
        <h1 className="page-header mb-0">{titulo} {sub && <small>{sub}</small>}</h1>
      </div>
      {children && <div className="d-flex gap-2 flex-wrap p-sem-impressao">{children}</div>}
    </div>
  )
}

// painel (panel-inverse) do Color Admin
export function Cartao({ titulo, acoes, children, className = '', corpo = true }) {
  return (
    <section className={`panel panel-inverse ${className}`}>
      {(titulo || acoes) && (
        <div className="panel-heading">
          {titulo && <h2 className="panel-title">{titulo}</h2>}
          {acoes && <div className="panel-heading-btn">{acoes}</div>}
        </div>
      )}
      {corpo ? <div className="panel-body">{children}</div> : children}
    </section>
  )
}

// widget de número (widget-stats) do dashboard
export function Widget({ cor = 'bg-dark', icone, titulo, valor, nota, para }) {
  return (
    <div className={`widget widget-stats ${cor}`}>
      <div className="stats-icon"><i className={`fa ${icone}`} /></div>
      <div className="stats-info"><h4>{titulo}</h4><p>{valor}</p></div>
      <div className="stats-link">
        {para ? <Link to={para}>{nota} <i className="fa fa-arrow-alt-circle-right" /></Link> : <span className="d-block px-3 py-2 small">{nota}</span>}
      </div>
    </div>
  )
}

export function Carregando({ texto = tx('A carregar…') }) {
  return <div className="d-flex align-items-center gap-2 text-muted py-3"><span className="spinner-border spinner-border-sm" /> {texto}</div>
}

export function Erro({ texto, onRepetir }) {
  return (
    <div className="alert alert-danger d-flex align-items-center gap-2 flex-wrap" role="alert">
      <i className="fa fa-exclamation-circle" /> <span className="flex-grow-1">{texto}</span>
      {onRepetir && <button type="button" className="btn btn-sm btn-white" onClick={onRepetir}>{tx('Tentar de novo')}</button>}
    </div>
  )
}

export function Vazio({ children }) {
  return <div className="p-vazio"><i className="fa fa-inbox fa-lg me-2 opacity-50" />{children}</div>
}

// mensagem temporária no canto (guardado, enviado, …), como no painel
export function Aviso({ aviso, onFechar }) {
  useEffect(() => {
    if (!aviso) return undefined
    const t = setTimeout(onFechar, aviso.tipo === 'erro' ? 6000 : 4500)
    return () => clearTimeout(t)
  }, [aviso, onFechar])
  if (!aviso) return null
  return (
    <div className="aviso-flutuante">
      <div className={`alert ${aviso.tipo === 'erro' ? 'alert-danger' : 'alert-success'} d-flex align-items-center shadow mb-0`} role="status">
        <i className={`fa ${aviso.tipo === 'erro' ? 'fa-exclamation-circle' : 'fa-check-circle'} fa-lg me-2`} />
        <span className="flex-grow-1">{aviso.texto}</span>
        <button type="button" className="btn-close ms-3" onClick={onFechar} aria-label={tx('Fechar')} />
      </div>
    </div>
  )
}

const CORES = { cinzento: 'bg-gray-400', verde: 'bg-success', vermelho: 'bg-danger', dourado: 'bg-warning text-dark', azul: 'bg-primary' }

export function Etiqueta({ cor = 'cinzento', children }) {
  return <span className={`badge ${CORES[cor] || CORES.cinzento}`}>{children}</span>
}

// campo de formulário com rótulo e erro (os inputs ganham o aspeto do tema pelo CSS do portal)
export function Campo({ id, rotulo, erro, ajuda, largo, children }) {
  return (
    <div className={`p-campo ${largo ? 'p-largo' : ''} ${erro ? 'p-com-erro' : ''}`}>
      <label htmlFor={id} className="form-label fw-bold mb-0">{rotulo}</label>
      {Children.map(children, (c) => {
        // os campos ganham as classes do tema (form-control / form-select)
        if (!isValidElement(c) || !['input', 'select', 'textarea'].includes(c.type) || ['checkbox', 'radio', 'file'].includes(c.props.type)) return c
        const classe = c.type === 'select' ? 'form-select' : 'form-control'
        return cloneElement(c, { className: `${classe} ${erro ? 'is-invalid' : ''} ${c.props.className || ''}`.trim() })
      })}
      {erro ? <span className="p-campo-erro" role="alert">{erro}</span> : ajuda && <span className="form-text mt-0">{ajuda}</span>}
    </div>
  )
}

// atividade fechada ao estudante: os motivos (data de abertura, condições por cumprir)
export function Bloqueio({ motivos, compacto = false }) {
  if (!motivos?.length) return null
  if (compacto) return <div className="small text-muted p-bloqueio"><i className="fa fa-lock me-1" />{motivos.map(textoBloqueio).join(' · ')}</div>
  return (
    <div className="alert alert-secondary d-flex gap-2 mb-0" role="status">
      <i className="fa fa-lock mt-1" />
      <div><b>{tx('Ainda não disponível.')}</b><ul className="mb-0 ps-3">{motivos.map((m, i) => <li key={i}>{textoBloqueio(m)}</li>)}</ul></div>
    </div>
  )
}
