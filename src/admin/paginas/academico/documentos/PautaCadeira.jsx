import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../../api'
import { Carregando, Erro } from '../../../componentes/Ui'
import { NOMES_COMPONENTES, SITUACOES } from '../../../../portal/regraAvaliacao'
import { exportarPautaExcel } from '../../../../portal/exportarPauta'
import Documento from './Documento'
import { valor } from './csv'

const PERIODOS = { 1: '1.º semestre', 2: '2.º semestre', anual: 'Anual' }

const RAMOS = { EXE: 'EXE', FAN: 'FAN', MGA: 'MGA', PNA: 'PNA' }
const fmt = (v) => (v === null || v === undefined || v === '' ? '' : Number(v).toLocaleString('pt-PT', { maximumFractionDigits: 2 }))
/*
  Pauta oficial de uma cadeira. Por omissão, como a do arquivo da Repartição de Administração Escolar (Nº, NIP,
  posto, nome completo, ramo, disciplina, nota; no fim a média, a nota mais alta e a mais baixa), com a carga horária
  da cadeira; a versão detalhada tem as provas, o MAC, o exame, o recurso, a situação e a classificação.
*/
function PautaCadeira() {
  const { id } = useParams()
  const [p, setP] = useState(null)
  const [erro, setErro] = useState('')
  const [detalhada, setDetalhada] = useState(false)
  useEffect(() => { api(`/academico/cadeiras/${id}/pauta`).then(setP).catch((e) => setErro(e.message)) }, [id])
  if (erro) return <Erro texto={erro} />
  if (!p) return <Carregando />
  const c = p.cadeira
  const regente = c.docentes?.find((d) => d.papel === 'regente')?.nome
  const notas = p.linhas.map((l) => (l.situacao === 'recurso' ? null : l.final)).filter((v) => v !== null && v !== undefined && v !== '').map(Number)
  const media = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null
  const horas = Number(c.horasContacto || 0) + Number(c.horasNaoContacto || 0) || Number(c.horas || 0)
  const acoes = <>
    <button type="button" className="btn btn-white" onClick={() => setDetalhada(!detalhada)}><i className="fa fa-columns me-1" />{detalhada ? 'Modelo do arquivo' : 'Pauta detalhada (provas e exame)'}</button>
    <button type="button" className="btn btn-white" onClick={() => exportarPautaExcel(c, p.linhas)}><i className="fa fa-file-excel me-1 text-success" />Exportar Excel</button>
  </>
  if (!detalhada) {
    return (
      <Documento
        anoLetivo={c.turma?.anoLetivo}
        titulo={`${c.nome}`} voltar={`/academico/cadeiras/${c.id}?separador=pauta`}
        subtitulo={<>{(c.turma?.nome || '').toUpperCase()}<br />Ano de curso {c.turma?.anoLetivo || ''} · {c.codigo}{horas ? ` · carga horária ${horas} h` : ''}{PERIODOS[c.periodo] ? ` · ${PERIODOS[c.periodo]}` : ''}</>}
        acoes={acoes}
        assinaturas={[`O Docente${regente ? ` — ${regente}` : ''}`, 'O Chefe da Repartição de Administração Escolar']}
      >
        <table>
          <thead><tr><th className="of-num">Nº</th><th>NIP</th><th>Posto</th><th>Nome completo</th><th className="of-centro">Ramo</th><th className="of-centro">Disciplina</th><th className="of-centro">Nota</th></tr></thead>
          <tbody>
            {p.linhas.map((l, i) => (
              <tr key={l.estudante.id}>
                <td className="of-num">{i + 1}</td><td>{l.estudante.nip || ''}</td><td>{l.estudante.posto || ''}</td><td>{l.estudante.nome}{l.estudante.inscrito && ' *'}</td>
                <td className="of-centro">{RAMOS[l.estudante.ramo] ?? l.estudante.ramo ?? ''}</td><td className="of-centro">{c.codigo}</td>
                <td className="of-centro"><b>{l.situacao === 'recurso' ? '—' : fmt(l.final)}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="mt-2" style={{ width: 'auto' }}>
          <tbody>
            <tr><th>Média</th><td className="of-centro">{media === null ? '—' : fmt(Math.round(media * 100) / 100)}</td></tr>
            <tr><th>Nota mais alta</th><td className="of-centro">{notas.length ? fmt(Math.max(...notas)) : '—'}</td></tr>
            <tr><th>Nota mais baixa</th><td className="of-centro">{notas.length ? fmt(Math.min(...notas)) : '—'}</td></tr>
          </tbody>
        </table>
        {p.linhas.some((l) => l.estudante.inscrito) && <div className="small">* Inscrito na cadeira fora da sua turma.</div>}
      </Documento>
    )
  }
  return (
    <Documento
      anoLetivo={c.turma?.anoLetivo}
      titulo="Pauta" paisagem voltar={`/academico/cadeiras/${c.id}?separador=pauta`}
      subtitulo={`${c.codigo} — ${c.nome} · ${c.turma?.nome || ''} · ${PERIODOS[c.periodo] || ''} · ano lectivo ${c.turma?.anoLetivo || ''}${horas ? ` · carga horária ${horas} h` : ''}`}
      acoes={acoes}
      assinaturas={[`O Docente${regente ? ` — ${regente}` : ''}`, 'O Chefe da Repartição de Administração Escolar']}
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
              <td className="of-num">{i + 1}</td><td>{l.estudante.posto ? `${l.estudante.posto} ` : ''}{l.estudante.nome}{l.estudante.inscrito && ' *'}</td><td>{l.estudante.numero}</td>
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
