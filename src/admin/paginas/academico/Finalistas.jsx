import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { Painel } from '../../componentes/Ui'
import { t as tx, localAtual } from '../../../i18n/linguas'

const valor = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString(localAtual(), { maximumFractionDigits: 2 }))

/*
  Finalistas da turma (último ano): lançar o trabalho de fim de curso (tema, orientador, júri,
  defesa e nota), ver o que falta para concluir o curso e emitir o certificado de conclusão.
*/
// mostrar: os estudantes que a pesquisa da turma deixa ver (sem ela, todos)
function Finalistas({ turma, gerir, avisar, mostrar }) {
  const [d, setD] = useState(null)
  const [aberto, setAberto] = useState(null)
  const falhou = useCallback((e) => avisar({ tipo: 'erro', texto: e.message }), [avisar])
  const carregar = useCallback(() => api(`/academico/turmas/${turma.id}/finalistas`).then(setD).catch(falhou), [turma.id, falhou])
  useEffect(() => { carregar() }, [carregar])

  const concluidos = d ? d.linhas.filter((l) => l.conclusao.concluido).length : 0
  return (
    <Painel titulo={tx('Finalistas: trabalho de fim de curso e conclusão{0}', { 0: d ? tx(' ({0} de {1} concluídos)', { 0: concluidos, 1: d.linhas.length }) : '' })} corpo={false}>
      <div className="table-responsive">
        <table className="table table-striped align-middle mb-0">
          <thead><tr><th>{tx('Estudante')}</th><th>{tx('Trabalho de fim de curso')}</th><th className="text-center">{tx('Nota TFC')}</th><th className="text-center">{tx('Cadeiras')}</th><th>{tx('Conclusão')}</th><th /></tr></thead>
          <tbody>
            {!d && <tr><td colSpan={6} className="text-center text-muted py-3">{tx('A carregar…')}</td></tr>}
            {d?.linhas.filter((l) => !mostrar || mostrar.has(l.estudante.id)).map((l) => (
              <LinhaFinalista key={l.estudante.id} l={l} turma={turma} gerir={gerir} aberta={aberto === l.estudante.id}
                alternar={() => setAberto(aberto === l.estudante.id ? null : l.estudante.id)} avisar={avisar} carregar={carregar} />
            ))}
          </tbody>
        </table>
      </div>
    </Painel>
  )
}

function LinhaFinalista({ l, turma, gerir, aberta, alternar, avisar, carregar }) {
  const [f, setF] = useState({ tema: l.tfc?.tema || '', orientador: l.tfc?.orientador || '', juri: l.tfc?.juri || '', dataDefesa: l.tfc?.dataDefesa || '', nota: l.tfc?.nota ?? '', observacao: l.tfc?.observacao || '' })
  const [aGuardar, setAGuardar] = useState(false)
  async function guardar(e) {
    e.preventDefault()
    setAGuardar(true)
    try {
      await api(`/academico/turmas/${turma.id}/tfc/${l.estudante.id}`, { metodo: 'PUT', corpo: { ...f, dataDefesa: f.dataDefesa || null, nota: f.nota === '' ? null : f.nota } })
      avisar({ texto: tx('Trabalho de fim de curso de {0} guardado.', { 0: l.estudante.nome }) })
      carregar()
    } catch (falha) {
      avisar({ tipo: 'erro', texto: falha.message })
    } finally {
      setAGuardar(false)
    }
  }
  const c = l.conclusao
  return (
    <>
      <tr>
        <td><b>{l.estudante.nome}</b><div className="small text-muted">{l.estudante.numero}</div></td>
        <td className="small">{l.tfc ? l.tfc.tema : <span className="text-muted">{tx('Por lançar')}</span>}</td>
        <td className="text-center fw-bold">{valor(l.tfc?.nota)}</td>
        <td className="text-center">{l.resumo.aprovadas}/{l.resumo.disciplinas}</td>
        <td>
          {c.concluido
            ? <span className="badge bg-success">{tx('Concluído ·')} {valor(c.mediaFinal)} ({c.classificacaoFinal})</span>
            : <span className="small text-muted" title={c.emFalta.join('\n')}>{tx('Falta:')} {c.emFalta.slice(0, 2).join('; ')}{c.emFalta.length > 2 ? tx(' e mais {0}', { 0: c.emFalta.length - 2 }) : ''}</span>}
        </td>
        <td className="text-end text-nowrap">
          <Link to={`/academico/documentos/estudante/${l.estudante.id}/historico`} className="btn btn-xs btn-white me-1" title={tx('Histórico académico')}><i className="fa fa-scroll" /></Link>
          {c.concluido && gerir && <Link to={`/academico/documentos/turma/${turma.id}/certificado/${l.estudante.id}`} className="btn btn-xs btn-success me-1"><i className="fa fa-award me-1" />{l.certificado ? tx('Certificado') : tx('Emitir certificado')}</Link>}
          {gerir && <button type="button" className={`btn btn-xs ${aberta ? 'btn-dark' : 'btn-white'}`} onClick={alternar}>{aberta ? tx('Fechar') : 'TFC'}</button>}
        </td>
      </tr>
      {aberta && (
        <tr>
          <td colSpan={6} className="bg-light">
            <form className="row g-2 py-2" onSubmit={guardar}>
              <div className="col-12"><label className="form-label fw-bold" htmlFor={`tema-${l.estudante.id}`}>{tx('Tema')}</label><input id={`tema-${l.estudante.id}`} className="form-control" value={f.tema} onChange={(e) => setF({ ...f, tema: e.target.value })} required /></div>
              <div className="col-md-4"><label className="form-label fw-bold" htmlFor={`ori-${l.estudante.id}`}>{tx('Orientador')}</label><input id={`ori-${l.estudante.id}`} className="form-control" value={f.orientador} onChange={(e) => setF({ ...f, orientador: e.target.value })} /></div>
              <div className="col-md-5"><label className="form-label fw-bold" htmlFor={`juri-${l.estudante.id}`}>{tx('Júri')}</label><input id={`juri-${l.estudante.id}`} className="form-control" value={f.juri} onChange={(e) => setF({ ...f, juri: e.target.value })} placeholder={tx('Presidente; arguente; orientador')} /></div>
              <div className="col-md-2"><label className="form-label fw-bold" htmlFor={`def-${l.estudante.id}`}>{tx('Data da defesa')}</label><input id={`def-${l.estudante.id}`} type="date" className="form-control" value={f.dataDefesa} onChange={(e) => setF({ ...f, dataDefesa: e.target.value })} /></div>
              <div className="col-md-1"><label className="form-label fw-bold" htmlFor={`nota-${l.estudante.id}`}>{tx('Nota')}</label><input id={`nota-${l.estudante.id}`} className="form-control" inputMode="decimal" value={f.nota} onChange={(e) => setF({ ...f, nota: e.target.value })} aria-label={tx('Nota do TFC de {0}', { 0: l.estudante.nome })} /></div>
              <div className="col-12"><input className="form-control" value={f.observacao} onChange={(e) => setF({ ...f, observacao: e.target.value })} placeholder={tx('Observação (opcional)')} aria-label={tx('Observação')} /></div>
              <div className="col-12"><button type="submit" className="btn btn-theme" disabled={aGuardar}>{aGuardar ? tx('A guardar…') : tx('Guardar trabalho de fim de curso')}</button></div>
            </form>
          </td>
        </tr>
      )}
    </>
  )
}

export default Finalistas
