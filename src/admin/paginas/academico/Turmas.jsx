import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { useSessao } from '../../sessaoContexto'
import { Aviso, CabecalhoPagina, Carregando, Erro, Painel } from '../../componentes/Ui'
import { t as tx } from '../../../i18n/linguas'
import { useAnoTrabalho } from '../../anoTrabalho'
import { DOCUMENTOS_ANO } from './documentos/tiposDocumentosAno'
import EscolherDocumento from './documentos/EscolherDocumento'

// sem anos lectivos configurados: o de agora (começa em Agosto)
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
  const navegar = useNavigate()
  const [lista, setLista] = useState(null)
  const [cursos, setCursos] = useState([])
  // o ano lectivo de trabalho (escolhido no menu): só as turmas desse ano; a turma nova é desse ano
  const { ano, anos, mudar } = useAnoTrabalho()
  const [erro, setErro] = useState('')
  const [f, setF] = useState({ curso: '', anoLetivo: anoAtual(), anoCurricular: '1', nome: '' })
  const [erroForm, setErroForm] = useState('')
  const [aviso, setAviso] = useState(null)
  const [escolherDoc, setEscolherDoc] = useState(false)

  const carregar = useCallback(() => api('/academico/turmas').then(setLista).catch((e) => setErro(e.message)), [])
  // o Director de cada curso (designado pela Administração Escolar entre as contas do painel que veem o Ensino)
  const [dirs, setDirs] = useState({ directores: {}, propostas: {}, recusas: {}, candidatos: [] })
  // a Administração Escolar propõe; vale quando o Comandante aprova (o próprio Comandante designa logo)
  const designar = (curso, valor) => api(`/academico/cursos/${encodeURIComponent(curso)}/director`, { metodo: 'PUT', corpo: { utilizadorId: valor ? Number(valor) : null } })
    .then((r) => { setDirs(r); setAviso({ texto: r.propostas?.[curso] ? tx('Proposto ao Comandante: fica Director do curso quando ele aprovar.') : valor ? tx('Director do curso designado.') : tx('Director do curso retirado.') }) })
    .catch((e) => setAviso({ tipo: 'erro', texto: e.message }))
  useEffect(() => {
    carregar()
    api('/academico/directores-curso').then(setDirs).catch(() => {})
    api('/colecoes/cursos').then((c) => { setCursos(c); setF((x) => ({ ...x, curso: x.curso || c[0]?.id || '' })) }).catch(() => {})
  }, [carregar])

  const cursoDe = (id) => cursos.find((c) => c.id === id)
  const variosAnos = (id) => (mesesDe(cursoDe(id)) ?? 0) > 12
  // os cursos (mesmo os que ainda não têm turmas) com as suas turmas; as turmas de um curso que já não existe no fim
  const doAno = (lista ?? []).filter((t) => !ano || t.anoLetivo === ano)
  const grupos = [
    ...cursos.map((c) => [c, doAno.filter((t) => t.curso === c.id)]),
    ...[...new Set(doAno.map((t) => t.curso).filter((id) => !cursoDe(id)))].map((id) => [{ id, nome: id }, doAno.filter((t) => t.curso === id)]),
  ]
  const novaNoCurso = (id) => { setF((x) => ({ ...x, curso: id, anoCurricular: '1' })); document.getElementById('t-nome')?.focus() }

  async function criar(e) {
    e.preventDefault()
    setErroForm('')
    try {
      await api('/academico/turmas', { metodo: 'POST', corpo: { ...f, anoLetivo: ano || f.anoLetivo, anoCurricular: variosAnos(f.curso) ? f.anoCurricular : '1' } })
      setF({ ...f, nome: '' })
      setAviso({ texto: tx('Turma criada.') })
      carregar()
    } catch (falha) {
      setErroForm(falha.message)
    }
  }

  return (
    <>
      <CabecalhoPagina titulo={tx('Turmas')} subtitulo={ano ? tx('ano lectivo {0} — matrículas, cadeiras e horários', { 0: ano }) : tx('matrículas, cadeiras e horários')} migalhas={[{ rotulo: tx('Administração Escolar') }, { rotulo: tx('Turmas') }]}>
        {ano && (
          <select className="form-select w-auto" value="" onChange={(e) => e.target.value && navegar(`/academico/documentos/ano/${e.target.value}?ano=${encodeURIComponent(ano)}`)} aria-label={tx('Documentos do ano lectivo')}>
            <option value="">{tx('Documentos do ano lectivo…')}</option>
            {Object.entries(DOCUMENTOS_ANO).map(([k, t]) => <option key={k} value={k}>{tx(t)}</option>)}
          </select>
        )}
        <button type="button" className="btn btn-white" onClick={() => setEscolherDoc(true)}><i className="fa fa-calendar-alt me-1" />{tx('Documentos de anos anteriores (2.ª via)…')}</button>
      </CabecalhoPagina>
      {escolherDoc && <EscolherDocumento gerir={pode('academico.gerir')} fechar={() => setEscolherDoc(false)} />}
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
                    {turmas.length > 0 && <Link to={`/academico/documentos/curso/${encodeURIComponent(c.id)}/lista?ano=${encodeURIComponent(ano)}`} className="btn btn-xs perfil-botao-contorno"><i className="fa fa-list-ol me-1" />{tx('Lista do curso')}</Link>}
                    {pode('academico.gerir') && <button type="button" className="btn btn-xs perfil-botao-claro" onClick={() => novaNoCurso(c.id)}><i className="fa fa-plus me-1" />{tx('Nova turma neste curso')}</button>}
                  </span>
                )}
              >
                <div className="d-flex flex-wrap align-items-center gap-2 px-3 py-2 border-bottom small">
                  <i className="fa fa-user-tie text-muted" />
                  <span className="text-muted">{tx('Director do curso:')}</span>
                  {pode('academico.gerir') ? (
                    <select className="form-select form-select-sm w-auto" value={dirs.directores[c.id]?.utilizadorId ?? ''} onChange={(e) => designar(c.id, e.target.value)} aria-label={tx('Director do curso')}>
                      <option value="">{tx('— por designar —')}</option>
                      {dirs.candidatos.map((u) => <option key={u.utilizadorId} value={u.utilizadorId}>{u.nome}{u.cargo ? ` — ${u.cargo}` : ''} ({u.nomePapel})</option>)}
                    </select>
                  ) : <b>{dirs.directores[c.id]?.nome ?? tx('por designar')}</b>}
                  {dirs.propostas?.[c.id] && <span className="badge bg-info text-dark" title={tx('Proposto por {0}', { 0: dirs.propostas[c.id].pedidoPor })}><i className="fa fa-hourglass-half me-1" />{dirs.propostas[c.id].nome ? tx('À espera do Comandante: {0}', { 0: dirs.propostas[c.id].nome }) : tx('À espera do Comandante: retirar o Director')}</span>}
                  {dirs.recusas?.[c.id] && <span className="text-danger"><i className="fa fa-times-circle me-1" />{tx('O Comandante recusou: {0}', { 0: dirs.recusas[c.id].motivo })}</span>}
                </div>
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
                            <td className="text-end text-nowrap">
                              <Link to={`/academico/turmas/${t.id}?aba=estudantes`} className="btn btn-sm btn-theme me-1"><i className="fa fa-user-graduate me-1" />{tx('Estudantes')}</Link>
                              <Link to={`/academico/turmas/${t.id}?aba=cadeiras`} className="btn btn-sm btn-white me-1"><i className="fa fa-book me-1" />{tx('Cadeiras e pautas')}</Link>
                              <Link to={`/academico/turmas/${t.id}?aba=documentos`} className="btn btn-sm btn-white"><i className="fa fa-print me-1" />{tx('Documentos')}</Link>
                            </td>
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
                  <select id="t-ano" className="form-select mb-1" value={ano} onChange={(e) => mudar(e.target.value)} required>
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
