import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useSessao } from '../sessaoContexto'
import { Carregando, Erro, Titulo, Vazio, Widget } from '../componentes'
import { nota } from '../formatar'
import { Nota, Situacao } from '../avaliacao'
import { PERIODOS, REGRA } from '../regraAvaliacao'

const ESTADOS = { ativa: ['bg-primary', 'Em curso'], concluida: ['bg-success', 'Concluído'], suspensa: ['bg-warning text-dark', 'Suspenso'] }

/*
  Percurso académico: os anos do estudante na Escola, do primeiro ao atual (linha do tempo),
  com as disciplinas de cada ano, as notas finais publicadas e um resumo do curso.
*/
function Percurso() {
  const { conta } = useSessao()
  const [p, setP] = useState(null)
  const [erro, setErro] = useState('')
  useEffect(() => { api('/percurso').then(setP).catch((e) => setErro(e.message)) }, [])

  if (erro) return <Erro texto={erro} />
  if (!p) return <Carregando />
  const r = p.resumo
  const pct = r.horas ? Math.round((r.horasAprovadas / r.horas) * 100) : 0

  return (
    <>
      <Titulo rotulo="Percurso académico" titulo="Percurso académico" sub={`${conta.nome} · n.º ${conta.numero}`}>
        <button type="button" className="btn btn-white" onClick={() => window.print()}><i className="fa fa-print me-1" /> Imprimir</button>
      </Titulo>

      <div className="row">
        <div className="col-xl-3 col-md-6"><Widget cor="bg-dark" icone="fa-layer-group" titulo="ANOS FREQUENTADOS" valor={p.anos.length} nota={p.anos.map((a) => a.turma.anoLetivo).join(' · ') || '—'} /></div>
        <div className="col-xl-3 col-md-6"><Widget cor="bg-teal" icone="fa-check-double" titulo="DISCIPLINAS APROVADAS" valor={`${r.aprovadas} / ${r.disciplinas}`} nota={`${r.reprovadas} reprovada(s) · ${r.emCurso} em curso`} /></div>
        <div className="col-xl-3 col-md-6"><Widget cor="bg-red" icone="fa-star" titulo="MÉDIA DAS APROVADAS" valor={nota(r.media)} nota="média aritmética das notas finais" /></div>
        <div className="col-xl-3 col-md-6">
          <div className="widget widget-stats bg-orange">
            <div className="stats-icon"><i className="fa fa-hourglass-half" /></div>
            <div className="stats-info"><h4>HORAS CONCLUÍDAS</h4><p>{r.horasAprovadas} h</p></div>
            <div className="stats-progress progress"><div className="progress-bar" style={{ width: `${pct}%` }} /></div>
            <div className="stats-desc">{pct}% das {r.horas} h das disciplinas inscritas</div>
          </div>
        </div>
      </div>

      {p.anos.length === 0 ? <Vazio>Ainda não tem matrículas.</Vazio> : (
        <div className="timeline p-percurso">
          {[...p.anos].reverse().map((a) => {
            const [cor, estado] = ESTADOS[a.matricula.estado] || ESTADOS.ativa
            return (
              <div key={a.matricula.id} className={`timeline-item ${a.matricula.estado === 'concluida' ? 'p-concluido' : ''}`}>
                <div className="timeline-time">
                  <span className="date">{a.turma.anoLetivo}</span>
                  <span className="time">{a.turma.anoCurricular}.º ano</span>
                </div>
                <div className="timeline-icon"><a href="#percurso" onClick={(e) => e.preventDefault()} aria-hidden="true" tabIndex={-1}>&nbsp;</a></div>
                <div className="timeline-content">
                  <div className="timeline-header">
                    <div className="username">
                      <span className="fw-bold">{a.turma.nome}</span> <span className={`badge ${cor} ms-1`}>{estado}</span>
                      <div className="text-muted fs-12px">{a.resumo.aprovadas} de {a.resumo.disciplinas} disciplinas aprovadas · {a.resumo.horasAprovadas} / {a.resumo.horas} h</div>
                    </div>
                    <div className="text-end">
                      <div className="text-muted fs-11px text-uppercase">Média do ano</div>
                      <div className="fs-20px fw-bold">{nota(a.resumo.media)}</div>
                    </div>
                  </div>
                  <div className="timeline-body">
                    <div className="table-responsive">
                      <table className="table table-bordered table-hover align-middle text-center mb-0 p-matriz">
                        <thead>
                          <tr>
                            <th scope="col" className="p-matriz-nome">Disciplina</th>
                            <th scope="col">Horas</th>
                            <th scope="col" className="p-matriz-mac">MAC</th>
                            <th scope="col">Exame</th>
                            <th scope="col">Recurso</th>
                            <th scope="col" className="p-matriz-final">Nota final</th>
                            <th scope="col">Situação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {a.disciplinas.length === 0 && <tr><td colSpan={7} className="text-muted">Sem disciplinas.</td></tr>}
                          {a.disciplinas.map((l) => (
                            <tr key={l.cadeira.id}>
                              <th scope="row" className="p-matriz-nome">
                                {a.matricula.estado === 'ativa' ? <Link to={`/cadeiras/${l.cadeira.id}`}>{l.cadeira.nome}</Link> : l.cadeira.nome}
                                <small>{l.cadeira.codigo} · {PERIODOS[l.cadeira.periodo]}{l.cadeira.docente && ` · ${l.cadeira.docente}`}</small>
                              </th>
                              <td>{l.cadeira.horas}</td>
                              <td className="p-matriz-mac"><Nota valor={l.mac} /></td>
                              <td>{l.situacao === 'dispensado' ? <span className="p-nota-vazia">dispensado</span> : <Nota valor={l.exame} />}</td>
                              <td><Nota valor={l.recurso} /></td>
                              <td className="p-matriz-final"><Nota valor={l.situacao === 'recurso' ? null : l.final} forte /></td>
                              <td><Situacao situacao={l.situacao} />{l.classificacao && l.situacao !== 'reprovado' && <small className="p-classificacao">{l.classificacao}</small>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  {a.resumo.reprovadas > 0 && (
                    <div className="timeline-footer text-danger small">
                      <i className="fa fa-exclamation-triangle me-1" />{a.resumo.reprovadas} disciplina(s) em atraso: fale com a Administração Escolar sobre a inscrição.
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
      <p className="p-legenda">{REGRA} Só contam as notas já publicadas.</p>
    </>
  )
}

export default Percurso
