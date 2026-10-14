import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api'
import { Painel } from '../../componentes/Ui'
import ResultadosInquerito from '../../../portal/cadeira/ResultadosInquerito'

const dataHora = (v) => (v ? new Date(v).toLocaleString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')
const media = (v) => (v === null || v === undefined ? '—' : v.toLocaleString('pt-PT', { maximumFractionDigits: 2 }))

/*
  Inquérito pedagógico da turma: a Administração Escolar lança a avaliação dos docentes
  (um inquérito anónimo por docente em cada cadeira) e consulta os resultados.
*/
function AvaliacaoDocentes({ turma, gerir, avisar }) {
  const [lista, setLista] = useState(null)
  const [fecha, setFecha] = useState('')
  const [aLancar, setALancar] = useState(false)
  const [aberto, setAberto] = useState(null)
  const falhou = useCallback((e) => avisar({ tipo: 'erro', texto: e.message }), [avisar])
  const carregar = useCallback(() => api(`/academico/turmas/${turma.id}/avaliacao`).then(setLista).catch(falhou), [turma.id, falhou])
  useEffect(() => { carregar() }, [carregar])

  async function lancar(e) {
    e.preventDefault()
    setALancar(true)
    try {
      const r = await api(`/academico/turmas/${turma.id}/avaliacao`, { metodo: 'POST', corpo: { fecha: new Date(fecha).toISOString() } })
      avisar({ texto: r.criados ? `Inquérito lançado: ${r.criados} docente(s) a avaliar. Os estudantes foram avisados.` : 'Todos os docentes desta turma já têm o inquérito lançado.' })
      carregar()
    } catch (falha) {
      falhou(falha)
    } finally {
      setALancar(false)
    }
  }

  async function ver(id) {
    try {
      setAberto(await api(`/academico/inqueritos/${id}`))
    } catch (e) {
      falhou(e)
    }
  }

  return (
    <Painel titulo="Avaliação dos docentes (inquérito pedagógico)" corpo={false}>
      <div className="panel-body">
        <p className="text-muted mb-2">Cada estudante avalia, de forma anónima, os docentes das suas cadeiras: oito afirmações de 1 a 5 e dois comentários livres. O docente vê os seus resultados agregados depois do fecho, com pelo menos 3 respostas.</p>
        {gerir && (
          <form className="d-flex flex-wrap gap-2 align-items-end" onSubmit={lancar}>
            <div>
              <label className="form-label fw-bold" htmlFor="av-fecha">Responder até</label>
              <input id="av-fecha" type="datetime-local" className="form-control" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-theme" disabled={aLancar}><i className="fa fa-paper-plane me-1" />{aLancar ? 'A lançar…' : 'Lançar nas cadeiras da turma'}</button>
          </form>
        )}
      </div>
      <div className="table-responsive">
        <table className="table table-striped align-middle mb-0">
          <thead><tr><th>Cadeira</th><th>Docente</th><th className="text-center">Respostas</th><th>Fecho</th><th className="text-center">Média (1–5)</th><th /></tr></thead>
          <tbody>
            {!lista && <tr><td colSpan={6} className="text-center text-muted py-3">A carregar…</td></tr>}
            {lista?.length === 0 && <tr><td colSpan={6} className="text-center text-muted py-3">Ainda não foi lançado nesta turma.</td></tr>}
            {lista?.map((i) => (
              <tr key={i.id}>
                <td><b>{i.cadeira.codigo}</b> · {i.cadeira.nome}</td>
                <td>{i.docente || '—'}</td>
                <td className="text-center">{i.respostas} / {i.estudantes}</td>
                <td className="small">{dataHora(i.fecha)} {i.fechado ? <span className="badge bg-gray-500 ms-1">Fechado</span> : <span className="badge bg-success ms-1">Aberto</span>}</td>
                <td className="text-center fw-bold">{media(i.media)}</td>
                <td className="text-end text-nowrap">
                  <button type="button" className="btn btn-xs btn-white" onClick={() => ver(i.id)}><i className="fa fa-chart-bar me-1" />Resultados</button>
                  {gerir && (
                    <button type="button" className="btn btn-xs btn-white text-danger ms-1" aria-label={`Apagar a avaliação de ${i.docente}`} onClick={() => {
                      if (window.confirm(`Apagar a avaliação de ${i.docente} em ${i.cadeira.nome}, com as respostas?`)) api(`/academico/inqueritos/${i.id}`, { metodo: 'DELETE' }).then(carregar).catch(falhou)
                    }}><i className="fa fa-trash-alt" /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {aberto && (
        <>
          <div className="modal d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="av-titulo" onClick={() => setAberto(null)}>
            <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable" onClick={(e) => e.stopPropagation()}>
              <div className="modal-content">
                <div className="modal-header">
                  <h4 className="modal-title" id="av-titulo">{aberto.titulo}</h4>
                  <button type="button" className="btn-close" onClick={() => setAberto(null)} aria-label="Fechar" />
                </div>
                <div className="modal-body"><ResultadosInquerito resultados={aberto.resultados} media={aberto.media} /></div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      )}
    </Painel>
  )
}

export default AvaliacaoDocentes
