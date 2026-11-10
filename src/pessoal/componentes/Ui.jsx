import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Espera from '../../components/Espera/Espera'

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

// página ou ficha que não existe: mensagem clara, com o caminho de volta e o contacto do suporte técnico
export function NaoEncontrado({ titulo = 'Página não encontrada', texto = 'O endereço que abriu não existe ou já não está disponível.' }) {
  return (
    <div className="pes-404">
      <div className="pes-404-ic"><i className="fa fa-compass" /></div>
      <h2>{titulo}</h2>
      <p className="text-muted">{texto}</p>
      <p className="small text-muted">Se chegou aqui por uma ligação do sistema ou o problema continuar, contacte o <b>suporte técnico</b> (Repartição de Pessoal e Quadros / Centro de Informática da ESG), indicando o endereço: <code>{window.location.hash.slice(1) || '/'}</code></p>
      <div className="d-flex gap-2 justify-content-center mt-3">
        <button type="button" className="btn btn-white" onClick={() => window.history.back()}><i className="fa fa-arrow-left me-1" />Voltar</button>
        <Link to="/" className="btn btn-theme"><i className="fa fa-home me-1" />Ir para o painel</Link>
      </div>
    </div>
  )
}

export const Carregando = ({ texto, compacta = false }) => <Espera texto={texto} compacta={compacta} />

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

const ESTADO_CONDICAO = { ok: ['fa-check-circle', 'text-success', 'Cumpre'], falta: ['fa-times-circle', 'text-danger', 'Não cumpre'], alerta: ['fa-exclamation-triangle', 'text-warning', 'Alerta'], confirmar: ['fa-question-circle', 'text-warning', 'Confirmar'] }
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

const CORES_ESTADO = { rascunho: 'secondary', a_despacho: 'warning', enviada: 'info', concluida: 'success', indeferida: 'danger', submetida: 'warning', aprovada: 'success', rejeitada: 'danger', cancelada: 'dark', pendente: 'warning', enviado: 'success', erro: 'danger', em_curso: 'success', futura: 'info', terminada: 'secondary' }
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

// categoria do docente (Decreto Presidencial n.º 191/18): a carreira e o pessoal especialmente contratado.
// Uma categoria antiga, que já não está nas listas, continua a aparecer.
export function EscolhaCategoriaDocente({ valor, aoMudar, referencias: ref, ...resto }) {
  const conhecida = [...ref.categoriasDocente, ...(ref.categoriasDocenteContratado ?? [])].includes(valor)
  return (
    <select className="form-select form-select-sm" value={valor ?? ''} onChange={(e) => aoMudar(e.target.value)} {...resto}>
      <option value="">—</option>
      <optgroup label="Carreira docente">{ref.categoriasDocente.map((c) => <option key={c} value={c}>{c}</option>)}</optgroup>
      {ref.categoriasDocenteContratado && <optgroup label="Especialmente contratado">{ref.categoriasDocenteContratado.map((c) => <option key={c} value={c}>{c}</option>)}</optgroup>}
      {valor && !conhecida && <option value={valor}>{valor}</option>}
    </select>
  )
}

/*
  Campo de data sempre em dia/mês/ano (o <input type="date"> segue a língua do Windows: num Windows em
  inglês mostrava mês/dia/ano). Escreve-se 25122026 ou 25/12/2026; o botão abre o calendário do navegador.
  O valor que entra e sai continua aaaa-mm-dd, como no <input type="date">.
*/
const dataParaPt = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? '')); return m ? `${m[3]}/${m[2]}/${m[1]}` : '' }
function dataParaIso(t) {
  if (!t) return ''
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t)
  if (!m) return null
  const iso = `${m[3]}-${m[2]}-${m[1]}`
  const d = new Date(`${iso}T12:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : null
}
export function InputData({ value, onChange, min, max, className = 'form-control form-control-sm', style, ...resto }) {
  const [texto, setTexto] = useState(() => dataParaPt(value))
  const [visto, setVisto] = useState(value)
  const nativo = useRef(null)
  if (value !== visto) {
    setVisto(value)
    if (dataParaIso(texto) !== String(value ?? '').slice(0, 10)) setTexto(dataParaPt(value))
  }
  const mudar = (iso) => onChange?.({ target: { value: iso, type: 'date', name: resto.name } })
  function escrever(e) {
    const n = e.target.value.replace(/\D/g, '').slice(0, 8)
    const t = [n.slice(0, 2), n.slice(2, 4), n.slice(4)].filter(Boolean).join('/')
    setTexto(t)
    const iso = dataParaIso(t)
    if (iso !== null && iso !== String(value ?? '').slice(0, 10)) mudar(iso)
  }
  // incompleta ou impossível (31/02): ao sair do campo, volta à que está guardada
  const sair = () => { if (dataParaIso(texto) === null) setTexto(dataParaPt(value)) }
  const invalida = texto.length === 10 && dataParaIso(texto) === null
  return (
    <span className={`pes-data${/\bw-auto\b/.test(className) ? ' w-auto' : ''}`} style={style}>
      <input {...resto} type="text" inputMode="numeric" autoComplete="off" placeholder="dd/mm/aaaa" maxLength={10} className={`${className} ${invalida ? 'is-invalid' : ''}`} value={texto} onChange={escrever} onBlur={sair} />
      <button type="button" className="pes-data-cal" tabIndex={-1} aria-label="Abrir o calendário" disabled={resto.disabled} onClick={() => { try { nativo.current?.showPicker() } catch { nativo.current?.focus() } }}><i className="fa fa-calendar-alt" /></button>
      <input ref={nativo} type="date" className="pes-data-nativo" tabIndex={-1} aria-hidden="true" value={String(value ?? '').slice(0, 10)} min={min} max={max} onChange={(e) => { setTexto(dataParaPt(e.target.value)); mudar(e.target.value) }} />
    </span>
  )
}
