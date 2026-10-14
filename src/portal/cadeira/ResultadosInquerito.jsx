import { nota } from '../formatar'
import { ESCALA } from './escala'

// do vermelho (discordo totalmente) ao verde (concordo totalmente)
const CORES = ['#d9534f', '#f0ad4e', '#adb5bd', '#5cb85c', '#2e7d32']

// resultados agregados de um inquérito (portal e painel)
function ResultadosInquerito({ resultados, media }) {
  if (!resultados) return null
  if (resultados.total === 0) return <div className="text-muted">Ainda ninguém respondeu.</div>
  return (
    <div className="d-flex flex-column gap-4">
      <div className="small text-muted">{resultados.total} resposta(s){media !== undefined && media !== null ? <> · média global <b className="text-body">{nota(media)}</b> em 5</> : null}</div>
      {resultados.perguntas.map((p, i) => (
        <div key={i}>
          <div className="fw-bold mb-2">{p.texto}</div>
          {p.tipo === 'escolha' && p.opcoes.map((o, j) => (
            <div key={j} className="mb-2">
              <div className="d-flex justify-content-between small"><span>{o}</span><span className="text-muted">{p.contagens[j]} · {p.percentagens[j]}%</span></div>
              <div className="progress" style={{ height: 10 }}><div className="progress-bar" style={{ width: `${p.percentagens[j]}%`, background: '#17a2b8' }} /></div>
            </div>
          ))}
          {p.tipo === 'escala' && (
            <div className="d-flex align-items-center gap-3">
              <div className="fw-bold text-center" style={{ fontSize: 22, minWidth: 54 }}>{p.media === null ? '—' : nota(p.media)}</div>
              <div className="flex-grow-1">
                <div className="progress" style={{ height: 14 }}>
                  {p.distribuicao.map((n, j) => {
                    const total = p.distribuicao.reduce((s, x) => s + x, 0) || 1
                    return n ? <div key={j} className="progress-bar" style={{ width: `${(n / total) * 100}%`, background: CORES[j] }} title={`${ESCALA[j]}: ${n}`}>{n}</div> : null
                  })}
                </div>
                <div className="d-flex justify-content-between small text-muted mt-1"><span>Discordo totalmente</span><span>Concordo totalmente</span></div>
              </div>
            </div>
          )}
          {p.tipo === 'aberta' && (p.comentarios.length === 0 ? <div className="small text-muted">Sem comentários.</div> : (
            <ul className="list-group">{p.comentarios.map((t, j) => <li key={j} className="list-group-item small p-texto-pre">{t}</li>)}</ul>
          ))}
        </div>
      ))}
    </div>
  )
}

export default ResultadosInquerito
