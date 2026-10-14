import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../../api'
import { Carregando, Erro } from '../../../componentes/Ui'
import Documento from './Documento'
import { decimal, descarregarCsv, valor } from './csv'

const SITUACAO_ANO = { transita: 'Transita', com_cadeiras_em_atraso: 'Com cadeiras em atraso', em_curso: 'Em curso' }
const ABREV = { aprovado: 'Apr.', dispensado: 'Disp.', reprovado: 'Rep.', exame: 'Exame', recurso: 'Rec.', em_curso: '—' }

// pauta da turma: estudantes × cadeiras (nota final e situação), média e situação no ano
function PautaTurma() {
  const { id } = useParams()
  const [d, setD] = useState(null)
  const [erro, setErro] = useState('')
  useEffect(() => { api(`/academico/turmas/${id}/pauta-geral`).then(setD).catch((e) => setErro(e.message)) }, [id])
  if (erro) return <Erro texto={erro} />
  if (!d) return <Carregando />

  function exportar() {
    descarregarCsv(`pauta-${d.turma.nome}`, [
      [`Pauta da turma ${d.turma.nome} — ${d.turma.curso} — ${d.turma.anoLetivo}`], [],
      ['N.º', 'Estudante', 'Número', ...d.cadeiras.map((c) => c.codigo), 'Média', 'Aprovadas', 'Situação'],
      ...d.linhas.map((l, i) => [i + 1, l.estudante.nome, l.estudante.numero, ...d.cadeiras.map((c) => decimal(l.notas[c.id]?.final)), decimal(l.media), `${l.aprovadas}/${l.total}`, SITUACAO_ANO[l.situacaoAno]]),
    ])
  }

  return (
    <Documento
      titulo="Pauta da turma" paisagem voltar={`/academico/turmas/${d.turma.id}`}
      subtitulo={`${d.turma.curso} · ${d.turma.nome} · ${d.turma.anoCurricular}.º ano · ano letivo ${d.turma.anoLetivo}`}
      acoes={<button type="button" className="btn btn-white" onClick={exportar}><i className="fa fa-file-excel me-1 text-success" />Exportar Excel</button>}
      assinaturas={['O Chefe da Repartição de Administração Escolar', 'O Diretor Pedagógico']}
    >
      <table>
        <thead>
          <tr>
            <th className="of-num">N.º</th><th>Estudante</th>
            {d.cadeiras.map((c) => <th key={c.id} className="of-centro" title={c.nome}>{c.codigo}</th>)}
            <th className="of-centro">Média</th><th className="of-centro">Aprov.</th><th>Situação</th>
          </tr>
        </thead>
        <tbody>
          {d.linhas.map((l, i) => (
            <tr key={l.estudante.id}>
              <td className="of-num">{i + 1}</td>
              <td>{l.estudante.nome}<div className="small text-muted">{l.estudante.numero}</div></td>
              {d.cadeiras.map((c) => {
                const n = l.notas[c.id]
                return <td key={c.id} className="of-centro">{n?.final !== null && n?.final !== undefined ? <b>{n.final}</b> : '—'}<div className="small">{ABREV[n?.situacao || 'em_curso']}</div></td>
              })}
              <td className="of-centro"><b>{valor(l.media)}</b></td>
              <td className="of-centro">{l.aprovadas}/{l.total}</td>
              <td>{SITUACAO_ANO[l.situacaoAno]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="small mt-2">{d.cadeiras.map((c) => `${c.codigo}: ${c.nome}`).join(' · ')}</div>
    </Documento>
  )
}

export default PautaTurma
