import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Vazio } from './componentes'
import { PERIODOS } from './regraAvaliacao'
import { BarraProgresso } from './cadeira/Progresso'

// capa gerada a partir do código (cada cadeira tem a sua cor, como as imagens das disciplinas no Moodle)
const CAPAS = [
  ['#14100e', '#b42a10'], ['#1f2a44', '#2f5fa8'], ['#1d3b2a', '#2f7d4f'], ['#3a2f12', '#c9a227'],
  ['#2b1d3b', '#6c4fb0'], ['#0f3036', '#13838f'], ['#3b1d1d', '#a8322f'], ['#22262b', '#5d6a76'],
]
const capa = (codigo) => CAPAS[[...codigo].reduce((s, ch) => s + ch.charCodeAt(0), 0) % CAPAS.length]

/*
  As minhas cadeiras (como o "Course overview" do Moodle): cartões com capa e progresso,
  ou lista; filtro por período e pesquisa.
*/
function VisaoCadeiras({ cadeiras, progresso, compacto = false }) {
  const [vista, setVista] = useState('cartoes')
  const [periodo, setPeriodo] = useState('')
  const [q, setQ] = useState('')
  if (!cadeiras.length) return <Vazio>Ainda não tem cadeiras. Contacte a Administração Escolar.</Vazio>

  const lista = cadeiras.filter((c) => (!periodo || c.periodo === periodo) && (!q || `${c.codigo} ${c.nome}`.toLowerCase().includes(q.toLowerCase())))
  const docente = (c) => (c.docente ? c.docente.nome : 'Docentes por alocar') + (c.docentes?.length > 1 ? ` + ${c.docentes.length - 1}` : '')

  return (
    <>
      <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
        <select className="form-select form-select-sm w-auto" value={periodo} onChange={(e) => setPeriodo(e.target.value)} aria-label="Filtrar por período">
          <option value="">Todos os períodos</option>
          {Object.entries(PERIODOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div className="input-group input-group-sm w-auto">
          <span className="input-group-text"><i className="fa fa-search" /></span>
          <input className="form-control" placeholder="Procurar" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Procurar cadeiras" />
        </div>
        <div className="btn-group btn-group-sm ms-auto" role="group" aria-label="Vista">
          <button type="button" className={`btn ${vista === 'cartoes' ? 'btn-dark' : 'btn-white'}`} onClick={() => setVista('cartoes')} aria-pressed={vista === 'cartoes'} title="Cartões"><i className="fa fa-th-large" /></button>
          <button type="button" className={`btn ${vista === 'lista' ? 'btn-dark' : 'btn-white'}`} onClick={() => setVista('lista')} aria-pressed={vista === 'lista'} title="Lista"><i className="fa fa-list" /></button>
        </div>
      </div>
      {lista.length === 0 && <Vazio>Nenhuma cadeira com estes filtros.</Vazio>}
      {vista === 'cartoes' ? (
        <div className={`row g-3 ${compacto ? 'row-cols-1 row-cols-md-2 row-cols-xxl-3' : 'row-cols-1 row-cols-md-2 row-cols-xl-3 row-cols-xxl-4'}`}>
          {lista.map((c) => {
            const [a, b] = capa(c.codigo)
            const p = progresso?.[c.id]
            return (
              <div key={c.id} className="col">
                <Link to={`/cadeiras/${c.id}`} className="card h-100 p-cartao-cadeira text-decoration-none">
                  <div className="p-capa" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
                    <span className="p-capa-codigo">{c.codigo}</span>
                    <i className="fa fa-book-open p-capa-icone" />
                  </div>
                  <div className="card-body">
                    <div className="small text-muted text-uppercase fw-bold">{PERIODOS[c.periodo]} · {c.horas} h</div>
                    <h5 className="card-title mt-1 mb-1 text-body">{c.nome}</h5>
                    <div className="small text-muted"><i className="fa fa-chalkboard-teacher me-1" />{docente(c)}</div>
                  </div>
                  {p?.total > 0 && <div className="card-footer bg-transparent"><BarraProgresso p={p} /></div>}
                </Link>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="list-group">
          {lista.map((c) => {
            const [a, b] = capa(c.codigo)
            const p = progresso?.[c.id]
            return (
              <Link key={c.id} to={`/cadeiras/${c.id}`} className="list-group-item list-group-item-action d-flex align-items-center gap-3">
                <span className="p-capa-mini" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>{c.codigo.slice(0, 3)}</span>
                <div className="flex-grow-1 min-w-0">
                  <div className="fw-bold text-truncate">{c.nome}</div>
                  <div className="small text-muted">{c.codigo} · {PERIODOS[c.periodo]} · {docente(c)}</div>
                </div>
                {p?.total > 0 && <div style={{ width: 160 }}><BarraProgresso p={p} /></div>}
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}

export default VisaoCadeiras
