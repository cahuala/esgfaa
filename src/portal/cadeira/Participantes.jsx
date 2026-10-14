import { useEffect, useState } from 'react'
import { api } from '../api'
import { Cartao, Carregando } from '../componentes'
import { iniciais } from '../formatar'

// participantes da cadeira (docentes e estudantes da turma), como no Moodle
function Participantes({ c, avisar }) {
  const [p, setP] = useState(null)
  const [filtro, setFiltro] = useState('')
  useEffect(() => { api(`/cadeiras/${c.id}/participantes`).then(setP).catch((e) => avisar({ tipo: 'erro', texto: e.message })) }, [c.id, avisar])
  if (!p) return <Carregando />
  const todos = [
    ...p.docentes.map((d) => ({ ...d, funcao: d.papel === 'regente' ? 'Regente' : 'Assistente', cor: 'bg-dark' })),
    ...p.estudantes.map((e) => ({ ...e, funcao: 'Estudante', cor: 'bg-gray-500' })),
  ].filter((x) => !filtro || `${x.nome} ${x.numero || ''} ${x.email}`.toLowerCase().includes(filtro.toLowerCase()))
  return (
    <Cartao titulo={<><i className="fa fa-users me-2" />Participantes ({p.docentes.length + p.estudantes.length})</>} corpo={false}>
      <div className="panel-body pb-2">
        <div className="input-group" style={{ maxWidth: 360 }}>
          <span className="input-group-text"><i className="fa fa-search" /></span>
          <input className="form-control" placeholder="Procurar por nome, número ou e-mail" value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Procurar participantes" />
        </div>
      </div>
      <div className="table-responsive">
        <table className="table table-hover table-panel align-middle mb-0">
          <thead><tr><th>Nome</th><th>Número</th><th>E-mail</th><th>Papel</th></tr></thead>
          <tbody>
            {todos.map((x) => (
              <tr key={`${x.funcao}-${x.id}`}>
                <td><span className="d-flex align-items-center gap-2"><span className="admin-avatar">{iniciais(x.nome)}</span><b>{x.nome}</b></span></td>
                <td className="font-monospace small">{x.numero || '—'}</td>
                <td className="small"><a href={`mailto:${x.email}`}>{x.email}</a></td>
                <td><span className={`badge ${x.cor}`}>{x.funcao}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Cartao>
  )
}

export default Participantes
