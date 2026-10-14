import { nota } from '../formatar'

// grelha de avaliação (rubrica) de um trabalho: critérios com pontos máximos

// editor dos critérios (docente)
export function EditorGrelha({ grelha, aoMudar }) {
  const mudar = (i, k, v) => aoMudar(grelha.map((c, j) => (i === j ? { ...c, [k]: v } : c)))
  const total = grelha.reduce((s, c) => s + (Number(c.pontos) || 0), 0)
  return (
    <div>
      {grelha.length > 0 && (
        <table className="table table-sm align-middle mb-2">
          <thead><tr><th>Critério</th><th>Descrição (opcional)</th><th style={{ width: 90 }}>Pontos</th><th style={{ width: 36 }} /></tr></thead>
          <tbody>
            {grelha.map((c, i) => (
              <tr key={i}>
                <td><input className="form-control form-control-sm" value={c.criterio} onChange={(e) => mudar(i, 'criterio', e.target.value)} placeholder="Ex.: Argumentação" aria-label={`Critério ${i + 1}`} required /></td>
                <td><input className="form-control form-control-sm" value={c.descricao || ''} onChange={(e) => mudar(i, 'descricao', e.target.value)} aria-label={`Descrição do critério ${i + 1}`} /></td>
                <td><input type="number" min={1} max={100} className="form-control form-control-sm" value={c.pontos} onChange={(e) => mudar(i, 'pontos', e.target.value)} aria-label={`Pontos do critério ${i + 1}`} required /></td>
                <td><button type="button" className="btn btn-xs btn-white" onClick={() => aoMudar(grelha.filter((_, j) => j !== i))} aria-label={`Retirar critério ${i + 1}`}><i className="fa fa-times" /></button></td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><th colSpan={2} className="text-end">Total (convertido para 0 a 20)</th><th>{total}</th><th /></tr></tfoot>
        </table>
      )}
      {grelha.length < 15 && (
        <button type="button" className="btn btn-xs btn-white" onClick={() => aoMudar([...grelha, { criterio: '', descricao: '', pontos: 5 }])}>
          <i className="fa fa-plus me-1" />{grelha.length ? 'Critério' : 'Usar grelha de avaliação'}
        </button>
      )}
    </div>
  )
}

// resultado da grelha (estudante) ou pontos a dar (docente, editavel)
export function TabelaGrelha({ grelha, pontos = {}, editavel, aoMudar }) {
  const obtidos = grelha.reduce((s, c, i) => s + (Number(String(pontos[i] ?? '').replace(',', '.')) || 0), 0)
  const total = grelha.reduce((s, c) => s + c.pontos, 0)
  const completa = grelha.every((c, i) => pontos[i] !== undefined && pontos[i] !== null && pontos[i] !== '')
  return (
    <table className="table table-bordered table-sm align-middle mb-0">
      <thead><tr><th>Critério</th><th className="text-center" style={{ width: 120 }}>Pontos</th></tr></thead>
      <tbody>
        {grelha.map((c, i) => (
          <tr key={i}>
            <td><b>{c.criterio}</b>{c.descricao && <div className="small text-muted">{c.descricao}</div>}</td>
            <td className="text-center text-nowrap">
              {editavel
                ? <input className="form-control form-control-sm d-inline-block text-center" style={{ width: 60 }} inputMode="decimal" value={pontos[i] ?? ''} onChange={(e) => aoMudar({ ...pontos, [i]: e.target.value })} aria-label={`Pontos em ${c.criterio}`} />
                : <b>{pontos[i] === undefined || pontos[i] === null || pontos[i] === '' ? '—' : nota(pontos[i])}</b>}
              <span className="text-muted"> / {c.pontos}</span>
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr><th className="text-end">Total</th><th className="text-center">{nota(obtidos)} / {total}{completa && total ? <span className="d-block small text-muted">= {nota(Math.round((obtidos / total) * 2000) / 100)} valores</span> : null}</th></tr>
      </tfoot>
    </table>
  )
}
