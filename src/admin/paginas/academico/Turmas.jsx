import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useSessao } from '../../sessaoContexto'
import { Aviso, CabecalhoPagina, Carregando, Erro, Painel } from '../../componentes/Ui'
import { t as tx } from '../../../i18n/linguas'

const anoAtual = () => {
  const d = new Date()
  const a = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1
  return `${a}/${a + 1}`
}

// a duração do curso em meses (do texto da ficha do curso: «10 meses», «2 anos»); sem ela, null
const mesesDe = (curso) => {
  const t = String(curso?.duracao ?? '').toLowerCase()
  const m = /(\d+)\s*m[eê]s/.exec(t)
  if (m) return Number(m[1])
  const a = /(\d+)\s*ano/.exec(t)
  return a ? Number(a[1]) * 12 : null
}

/*
  Turmas, agrupadas por curso: um curso (ex.: Curso Superior de Comando e Direcção, 10 meses) pode ter várias turmas
  em cada ano lectivo (ex.: 32.º CSCD — Turma A e Turma B). A partir da turma faz-se a matrícula e atribuem-se as
  cadeiras. O «ano curricular» só conta nos cursos com mais de 12 meses (os da Escola duram 10 meses).
*/
function Turmas() {
  const { pode } = useSessao()
  const [lista, setLista] = useState(null)
  const [cursos, setCursos] = useState([])
  const [anos, setAnos] = useState([])
  const [erro, setErro] = useState('')
  const [f, setF] = useState({ curso: '', anoLetivo: anoAtual(), anoCurricular: '1', nome: '' })
  const [erroForm, setErroForm] = useState('')
  const [aviso, setAviso] = useState(null)

  const carregar = useCallback(() => api('/academico/turmas').then(setLista).catch((e) => setErro(e.message)), [])
  useEffect(() => {
    carregar()
    api('/colecoes/cursos').then((c) => { setCursos(c); setF((x) => ({ ...x, curso: x.curso || c[0]?.id || '' })) }).catch(() => {})
    // o ano letivo escolhe-se dos configurados (o atual por omissão)
    api('/academico/anos-letivos').then((l) => { setAnos(l); const atual = l.find((a) => a.atual); if (atual) setF((x) => ({ ...x, anoLetivo: atual.id })) }).catch(() => {})
  }, [carregar])

  const cursoDe = (id) => cursos.find((c) => c.id === id)
  const variosAnos = (id) => (mesesDe(cursoDe(id)) ?? 0) > 12
  // os cursos (mesmo os que ainda não têm turmas) com as suas turmas; as turmas de um curso que já não existe no fim
  const grupos = [
    ...cursos.map((c) => [c, (lista ?? []).filter((t) => t.curso === c.id)]),
    ...[...new Set((lista ?? []).map((t) => t.curso).filter((id) => !cursoDe(id)))].map((id) => [{ id, nome: id }, (lista ?? []).filter((t) => t.curso === id)]),
  ]
  const novaNoCurso = (id) => { setF((x) => ({ ...x, curso: id, anoCurricular: '1' })); document.getElementById('t-nome')?.focus() }

  async function criar(e) {
    e.preventDefault()
    setErroForm('')
    try {
      await api('/academico/turmas', { metodo: 'POST', corpo: { ...f, anoCurricular: variosAnos(f.curso) ? f.anoCurricular : '1' } })
      setF({ ...f, nome: '' })
      setAviso({ texto: tx('Turma criada.') })
      carregar()
    } catch (falha) {
      setErroForm(falha.message)
    }
  }

  return (
    <>
      <CabecalhoPagina titulo={tx('Turmas')} subtitulo={tx('matrículas, cadeiras e horários')} migalhas={[{ rotulo: tx('Administração Escolar') }, { rotulo: tx('Turmas') }]} />
      <div className="row">
        <div className={pode('academico.gerir') ? 'col-xl-8' : 'col-12'}>
          {erro && <Erro texto={erro} onRepetir={carregar} />}
          {!lista && !erro && <Carregando />}
          {lista && grupos.length === 0 && <Painel titulo={tx('Turmas')}><p className="text-muted mb-0">{tx('Ainda não há cursos nem turmas.')}</p></Painel>}
          {lista && grupos.map(([c, turmas]) => {
            const meses = mesesDe(c)
            return (
              <Painel
                key={c.id}
                titulo={<>{c.nome}{c.sigla ? <span className="fw-normal ms-1 opacity-75">({c.sigla})</span> : null}</>}
                corpo={false}
                acoes={(
                  <span className="d-flex align-items-center gap-2 small">
                    {meses && <span className="badge bg-light text-dark"><i className="fa fa-clock me-1" />{meses} {tx('meses')}</span>}
                    <span className="badge bg-secondary">{tx('{0} turma(s)', { 0: turmas.length })}</span>
                    {turmas.length > 0 && <Link to={`/academico/documentos/curso/${encodeURIComponent(c.id)}/lista?ano=${encodeURIComponent(f.anoLetivo)}`} className="btn btn-xs perfil-botao-contorno"><i className="fa fa-list-ol me-1" />{tx('Lista do curso')}</Link>}
                    {pode('academico.gerir') && <button type="button" className="btn btn-xs perfil-botao-claro" onClick={() => novaNoCurso(c.id)}><i className="fa fa-plus me-1" />{tx('Nova turma neste curso')}</button>}
                  </span>
                )}
              >
                {turmas.length === 0 ? <div className="text-muted small p-3">{tx('Ainda sem turmas neste curso.')}</div> : (
                  <div className="table-responsive">
                    <table className="table table-striped align-middle mb-0">
                      <thead><tr><th>{tx('Turma')}</th><th>{tx('Ano lectivo')}</th>{variosAnos(c.id) && <th>{tx('Ano curricular')}</th>}<th className="text-end">{tx('Estudantes')}</th><th className="text-end">{tx('Cadeiras')}</th><th /></tr></thead>
                      <tbody>
                        {turmas.map((t) => (
                          <tr key={t.id}>
                            <td className="fw-bold">{t.nome} {!t.ativa && <span className="badge bg-secondary ms-1">{tx('Inactiva')}</span>}</td>
                            <td>{t.anoLetivo}</td>
                            {variosAnos(c.id) && <td>{t.anoCurricular}{tx('.º ano')}</td>}
                            <td className="text-end">{t.estudantes}</td>
                            <td className="text-end">{t.cadeiras}</td>
                            <td className="text-end"><Link to={`/academico/turmas/${t.id}`} className="btn btn-sm btn-primary">{tx('Abrir')}</Link></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Painel>
            )
          })}
        </div>
        {pode('academico.gerir') && (
          <div className="col-xl-4">
            <Painel titulo={tx('Nova turma')}>
              <form onSubmit={criar}>
                {erroForm && <div className="alert alert-danger py-2">{erroForm}</div>}
                <label className="form-label fw-bold" htmlFor="t-curso">{tx('Curso')}</label>
                <select id="t-curso" className="form-select mb-3" value={f.curso} onChange={(e) => setF({ ...f, curso: e.target.value })} required>
                  {cursos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
                <label className="form-label fw-bold" htmlFor="t-ano">{tx('Ano lectivo')}</label>
                {anos.length ? (
                  <select id="t-ano" className="form-select mb-1" value={f.anoLetivo} onChange={(e) => setF({ ...f, anoLetivo: e.target.value })} required>
                    {!anos.some((a) => a.id === f.anoLetivo) && <option value="">—</option>}
                    {anos.map((a) => <option key={a.id} value={a.id}>{a.id}{a.atual ? ` (${tx('atual')})` : ''}</option>)}
                  </select>
                ) : <input id="t-ano" className="form-control mb-1" value={f.anoLetivo} onChange={(e) => setF({ ...f, anoLetivo: e.target.value })} placeholder="2026/2027" required />}
                <div className="form-text mb-3"><Link to="/academico/anos-letivos">{tx('Configurar anos lectivos e semestres')}</Link></div>
                {mesesDe(cursoDe(f.curso)) && <div className="form-text mb-3"><i className="fa fa-clock me-1" />{tx('Duração do curso')}: {mesesDe(cursoDe(f.curso))} {tx('meses')}</div>}
                {/* só nos cursos com mais de 12 meses (os da Escola duram 10 meses) */}
                {variosAnos(f.curso) && (
                  <>
                    <label className="form-label fw-bold" htmlFor="t-anocur">{tx('Ano curricular')}</label>
                    <select id="t-anocur" className="form-select mb-3" value={f.anoCurricular} onChange={(e) => setF({ ...f, anoCurricular: e.target.value })}>
                      {Array.from({ length: Math.min(6, Math.ceil((mesesDe(cursoDe(f.curso)) ?? 12) / 12)) }, (_, k) => k + 1).map((n) => <option key={n} value={n}>{n}{tx('.º ano')}</option>)}
                    </select>
                  </>
                )}
                <label className="form-label fw-bold" htmlFor="t-nome">{tx('Nome da turma')}</label>
                <input id="t-nome" className="form-control mb-3" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder={tx('Ex.: 32.º CSCD — Turma A')} required />
                <div className="form-text mb-3 mt-n2">{tx('Um curso pode ter várias turmas no mesmo ano lectivo (Turma A, Turma B…).')}</div>
                <button type="submit" className="btn btn-theme w-100"><i className="fa fa-plus me-1" /> {tx('Criar turma')}</button>
              </form>
            </Painel>
          </div>
        )}
      </div>
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

export default Turmas
