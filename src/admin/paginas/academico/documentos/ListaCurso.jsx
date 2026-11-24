import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { api } from '../../../api'
import { Carregando, Erro } from '../../../componentes/Ui'
import Documento from './Documento'
import { descarregarCsv } from './csv'

/*
  Lista do curso: os estudantes de todas as turmas de um curso num ano lectivo, com a turma de cada um, pela ordem
  hierárquica (posto e, no mesmo posto, ordem alfabética; os civis no fim). A ordem vem do servidor.
*/
function ListaCurso() {
  const { curso } = useParams()
  const [params, setParams] = useSearchParams()
  const ano = params.get('ano') ?? ''
  const [d, setD] = useState(null)
  const [anos, setAnos] = useState([])
  const [erro, setErro] = useState('')
  useEffect(() => { api('/academico/anos-letivos').then(setAnos).catch(() => {}) }, [])
  useEffect(() => {
    api(`/academico/cursos/${encodeURIComponent(curso)}/lista${ano ? `?anoLetivo=${encodeURIComponent(ano)}` : ''}`).then(setD).catch((e) => setErro(e.message))
  }, [curso, ano])
  if (erro) return <Erro texto={erro} />
  if (!d) return <Carregando />
  const titulo = `Relação nominal do ${d.curso.nome}${d.curso.sigla ? ` (${d.curso.sigla})` : ''}`
  function exportar() {
    descarregarCsv(`lista-${d.curso.sigla || d.curso.id}-${ano || 'todos'}`, [
      [`${titulo}${ano ? ` — ano lectivo ${ano}` : ''}`], [],
      ['N.º', 'Posto', 'Nome completo', 'N.º de estudante', 'Turma'],
      ...d.estudantes.map((e, i) => [i + 1, e.posto, e.nome, e.numero, e.turma]),
    ])
  }
  return (
    <Documento
      titulo={titulo} voltar="/academico/turmas"
      subtitulo={[ano ? `ano lectivo ${ano}` : 'todos os anos lectivos', d.curso.duracao, `${d.turmas.length} turma(s)`, `${d.estudantes.length} estudante(s)`].filter(Boolean).join(' · ')}
      acoes={(
        <>
          <select className="form-select" style={{ width: 220 }} value={ano} onChange={(e) => setParams(e.target.value ? { ano: e.target.value } : {})} aria-label="Ano lectivo">
            <option value="">Todos os anos lectivos</option>
            {anos.map((a) => <option key={a.id} value={a.id}>{a.id}{a.atual ? ' (actual)' : ''}</option>)}
          </select>
          <button type="button" className="btn btn-white" onClick={exportar}><i className="fa fa-file-excel me-1 text-success" />Exportar Excel</button>
        </>
      )}
      assinaturas={[...(d.director ? [{ cargo: 'O Director do Curso', nome: d.director.nome }] : []), 'O Chefe da Repartição de Administração Escolar', 'O Director de Ensino']}
    >
      <table>
        <thead><tr><th className="of-num">N.º</th><th>Posto</th><th>Nome completo</th><th>N.º de estudante</th><th>Turma</th></tr></thead>
        <tbody>
          {d.estudantes.length === 0 && <tr><td colSpan={5} className="of-centro">Sem estudantes matriculados.</td></tr>}
          {d.estudantes.map((e, i) => (
            <tr key={`${e.id}-${e.turmaId}`}>
              <td className="of-num">{String(i + 1).padStart(2, '0')}</td>
              <td>{e.posto || '—'}</td>
              <td>{e.nome}</td>
              <td>{e.numero}</td>
              <td>{e.turma}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="small mt-2">Ordem hierárquica: por posto (do mais alto para o mais baixo) e, dentro do mesmo posto, por ordem alfabética.</div>
    </Documento>
  )
}

export default ListaCurso
