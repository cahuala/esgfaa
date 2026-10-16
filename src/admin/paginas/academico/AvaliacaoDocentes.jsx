import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api'
import { Painel } from '../../componentes/Ui'
import ResultadosInquerito from '../../../portal/cadeira/ResultadosInquerito'
import { confirmar } from '../../../portal/dialogos'
import { t as tx, localAtual } from '../../../i18n/linguas'

const dataHora = (v) => (v ? new Date(v).toLocaleString(localAtual(), { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')
const media = (v) => (v === null || v === undefined ? '—' : v.toLocaleString(localAtual(), { maximumFractionDigits: 2 }))

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
      avisar({ texto: r.criados ? tx('Inquérito lançado: {0} docente(s) a avaliar. Os estudantes foram avisados.', { 0: r.criados }) : tx('Todos os docentes desta turma já têm o inquérito lançado.') })
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
    <Painel titulo={tx('Avaliação dos docentes (inquérito pedagógico)')} corpo={false}>
      <div className="panel-body">
        <p className="text-muted mb-2">{tx('Cada estudante avalia, de forma anónima, os docentes das suas cadeiras: oito afirmações de 1 a 5 e dois comentários livres. O docente vê os seus resultados agregados depois do fecho, com pelo menos 3 respostas.')}</p>
        {gerir && (
          <form className="d-flex flex-wrap gap-2 align-items-end" onSubmit={lancar}>
            <div>
              <label className="form-label fw-bold" htmlFor="av-fecha">{tx('Responder até')}</label>
              <input id="av-fecha" type="datetime-local" className="form-control" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-theme" disabled={aLancar}><i className="fa fa-paper-plane me-1" />{aLancar ? tx('A lançar…') : tx('Lançar nas cadeiras da turma')}</button>
          </form>
        )}
      </div>
      <div className="table-responsive">
        <table className="table table-striped align-middle mb-0">
          <thead><tr><th>{tx('Cadeira')}</th><th>{tx('Docente')}</th><th className="text-center">{tx('Respostas')}</th><th>{tx('Fecho')}</th><th className="text-center">{tx('Média (1–5)')}</th><th /></tr></thead>
          <tbody>
            {!lista && <tr><td colSpan={6} className="text-center text-muted py-3">{tx('A carregar…')}</td></tr>}
            {lista?.length === 0 && <tr><td colSpan={6} className="text-center text-muted py-3">{tx('Ainda não foi lançado nesta turma.')}</td></tr>}
            {lista?.map((i) => (
              <tr key={i.id}>
                <td><b>{i.cadeira.codigo}</b> · {i.cadeira.nome}</td>
                <td>{i.docente || '—'}</td>
                <td className="text-center">{i.respostas} / {i.estudantes}</td>
                <td className="small">{dataHora(i.fecha)} {i.fechado ? <span className="badge bg-gray-500 ms-1">{tx('Fechado')}</span> : <span className="badge bg-success ms-1">{tx('Aberto')}</span>}</td>
                <td className="text-center fw-bold">{media(i.media)}</td>
                <td className="text-end text-nowrap">
                  <button type="button" className="btn btn-xs btn-white" onClick={() => ver(i.id)}><i className="fa fa-chart-bar me-1" />{tx('Resultados')}</button>
                  {gerir && (
                    <button type="button" className="btn btn-xs btn-white text-danger ms-1" aria-label={tx('Apagar a avaliação de {0}', { 0: i.docente })} onClick={async () => {
                      if (await confirmar(tx('Apagar a avaliação de {0} em {1}, com as respostas?', { 0: i.docente, 1: i.cadeira.nome }), { titulo: tx('Apagar avaliação'), botao: tx('Apagar'), perigo: true })) api(`/academico/inqueritos/${i.id}`, { metodo: 'DELETE' }).then(carregar).catch(falhou)
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
                  <button type="button" className="btn-close" onClick={() => setAberto(null)} aria-label={tx('Fechar')} />
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
