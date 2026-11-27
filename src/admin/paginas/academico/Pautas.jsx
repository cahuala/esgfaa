import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { CabecalhoPagina, Carregando, Erro, Painel } from '../../componentes/Ui'
import { useAnoTrabalho } from '../../anoTrabalho'
import { t as tx } from '../../../i18n/linguas'

/*
  As pautas do ano lectivo (o do menu), por curso: cada turma com a pauta da turma e a pauta final do curso e, ao
  abrir, as cadeiras com a pauta de cada uma (o departamento e os docentes ao lado).
*/
function Cadeiras({ turmaId }) {
  const [t, setT] = useState(null)
  const [erro, setErro] = useState('')
  useEffect(() => { api(`/academico/turmas/${turmaId}`).then(setT).catch((e) => setErro(e.message)) }, [turmaId])
  if (erro) return <div className="text-danger small p-2">{erro}</div>
  if (!t) return <div className="p-2"><Carregando /></div>
  if (!t.cadeiras.length) return <div className="text-muted small p-3">{tx('Esta turma ainda não tem cadeiras.')}</div>
  return (
    <div className="table-responsive">
      <table className="table table-sm align-middle mb-0">
        <thead><tr><th>{tx('Cadeira')}</th><th>{tx('Departamento')}</th><th>{tx('Docentes')}</th><th /></tr></thead>
        <tbody>
          {t.cadeiras.map((c) => (
            <tr key={c.id}>
              <td><b>{c.codigo}</b> — {c.nome}</td>
              <td className="small">{c.departamento || <span className="text-muted">—</span>}</td>
              <td className="small">{(c.docentes ?? []).map((d) => d.nome).join(', ') || <span className="text-muted">{tx('por alocar')}</span>}</td>
              <td className="text-end text-nowrap">
                <Link to={`/academico/documentos/cadeira/${c.id}/pauta`} className="btn btn-xs btn-theme me-1"><i className="fa fa-table me-1" />{tx('Pauta da cadeira')}</Link>
                <Link to={`/academico/cadeiras/${c.id}`} className="btn btn-xs btn-white"><i className="fa fa-pen me-1" />{tx('Notas')}</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Pautas() {
  const { ano } = useAnoTrabalho()
  const [turmas, setTurmas] = useState(null)
  const [cursos, setCursos] = useState([])
  const [aberta, setAberta] = useState(null)
  const [erro, setErro] = useState('')
  useEffect(() => {
    api('/academico/turmas').then(setTurmas).catch((e) => setErro(e.message))
    api('/colecoes/cursos').then(setCursos).catch(() => {})
  }, [])
  if (erro) return <Erro texto={erro} />
  if (!turmas) return <Carregando />
  const doAno = turmas.filter((t) => !ano || t.anoLetivo === ano)
  const nomeCurso = (id) => cursos.find((c) => c.id === id)?.nome ?? id
  const porCurso = [...new Set(doAno.map((t) => t.curso))].map((c) => [c, doAno.filter((t) => t.curso === c)]).sort((a, b) => nomeCurso(a[0]).localeCompare(nomeCurso(b[0])))
  return (
    <>
      <CabecalhoPagina titulo={tx('Pautas')} subtitulo={tx('ano lectivo {0} — por curso, turma e cadeira (o ano muda-se no menu)', { 0: ano })} migalhas={[{ rotulo: tx('Administração Escolar') }, { rotulo: tx('Pautas') }]} />
      {porCurso.length === 0 && <Painel titulo={tx('Pautas')}><p className="text-muted mb-0">{tx('Não há turmas no ano lectivo {0}. Escolha outro ano no menu.', { 0: ano })}</p></Painel>}
      {porCurso.map(([curso, ts]) => (
        <Painel key={curso} titulo={nomeCurso(curso)} corpo={false}>
          {ts.map((t) => (
            <div key={t.id} className="border-bottom">
              <div className="d-flex flex-wrap align-items-center gap-2 px-3 py-2">
                <b className="me-auto">{t.nome} <span className="fw-normal text-muted small">· {t.estudantes} {tx('estudante(s)')} · {t.cadeiras} {tx('cadeira(s)')}</span></b>
                <Link to={`/academico/documentos/turma/${t.id}/pauta`} className="btn btn-sm btn-white"><i className="fa fa-table me-1" />{tx('Pauta da turma')}</Link>
                <Link to={`/academico/turmas/${t.id}/pauta-final`} className="btn btn-sm btn-white"><i className="fa fa-file-alt me-1" />{tx('Pauta final do curso')}</Link>
                <button type="button" className={`btn btn-sm ${aberta === t.id ? 'btn-dark' : 'btn-theme'}`} onClick={() => setAberta(aberta === t.id ? null : t.id)} aria-expanded={aberta === t.id}>
                  <i className={`fa ${aberta === t.id ? 'fa-chevron-up' : 'fa-chevron-down'} me-1`} />{tx('Pautas das cadeiras')}
                </button>
              </div>
              {aberta === t.id && <div className="bg-light border-top"><Cadeiras turmaId={t.id} /></div>}
            </div>
          ))}
        </Painel>
      ))}
    </>
  )
}

export default Pautas
