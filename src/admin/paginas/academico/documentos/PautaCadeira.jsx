import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../../api'
import { Carregando, Erro } from '../../../componentes/Ui'
import { NOMES_COMPONENTES, SITUACOES } from '../../../../portal/regraAvaliacao'
import { exportarPautaExcel } from '../../../../portal/exportarPauta'
import Documento from './Documento'
import { valor } from './csv'

const PERIODOS = { 1: '1.º semestre', 2: '2.º semestre', anual: 'Anual' }

// pauta oficial de uma cadeira (provas, MAC, exame, recurso, nota final, situação e classificação)
function PautaCadeira() {
  const { id } = useParams()
  const [p, setP] = useState(null)
  const [erro, setErro] = useState('')
  useEffect(() => { api(`/academico/cadeiras/${id}/pauta`).then(setP).catch((e) => setErro(e.message)) }, [id])
  if (erro) return <Erro texto={erro} />
  if (!p) return <Carregando />
  const c = p.cadeira
  const regente = c.docentes?.find((d) => d.papel === 'regente')?.nome
  return (
    <Documento
      titulo="Pauta" paisagem voltar={`/academico/cadeiras/${c.id}?separador=pauta`}
      subtitulo={`${c.codigo} — ${c.nome} · ${c.turma?.nome || ''} · ${PERIODOS[c.periodo] || ''} · ano letivo ${c.turma?.anoLetivo || ''}`}
      acoes={<button type="button" className="btn btn-white" onClick={() => exportarPautaExcel(c, p.linhas)}><i className="fa fa-file-excel me-1 text-success" />Exportar Excel</button>}
      assinaturas={[`O Regente${regente ? ` (${regente})` : ''}`, 'O Chefe da Repartição de Administração Escolar']}
    >
      <table>
        <thead>
          <tr>
            <th className="of-num">N.º</th><th>Estudante</th><th>Número</th>
            <th className="of-centro">{NOMES_COMPONENTES.p1}</th><th className="of-centro">{NOMES_COMPONENTES.p2}</th><th className="of-centro">MAC</th>
            <th className="of-centro">{NOMES_COMPONENTES.exame}</th><th className="of-centro">{NOMES_COMPONENTES.recurso}</th>
            <th className="of-centro">Nota final</th><th>Situação</th><th>Classificação</th>
          </tr>
        </thead>
        <tbody>
          {p.linhas.map((l, i) => (
            <tr key={l.estudante.id}>
              <td className="of-num">{i + 1}</td><td>{l.estudante.nome}{l.estudante.inscrito && ' *'}</td><td>{l.estudante.numero}</td>
              <td className="of-centro">{valor(l.p1)}</td><td className="of-centro">{valor(l.p2)}</td><td className="of-centro">{valor(l.mac)}</td>
              <td className="of-centro">{valor(l.exame)}</td><td className="of-centro">{valor(l.recurso)}</td>
              <td className="of-centro"><b>{l.situacao === 'recurso' ? '—' : valor(l.final)}</b></td>
              <td>{SITUACOES[l.situacao]?.texto}</td><td>{l.situacao === 'reprovado' ? '' : l.classificacao || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {p.linhas.some((l) => l.estudante.inscrito) && <div className="small">* Estudante inscrito na cadeira fora da sua turma.</div>}
    </Documento>
  )
}

export default PautaCadeira
