import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { Cartao, Carregando, Vazio } from '../componentes'

const ICONES = { material: 'fa-file-alt', trabalho: 'fa-tasks', questionario: 'fa-question-circle' }

// barra de progresso do estudante numa cadeira
export function BarraProgresso({ p }) {
  if (!p || p.total === 0) return null
  return (
    <div className="d-flex align-items-center gap-2 small" title={`${p.feitas} de ${p.total} atividades concluídas`}>
      <div className="progress flex-grow-1" style={{ height: 8 }}><div className="progress-bar bg-success" style={{ width: `${p.percentagem}%` }} /></div>
      <span className="fw-bold text-nowrap">{p.percentagem}%</span>
    </div>
  )
}

// docente: relatório de conclusão das atividades (estudantes × atividades), como no Moodle
function Progresso({ c, avisar }) {
  const [r, setR] = useState(null)
  const falhou = useCallback((e) => avisar({ tipo: 'erro', texto: e.message }), [avisar])
  useEffect(() => { api(`/cadeiras/${c.id}/progresso`).then(setR).catch(falhou) }, [c.id, falhou])
  if (!r) return <Carregando />
  if (!r.atividades.length) return <Vazio>Ainda não há atividades (materiais, trabalhos ou questionários publicados).</Vazio>
  return (
    <Cartao titulo={<><i className="fa fa-tasks me-2" />Conclusão das atividades</>} corpo={false}>
      <div className="table-responsive">
        <table className="table table-bordered align-middle text-center mb-0">
          <thead>
            <tr>
              <th className="text-start">Estudante</th>
              {r.atividades.map((a) => <th key={`${a.tipo}-${a.id}`} title={a.titulo} style={{ maxWidth: 120 }}><i className={`fa ${ICONES[a.tipo]} d-block mb-1`} /><span className="small fw-normal d-block text-truncate">{a.titulo}</span></th>)}
              <th>Progresso</th>
            </tr>
          </thead>
          <tbody>
            {r.linhas.map((l) => (
              <tr key={l.estudante.id}>
                <td className="text-start text-nowrap"><b>{l.estudante.nome}</b><div className="small text-muted">{l.estudante.numero}</div></td>
                {r.atividades.map((a) => {
                  const feita = l.concluidas.includes(`${a.tipo}-${a.id}`)
                  return <td key={`${a.tipo}-${a.id}`}>{feita ? <i className="fa fa-check-circle text-success" aria-label="Concluída" /> : <i className="far fa-circle text-gray-400" aria-label="Por fazer" />}</td>
                })}
                <td style={{ minWidth: 120 }}><BarraProgresso p={l} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Cartao>
  )
}

export default Progresso
