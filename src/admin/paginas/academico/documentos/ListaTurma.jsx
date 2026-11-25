import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../../api'
import { Carregando, Erro } from '../../../componentes/Ui'
import Documento from './Documento'
import { descarregarCsv } from './csv'

/*
  Relação nominal da turma: os estudantes com matrícula activa, pela ordem hierárquica (posto, do mais alto para o mais
  baixo, e, no mesmo posto, por ordem alfabética; os civis no fim). A ordem vem do servidor.
*/
function ListaTurma() {
  const { id } = useParams()
  const [t, setT] = useState(null)
  const [erro, setErro] = useState('')
  useEffect(() => { api(`/academico/turmas/${id}`).then(setT).catch((e) => setErro(e.message)) }, [id])
  if (erro) return <Erro texto={erro} />
  if (!t) return <Carregando />
  const pessoas = t.termos?.pessoas ?? 'Estudantes'
  const linhas = t.matriculas.filter((m) => m.estado === 'ativa').map((m) => m.estudante)
  const dado = (e, k) => e.dados?.[k] ?? ''
  function exportar() {
    descarregarCsv(`lista-${t.nome}`, [
      [`Relação nominal dos ${pessoas.toLowerCase()} — ${t.nome} — ano lectivo ${t.anoLetivo}`], [],
      ['N.º', 'Posto', 'Nome completo', 'N.º de estudante', 'Ramo', 'Unidade de origem'],
      ...linhas.map((e, i) => [i + 1, dado(e, 'posto'), e.nome, e.numero, dado(e, 'ramo'), dado(e, 'departamento')]),
    ])
  }
  return (
    <Documento
      anoLetivo={t.anoLetivo}
      titulo={`Relação nominal dos ${pessoas.toLowerCase()}`} voltar={`/academico/turmas/${t.id}`}
      subtitulo={`${t.nome} · ano lectivo ${t.anoLetivo} · ${linhas.length} ${pessoas.toLowerCase()}`}
      acoes={<button type="button" className="btn btn-white" onClick={exportar}><i className="fa fa-file-excel me-1 text-success" />Exportar Excel</button>}
      assinaturas={['O Chefe da Repartição de Administração Escolar']}
    >
      <table>
        <thead><tr><th className="of-num">N.º</th><th>Posto</th><th>Nome completo</th><th>N.º de estudante</th><th>Ramo</th><th>Unidade de origem</th></tr></thead>
        <tbody>
          {linhas.length === 0 && <tr><td colSpan={6} className="of-centro">Sem matrículas activas.</td></tr>}
          {linhas.map((e, i) => (
            <tr key={e.id}>
              <td className="of-num">{String(i + 1).padStart(2, '0')}</td>
              <td>{dado(e, 'posto') || '—'}</td>
              <td>{e.nome}</td>
              <td>{e.numero}</td>
              <td>{dado(e, 'ramo')}</td>
              <td>{dado(e, 'departamento')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="small mt-2">Ordem hierárquica: por posto (do mais alto para o mais baixo) e, dentro do mesmo posto, por ordem alfabética.</div>
    </Documento>
  )
}

export default ListaTurma
