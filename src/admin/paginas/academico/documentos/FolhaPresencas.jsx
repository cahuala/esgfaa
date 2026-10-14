import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../../api'
import { Carregando, Erro } from '../../../componentes/Ui'
import Documento from './Documento'
import { dataPt, descarregarCsv } from './csv'

const MARCA = { presente: 'P', falta: 'F', justificada: 'J' }

/*
  Folha de presenças de uma cadeira: as aulas registadas (P/F/J) e, se se quiser,
  colunas em branco para as próximas aulas (folha para preencher à mão).
*/
function FolhaPresencas() {
  const { id } = useParams()
  const [d, setD] = useState(null)
  const [erro, setErro] = useState('')
  const [branco, setBranco] = useState(0)
  const [soBranco, setSoBranco] = useState(false)
  useEffect(() => { api(`/academico/cadeiras/${id}/folha-presencas`).then((r) => { setD(r); if (!r.aulas.length) setBranco(10) }).catch((e) => setErro(e.message)) }, [id])
  if (erro) return <Erro texto={erro} />
  if (!d) return <Carregando />

  const aulas = soBranco ? [] : d.aulas
  const vazias = Array.from({ length: Number(branco) || 0 })
  const estado = (a, e) => MARCA[a.presencas?.[e.id]] || ''
  const faltas = (e) => d.aulas.filter((a) => estado(a, e) === 'F').length

  function exportar() {
    descarregarCsv(`presencas-${d.cadeira.codigo}`, [
      [`Presenças — ${d.cadeira.codigo} ${d.cadeira.nome} — ${d.turma.nome}`], [],
      ['N.º', 'Estudante', 'Número', ...d.aulas.map((a) => dataPt(a.data)), 'Faltas'],
      ...d.estudantes.map((e, i) => [i + 1, e.nome, e.numero, ...d.aulas.map((a) => estado(a, e)), faltas(e)]),
    ])
  }

  return (
    <Documento
      titulo="Folha de presenças" paisagem voltar={`/academico/cadeiras/${d.cadeira.id}`}
      subtitulo={`${d.cadeira.codigo} — ${d.cadeira.nome} · ${d.turma.curso} · ${d.turma.nome} · ano letivo ${d.turma.anoLetivo}`}
      acoes={(
        <>
          <label className="d-flex align-items-center gap-1 small mb-0">Colunas em branco <input type="number" min={0} max={30} value={branco} onChange={(e) => setBranco(e.target.value)} className="form-control form-control-sm" style={{ width: 70 }} /></label>
          <label className="d-flex align-items-center gap-1 small mb-0"><input type="checkbox" checked={soBranco} onChange={(e) => setSoBranco(e.target.checked)} /> Só em branco</label>
          <button type="button" className="btn btn-white" onClick={exportar}><i className="fa fa-file-excel me-1 text-success" />Exportar Excel</button>
        </>
      )}
      assinaturas={['O Docente', 'O Chefe da Repartição de Administração Escolar']}
    >
      <table>
        <thead>
          <tr>
            <th className="of-num">N.º</th><th>Estudante</th>
            {aulas.map((a) => <th key={a.id} className="of-centro">{dataPt(a.data).slice(0, 5)}</th>)}
            {vazias.map((_, i) => <th key={`v${i}`} style={{ minWidth: 34 }}>&nbsp;</th>)}
            {!soBranco && <th className="of-centro">Faltas</th>}
          </tr>
        </thead>
        <tbody>
          {d.estudantes.map((e, i) => (
            <tr key={e.id}>
              <td className="of-num">{i + 1}</td>
              <td>{e.nome}{e.inscrito && ' *'}</td>
              {aulas.map((a) => <td key={a.id} className="of-centro">{estado(a, e)}</td>)}
              {vazias.map((_, k) => <td key={`v${k}`} />)}
              {!soBranco && <td className="of-centro">{faltas(e)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="small">P = presente · F = falta · J = falta justificada{d.estudantes.some((e) => e.inscrito) && ' · * inscrito fora da turma'}</div>
    </Documento>
  )
}

export default FolhaPresencas
