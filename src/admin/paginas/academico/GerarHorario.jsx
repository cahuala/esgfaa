import { useState } from 'react'
import { api } from '../../api'
import { Janela } from '../../componentes/Ui'
import { t as tx } from '../../../i18n/linguas'

// os tempos dos horários do arquivo
const TEMPOS = ['08:30-09:20', '09:30-10:20', '10:30-11:20', '11:40-12:20', '12:40-13:30', '14:30-15:30', '15:40-16:20']
const DIAS = { 1: tx('Segunda'), 2: tx('Terça'), 3: tx('Quarta'), 4: tx('Quinta'), 5: tx('Sexta'), 6: tx('Sábado') }
const SEMESTRE = { 1: tx('1.º semestre'), 2: tx('2.º semestre'), anual: tx('Anual') }

/*
  Gerar o horário semanal da turma: escolhem-se os tempos, os dias e as salas; o sistema propõe (sem choques na
  turma, nos docentes — também com as outras turmas do ano — e nas salas) e só grava quando se carrega em «Gravar».
*/
export default function GerarHorario({ turma, fechar, concluido }) {
  const [f, setF] = useState({ tempos: TEMPOS.join('\n'), dias: [1, 2, 3, 4, 5], salas: '', substituir: false })
  const [r, setR] = useState(null)
  const [erro, setErro] = useState('')
  const [aGerar, setAGerar] = useState(false)
  const corpo = (aplicar) => ({ tempos: f.tempos.split(/\n|,/).map((x) => x.trim()).filter(Boolean), dias: f.dias, salas: f.salas.split(/\n|,/).map((x) => x.trim()).filter(Boolean), substituir: f.substituir, aplicar })
  async function gerar(aplicar) {
    setAGerar(true); setErro('')
    try {
      const x = await api(`/academico/turmas/${turma.id}/horario/gerar`, { metodo: 'POST', corpo: corpo(aplicar) })
      if (aplicar) { concluido?.(tx('Horário gravado: {0} tempo(s) por semana.', { 0: x.horario.length })); fechar() } else setR(x)
    } catch (e) { setErro(e.message) } finally { setAGerar(false) }
  }
  const semestres = r ? [...new Set(r.horario.map((h) => String(h.periodo)))].sort() : []
  return (
    <Janela titulo={`${tx('Gerar o horário')} · ${turma.nome}`} onFechar={fechar} larga
      rodape={<>
        <button type="button" className="btn btn-white" onClick={fechar}>{tx('Cancelar')}</button>
        <button type="button" className="btn btn-white" disabled={aGerar} onClick={() => gerar(false)}><i className="fa fa-magic me-1" />{r ? tx('Gerar outra vez') : tx('Ver a proposta')}</button>
        {r && r.horario.length > 0 && <button type="button" className="btn btn-theme" disabled={aGerar} onClick={() => gerar(true)}><i className="fa fa-save me-1" />{tx('Gravar o horário')}</button>}
      </>}>
      {erro && <div className="alert alert-danger py-2">{erro}</div>}
      <div className="row g-2">
        <div className="col-md-4"><label className="form-label fw-bold" htmlFor="gh-tempos">{tx('Tempos (um por linha)')}</label><textarea id="gh-tempos" className="form-control font-monospace" rows={7} value={f.tempos} onChange={(e) => setF({ ...f, tempos: e.target.value })} /></div>
        <div className="col-md-4">
          <span className="form-label fw-bold d-block">{tx('Dias')}</span>
          {Object.entries(DIAS).map(([k, v]) => <label key={k} className="form-check"><input type="checkbox" className="form-check-input" checked={f.dias.includes(Number(k))} onChange={(e) => setF({ ...f, dias: e.target.checked ? [...f.dias, Number(k)].sort() : f.dias.filter((d) => d !== Number(k)) })} /> {v}</label>)}
        </div>
        <div className="col-md-4">
          <label className="form-label fw-bold" htmlFor="gh-salas">{tx('Salas (uma por linha; vazio = sem sala)')}</label>
          <textarea id="gh-salas" className="form-control" rows={4} value={f.salas} onChange={(e) => setF({ ...f, salas: e.target.value })} />
          <label className="form-check small mt-2"><input type="checkbox" className="form-check-input" checked={f.substituir} onChange={(e) => setF({ ...f, substituir: e.target.checked })} /> {tx('Refazer tudo (apaga o horário que a turma já tem)')}</label>
        </div>
      </div>
      {r && (
        <div className="mt-3">
          {r.semLugar.length > 0 && <div className="alert alert-warning py-2 small">{tx('Sem lugar para:')} {r.semLugar.map((x) => `${x.codigo} (${tx('faltam {0} tempo(s)', { 0: x.faltam })})`).join(', ')}. {tx('Junte tempos, dias ou salas.')}</div>}
          {r.mantidos > 0 && <div className="small text-muted mb-2">{tx('{0} tempo(s) que a turma já tinha ficam como estão; só se marcam as cadeiras sem horário.', { 0: r.mantidos })}</div>}
          {r.horario.length === 0 && <div className="text-muted">{tx('Nada a marcar: todas as cadeiras já têm horário (marque «Refazer tudo» para gerar de novo).')}</div>}
          {semestres.map((sm) => (
            <div key={sm} className="table-responsive mb-2">
              <div className="fw-bold small mb-1">{SEMESTRE[sm] ?? sm}</div>
              <table className="table table-sm table-bordered align-middle small mb-0">
                <thead><tr><th>{tx('Tempo')}</th>{r.dias.map((d) => <th key={d} className="text-center">{DIAS[d]}</th>)}</tr></thead>
                <tbody>
                  {r.tempos.map((tp) => (
                    <tr key={tp}>
                      <th className="text-nowrap">{tp.replace('-', '–')}</th>
                      {r.dias.map((d) => {
                        const h = r.horario.filter((x) => String(x.periodo) === sm || x.periodo === 'anual').find((x) => x.diaSemana === d && `${x.inicio}-${x.fim}` === tp)
                        return <td key={d} className="text-center" title={h ? `${h.nome}${h.docentes.length ? ` — ${h.docentes.join(', ')}` : ''}` : ''}>{h && <><b>{h.codigo}</b>{h.sala && <div className="text-muted">{h.sala}</div>}</>}</td>
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </Janela>
  )
}
