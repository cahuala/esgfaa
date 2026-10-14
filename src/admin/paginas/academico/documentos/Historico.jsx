import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../../api'
import { Carregando, Erro } from '../../../componentes/Ui'
import { SITUACOES } from '../../../../portal/regraAvaliacao'
import Documento from './Documento'
import { dataPt, decimal, descarregarCsv, valor } from './csv'

const PERIODOS = { 1: '1.º sem.', 2: '2.º sem.', anual: 'Anual' }

// histórico académico do estudante: todos os anos, as cadeiras e notas, as inscrições avulsas e o TFC
function Historico() {
  const { id } = useParams()
  const [h, setH] = useState(null)
  const [erro, setErro] = useState('')
  useEffect(() => { api(`/academico/estudantes/${id}/historico`).then(setH).catch((e) => setErro(e.message)) }, [id])
  if (erro) return <Erro texto={erro} />
  if (!h) return <Carregando />
  const e = h.estudante

  const tabela = (linhas) => (
    <table>
      <thead><tr><th>Código</th><th>Unidade curricular</th><th className="of-centro">Período</th><th className="of-centro">Horas</th><th className="of-centro">Nota final</th><th>Situação</th><th>Classificação</th></tr></thead>
      <tbody>
        {linhas.map((l) => (
          <tr key={l.cadeira.id}>
            <td>{l.cadeira.codigo}</td><td>{l.cadeira.nome}</td><td className="of-centro">{PERIODOS[l.cadeira.periodo] || ''}</td><td className="of-centro">{l.cadeira.horas || ''}</td>
            <td className="of-centro"><b>{l.situacao === 'recurso' ? '—' : valor(l.final)}</b></td><td>{SITUACOES[l.situacao]?.texto}</td><td>{l.situacao === 'reprovado' ? '' : l.classificacao || ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )

  function exportar() {
    const linhas = [...h.anos.flatMap((a) => a.disciplinas.map((d) => [a.turma.anoLetivo, a.turma.nome, d.cadeira.codigo, d.cadeira.nome, d.cadeira.horas, decimal(d.final), SITUACOES[d.situacao]?.texto])),
      ...h.inscricoes.map((d) => [d.cadeira.anoLetivo, `${d.cadeira.turma} (inscrição)`, d.cadeira.codigo, d.cadeira.nome, d.cadeira.horas, decimal(d.final), SITUACOES[d.situacao]?.texto])]
    descarregarCsv(`historico-${e.numero}`, [[`Histórico académico — ${e.nome} (${e.numero})`], [], ['Ano letivo', 'Turma', 'Código', 'Unidade curricular', 'Horas', 'Nota final', 'Situação'], ...linhas])
  }

  return (
    <Documento
      titulo="Histórico académico" voltar={h.anos.length ? `/academico/turmas/${h.anos[h.anos.length - 1].turma.id}` : '/academico/contas'}
      acoes={<button type="button" className="btn btn-white" onClick={exportar}><i className="fa fa-file-excel me-1 text-success" />Exportar Excel</button>}
      assinaturas={['O Chefe da Repartição de Administração Escolar', 'O Diretor da Escola']}
    >
      <div className="of-campos">
        <div><b>Nome:</b> {e.nome}</div>
        <div><b>N.º de estudante:</b> {e.numero}</div>
        {e.dados?.posto && <div><b>Posto:</b> {e.dados.posto}</div>}
        {e.dados?.nip && <div><b>NIP:</b> {e.dados.nip}</div>}
        <div><b>Curso:</b> {h.cursos.join(', ') || '—'}</div>
      </div>
      {h.anos.map((a) => (
        <section key={a.matricula.id}>
          <h2 className="h6 fw-bold mt-3 mb-1">{a.turma.anoCurricular}.º ano · {a.turma.nome} · ano letivo {a.turma.anoLetivo}{a.matricula.estado !== 'ativa' && a.matricula.estado !== 'concluida' ? ` (${a.matricula.estado})` : ''}</h2>
          {a.disciplinas.length ? tabela(a.disciplinas) : <div className="small">Sem unidades curriculares.</div>}
          <div className="small">Aprovadas {a.resumo.aprovadas} de {a.resumo.disciplinas} · {a.resumo.horasAprovadas} horas{a.resumo.media !== null ? ` · média ${valor(a.resumo.media)}` : ''}</div>
        </section>
      ))}
      {h.inscricoes.length > 0 && (<><h2 className="h6 fw-bold mt-3 mb-1">Unidades curriculares frequentadas por inscrição</h2>{tabela(h.inscricoes)}</>)}
      <h2 className="h6 fw-bold mt-3 mb-1">Trabalho de fim de curso</h2>
      {h.tfc ? (
        <div className="of-campos">
          <div style={{ gridColumn: '1 / -1' }}><b>Tema:</b> {h.tfc.tema}</div>
          {h.tfc.orientador && <div><b>Orientador:</b> {h.tfc.orientador}</div>}
          {h.tfc.dataDefesa && <div><b>Defesa:</b> {dataPt(h.tfc.dataDefesa)}</div>}
          <div><b>Classificação:</b> {h.tfc.nota !== null ? `${valor(h.tfc.nota)} valores (${h.tfc.classificacao})` : 'por defender'}</div>
        </div>
      ) : <div className="small">Ainda não lançado.</div>}
      <h2 className="h6 fw-bold mt-3 mb-1">Resumo</h2>
      <div className="of-campos">
        <div><b>Unidades curriculares aprovadas:</b> {h.resumo.aprovadas} de {h.resumo.disciplinas}</div>
        <div><b>Horas aprovadas:</b> {h.resumo.horasAprovadas}</div>
        <div><b>Média das unidades curriculares:</b> {valor(h.resumo.media)}</div>
        <div><b>Situação:</b> {h.conclusao.concluido ? `Curso concluído com ${valor(h.conclusao.mediaFinal)} valores (${h.conclusao.classificacaoFinal})` : 'Curso por concluir'}</div>
      </div>
    </Documento>
  )
}

export default Historico
