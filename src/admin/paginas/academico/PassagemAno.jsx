import { useEffect, useState } from 'react'
import { api } from '../../api'
import { t as tx } from '../../../i18n/linguas'

const DECISOES = {
  transita: ['bg-success', tx('Transita')],
  nao_transita: ['bg-danger', tx('Não transita')],
  por_decidir: ['bg-warning text-dark', tx('Por decidir')],
}

/*
  Passagem de ano: da turma deste ano curricular para a do ano seguinte do mesmo curso. Primeiro mostra
  quem transita (todas as cadeiras aprovadas), quem não transita (reprovadas ou excluído por faltas) e quem
  fica por decidir (pautas por fechar); só ao confirmar matricula os que transitam.
*/
function PassagemAno({ turma, fechar, concluido }) {
  const [turmas, setTurmas] = useState([])
  const [destino, setDestino] = useState('')
  const [r, setR] = useState(null)
  const [erro, setErro] = useState('')
  const [aTrabalhar, setATrabalhar] = useState(false)
  useEffect(() => {
    api('/academico/turmas').then((l) => {
      const seguintes = l.filter((x) => x.curso === turma.curso && x.anoCurricular === turma.anoCurricular + 1)
      setTurmas(seguintes)
      setDestino(String(seguintes[0]?.id || ''))
    }).catch((e) => setErro(e.message))
  }, [turma])

  async function pedir(executar) {
    setErro('')
    setATrabalhar(true)
    try {
      setR(await api(`/academico/turmas/${turma.id}/transicao`, { metodo: 'POST', corpo: { destinoId: Number(destino), executar } }))
      if (executar) concluido()
    } catch (e) {
      setErro(e.message)
    } finally {
      setATrabalhar(false)
    }
  }

  return (
    <>
      <div className="modal d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="passagem-ano" onClick={() => !aTrabalhar && fechar()}>
        <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title" id="passagem-ano"><i className="fa fa-level-up-alt me-2" />{tx('Passagem de ano')} — {turma.nome}</h4>
              <button type="button" className="btn-close" onClick={fechar} disabled={aTrabalhar} aria-label={tx('Fechar')} />
            </div>
            <div className="modal-body">
              {erro && <div className="alert alert-danger py-2">{erro}</div>}
              <p className="text-muted">{tx('Transita quem tem todas as cadeiras aprovadas ou dispensadas. Quem reprovou ou foi excluído por faltas não transita; quem ainda tem exame ou recurso fica por decidir. Ao confirmar, os que transitam ficam matriculados na turma do ano seguinte e a matrícula nesta turma passa a concluída (as notas ficam no histórico).')}</p>
              <label className="form-label fw-bold" htmlFor="pa-destino">{tx('Turma do ano seguinte')}</label>
              <select id="pa-destino" className="form-select mb-3" value={destino} onChange={(e) => { setDestino(e.target.value); setR(null) }}>
                {turmas.length === 0 && <option value="">{tx('Crie primeiro a turma do {0}.º ano deste curso', { 0: turma.anoCurricular + 1 })}</option>}
                {turmas.map((x) => <option key={x.id} value={x.id}>{x.nome} — {x.anoLetivo} ({x.anoCurricular}.º {tx('ano')})</option>)}
              </select>
              {r && (
                <>
                  <div className={`alert ${r.executada ? 'alert-success' : 'alert-info'} py-2`}>
                    {r.executada ? <><i className="fa fa-check-circle me-1" />{tx('Feito: {0} estudante(s) matriculado(s) em {1}.', { 0: r.resumo.transita, 1: r.destino.nome })}</> : tx('Simulação: ainda ninguém foi matriculado.')}
                    {' '}{tx('Transitam {0} · não transitam {1} · por decidir {2}.', { 0: r.resumo.transita, 1: r.resumo.nao_transita, 2: r.resumo.por_decidir })}
                  </div>
                  <table className="table table-bordered align-middle mb-0">
                    <thead><tr><th>{tx('Estudante')}</th><th className="text-center">{tx('Aprovadas')}</th><th>{tx('Decisão')}</th><th>{tx('Cadeiras em falta')}</th></tr></thead>
                    <tbody>
                      {r.linhas.map((l) => (
                        <tr key={l.estudante.id}>
                          <td><b>{l.estudante.nome}</b><div className="small text-muted">{l.estudante.numero}</div></td>
                          <td className="text-center">{l.aprovadas}/{l.cadeiras}</td>
                          <td><span className={`badge ${DECISOES[l.decisao][0]}`}>{DECISOES[l.decisao][1]}</span></td>
                          <td className="small">{l.pendentes.join(', ') || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-white" onClick={fechar} disabled={aTrabalhar}>{r?.executada ? tx('Fechar') : tx('Cancelar')}</button>
              {!r?.executada && <button type="button" className="btn btn-white" onClick={() => pedir(false)} disabled={!destino || aTrabalhar}><i className="fa fa-search me-1" />{tx('Simular')}</button>}
              {r && !r.executada && r.resumo.transita > 0 && <button type="button" className="btn btn-theme" onClick={() => pedir(true)} disabled={aTrabalhar}><i className="fa fa-check me-1" />{tx('Confirmar a passagem de {0} estudante(s)', { 0: r.resumo.transita })}</button>}
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  )
}

export default PassagemAno
