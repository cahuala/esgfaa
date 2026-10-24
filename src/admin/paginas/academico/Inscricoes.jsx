import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { Painel, Carregando } from '../../componentes/Ui'
import { confirmar } from '../../../portal/dialogos'
import { t as tx } from '../../../i18n/linguas'

/*
  Estudantes da cadeira: os da turma e os inscritos de fora (cadeira em atraso, repetição,
  equivalência). A Administração Escolar inscreve e anula inscrições.
*/
function Inscricoes({ c, gerir, avisar }) {
  const [d, setD] = useState(null)
  const [q, setQ] = useState('')
  const [encontrados, setEncontrados] = useState([])
  const [f, setF] = useState({ estudanteId: null, nome: '', motivo: 'atraso', observacao: '' })
  const falhou = useCallback((e) => avisar({ tipo: 'erro', texto: e.message }), [avisar])
  const carregar = useCallback(() => api(`/academico/cadeiras/${c.id}/inscricoes`).then(setD).catch(falhou), [c.id, falhou])
  useEffect(() => { carregar() }, [carregar])
  // pesquisa de estudantes pelo nome, número ou e-mail (espera que se pare de escrever)
  useEffect(() => {
    if (q.trim().length < 2) return undefined
    const t = setTimeout(() => api(`/academico/contas?tipo=estudante&q=${encodeURIComponent(q.trim())}`).then((l) => setEncontrados(l.slice(0, 8))).catch(() => {}), 300)
    return () => clearTimeout(t)
  }, [q])
  if (!d) return <Carregando />

  async function inscrever(e) {
    e.preventDefault()
    try {
      setD(await api(`/academico/cadeiras/${c.id}/inscricoes`, { metodo: 'POST', corpo: { estudanteId: f.estudanteId, motivo: f.motivo, observacao: f.observacao } }))
      avisar({ texto: tx('{0} inscrito em {1}. O estudante foi avisado.', { 0: f.nome, 1: c.codigo }) })
      setF({ estudanteId: null, nome: '', motivo: 'atraso', observacao: '' })
      setQ('')
      setEncontrados([])
    } catch (falha) {
      falhou(falha)
    }
  }
  const anular = async (i) => (await confirmar(tx('Anular a inscrição de {0}? Deixa de ver a cadeira.', { 0: i.estudante.nome }), { titulo: tx('Anular inscrição'), botao: tx('Anular'), perigo: true }))
    && api(`/academico/inscricoes/${i.id}`, { metodo: 'DELETE' }).then(setD).catch(falhou)
  const ativas = d.inscricoes.filter((i) => i.estado === 'ativa')

  return (
    <div className="row">
      <div className="col-xl-7">
        <Painel titulo={tx('Estudantes da cadeira ({0})', { 0: d.daTurma.length + ativas.length })} corpo={false}>
          <div className="table-responsive">
            <table className="table table-striped align-middle mb-0">
              <thead><tr><th>{tx('Estudante')}</th><th>{tx('Origem')}</th><th /></tr></thead>
              <tbody>
                {d.daTurma.map((e) => (
                  <tr key={`t${e.id}`}><td><Link to={`/academico/documentos/estudante/${e.id}/historico`} className="fw-bold">{e.nome}</Link><div className="small text-muted">{e.numero}</div></td><td><span className="badge bg-gray-500">{tx('Turma')} {c.turma?.nome}</span></td><td /></tr>
                ))}
                {d.inscricoes.map((i) => (
                  <tr key={`i${i.id}`} className={i.estado === 'anulada' ? 'text-muted' : ''}>
                    <td><Link to={`/academico/documentos/estudante/${i.estudante.id}/historico`} className="fw-bold">{i.estudante.nome}</Link><div className="small text-muted">{i.estudante.numero}</div></td>
                    <td>
                      <span className={`badge ${i.estado === 'ativa' ? 'bg-indigo' : 'bg-light text-muted border'}`}>{tx('Inscrição ·')} {d.motivos[i.motivo]}{i.estado === 'anulada' ? ' (anulada)' : ''}</span>
                      {i.observacao && <div className="small text-muted">{i.observacao}</div>}
                    </td>
                    <td className="text-end">{gerir && i.estado === 'ativa' && <button type="button" className="btn btn-xs btn-white text-danger" onClick={() => anular(i)}>{tx('Anular')}</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Painel>
      </div>
      {gerir && (
        <div className="col-xl-5">
          <Painel titulo={tx('Inscrever um estudante de outra turma')}>
            <form onSubmit={inscrever}>
              <label className="form-label fw-bold" htmlFor="insc-q">{tx('Estudante')}</label>
              {f.estudanteId ? (
                <div className="d-flex align-items-center gap-2 mb-3">
                  <span className="badge bg-theme fs-12px">{f.nome}</span>
                  <button type="button" className="btn btn-xs btn-white" onClick={() => setF({ ...f, estudanteId: null, nome: '' })}>{tx('Mudar')}</button>
                </div>
              ) : (
                <div className="mb-3">
                  <input id="insc-q" className="form-control" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx('Nome, número ou e-mail')} autoComplete="off" />
                  {q.trim().length >= 2 && (
                    <div className="list-group mt-1">
                      {encontrados.length === 0 && <div className="list-group-item small text-muted">{tx('Nenhum estudante encontrado.')}</div>}
                      {encontrados.map((e) => (
                        <button key={e.id} type="button" className="list-group-item list-group-item-action text-start" onClick={() => setF({ ...f, estudanteId: e.id, nome: e.nome })}>
                          <b>{e.nome}</b> <span className="small text-muted">{e.numero}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <label className="form-label fw-bold" htmlFor="insc-motivo">{tx('Motivo')}</label>
              <select id="insc-motivo" className="form-select mb-3" value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })}>
                {Object.entries(d.motivos).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <label className="form-label fw-bold" htmlFor="insc-obs">{tx('Observação (opcional)')}</label>
              <input id="insc-obs" className="form-control mb-3" value={f.observacao} onChange={(e) => setF({ ...f, observacao: e.target.value })} maxLength={300} />
              <button type="submit" className="btn btn-theme" disabled={!f.estudanteId}><i className="fa fa-user-plus me-1" />{tx('Inscrever na cadeira')}</button>
            </form>
          </Painel>
        </div>
      )}
    </div>
  )
}

export default Inscricoes
