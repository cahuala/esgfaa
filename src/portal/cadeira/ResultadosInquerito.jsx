import { nota } from '../formatar'
import { escalaDe } from '../inquerito/tipos'
import { t as tx } from '../../i18n/linguas'

// do vermelho (o valor mais baixo) ao verde (o mais alto)
const CORES5 = ['#d9534f', '#f0ad4e', '#adb5bd', '#5cb85c', '#2e7d32']
const corDe = (j, n) => (n === 5 ? CORES5[j] : `hsl(${Math.round((j / Math.max(1, n - 1)) * 120)}, 55%, 48%)`)

function Barra({ rotulo, n, pct }) {
  return (
    <div className="mb-2">
      <div className="d-flex justify-content-between small"><span>{rotulo}</span><span className="text-muted">{n} · {pct}%</span></div>
      <div className="progress" style={{ height: 10 }}><div className="progress-bar" style={{ width: `${pct}%`, background: '#17a2b8' }} /></div>
    </div>
  )
}

function Textos({ l, vazio }) {
  if (!l.length) return <div className="small text-muted">{vazio}</div>
  return <ul className="list-group" style={{ maxHeight: 320, overflowY: 'auto' }}>{l.map((t, j) => <li key={j} className="list-group-item small p-texto-pre">{t}</li>)}</ul>
}

// resultados agregados de um inquérito (portal e painel), com todos os tipos de pergunta e as secções
function ResultadosInquerito({ resultados, media }) {
  if (!resultados) return null
  if (resultados.total === 0) return <div className="text-muted">{tx('Ainda ninguém respondeu.')}</div>
  return (
    <div className="d-flex flex-column gap-4">
      <div className="small text-muted">{resultados.total} {tx('resposta(s)')}{media !== undefined && media !== null ? <> {tx('· média global')} <b className="text-body">{nota(media)}</b> {tx('em 5')}</> : null}</div>
      {resultados.perguntas.map((p, i) => (p.tipo === 'seccao' ? (
        <div key={i} className="border-top pt-3"><div className="small text-muted text-uppercase">{tx('Secção')}</div><div className="fw-bold fs-5">{p.texto}</div></div>
      ) : (
        <div key={i}>
          <div className="fw-bold">{p.texto}</div>
          {/* só nas perguntas a que nem todos responderam (as não obrigatórias) */}
          {p.respostas !== undefined && p.respostas !== resultados.total && <div className="small text-muted mb-2">{tx('{0} de {1} responderam', { 0: p.respostas, 1: resultados.total })}</div>}
          {p.tipo === 'escolha' && (
            <>
              {p.opcoes.map((o, j) => <Barra key={j} rotulo={o} n={p.contagens[j]} pct={p.percentagens[j]} />)}
              {p.outra && <Barra rotulo={tx('Outra')} n={p.outraContagem} pct={p.outraPercentagem} />}
              {p.outras?.length > 0 && <details className="small"><summary>{tx('Respostas «Outra»')} ({p.outras.length})</summary><Textos l={p.outras} /></details>}
            </>
          )}
          {p.tipo === 'escala' && <Escala p={p} />}
          {p.tipo === 'grelha' && (
            <div className="table-responsive">
              <table className="table table-sm small mb-0">
                <thead><tr><th />{p.colunas.map((c, j) => <th key={j} className="text-center">{c}</th>)}</tr></thead>
                <tbody>{p.linhas.map((l, li) => {
                  const total = p.contagens[li].reduce((s, x) => s + x, 0) || 1
                  return (
                    <tr key={li}><th>{l}</th>{p.contagens[li].map((n, j) => (
                      <td key={j} className="text-center" style={{ background: n ? `rgba(23, 162, 184, ${0.12 + (n / total) * 0.55})` : undefined }}>{n}</td>
                    ))}</tr>
                  )
                })}</tbody>
              </table>
            </div>
          )}
          {['aberta', 'curta', 'data', 'hora'].includes(p.tipo) && <Textos l={p.comentarios || []} vazio={tx('Sem respostas.')} />}
        </div>
      )))}
    </div>
  )
}

function Escala({ p }) {
  const e = escalaDe(p)
  const total = p.distribuicao.reduce((s, x) => s + x, 0) || 1
  return (
    <div className="d-flex align-items-center gap-3">
      <div className="fw-bold text-center" style={{ fontSize: 22, minWidth: 54 }}>{p.media === null ? '—' : nota(p.media)}</div>
      <div className="flex-grow-1">
        <div className="progress" style={{ height: 14 }}>
          {p.distribuicao.map((n, j) => (n ? <div key={j} className="progress-bar" style={{ width: `${(n / total) * 100}%`, background: corDe(j, p.distribuicao.length) }} title={`${e.nome(e.min + j)}: ${n}`}>{n}</div> : null))}
        </div>
        <div className="d-flex justify-content-between small text-muted mt-1"><span>{e.min}{e.rotuloMin ? ` — ${e.rotuloMin}` : ''}</span><span>{e.max}{e.rotuloMax ? ` — ${e.rotuloMax}` : ''}</span></div>
      </div>
    </div>
  )
}

export default ResultadosInquerito
