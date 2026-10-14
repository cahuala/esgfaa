import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { CabecalhoPagina, Carregando, Erro, Painel } from '../../componentes/Ui'

const NOMES = { p1: '1.ª Prova', p2: '2.ª Prova', exame: 'Exame', recurso: 'Recurso' }
const MOTIVOS = { faltas: ['bg-warning text-dark', 'fa-user-times'], nota: ['bg-danger', 'fa-arrow-down'], situacao: ['bg-danger', 'fa-exclamation'], acesso: ['bg-gray-500', 'fa-plug'] }
const pct = (v) => (v === null || v === undefined ? '—' : `${v.toLocaleString('pt-PT')}%`)
const num = (v) => (v === null || v === undefined ? '—' : v.toLocaleString('pt-PT'))

// barra pequena com a percentagem (verde, amarelo ou vermelho)
function Barra({ valor, bom = 75, mau = 50 }) {
  if (valor === null || valor === undefined) return <span className="text-muted">—</span>
  const cor = valor >= bom ? 'bg-success' : valor >= mau ? 'bg-warning' : 'bg-danger'
  return (
    <div className="d-flex align-items-center gap-2">
      <div className="progress flex-grow-1" style={{ height: 6, minWidth: 60 }}><div className={`progress-bar ${cor}`} style={{ width: `${valor}%` }} /></div>
      <span className="small fw-bold text-nowrap">{pct(valor)}</span>
    </div>
  )
}

/*
  Painel de indicadores da Administração Escolar: aprovação, médias e assiduidade por turma e cadeira,
  estudantes em risco (faltas, negativas, sem acesso ao portal) e pautas por lançar depois das provas.
*/
function Indicadores() {
  const [ano, setAno] = useState('')
  const [d, setD] = useState(null)
  const [erro, setErro] = useState('')
  const [filtroRisco, setFiltroRisco] = useState('')
  useEffect(() => { api(`/academico/indicadores${ano ? `?anoLetivo=${encodeURIComponent(ano)}` : ''}`).then(setD).catch((e) => setErro(e.message)) }, [ano])
  if (erro) return <Erro texto={erro} />
  if (!d) return <Carregando />

  const g = d.geral
  const widgets = [
    ['bg-dark', 'fa-user-graduate', 'ESTUDANTES ATIVOS', g.estudantes, `${g.turmas} turma(s) · ${g.cadeiras} cadeiras`],
    ['bg-red', 'fa-exclamation-triangle', 'EM RISCO', g.emRisco, 'faltas, negativas ou sem acesso'],
    ['bg-orange', 'fa-hourglass-half', 'PAUTAS EM ATRASO', g.pautasEmAtraso, 'notas por lançar há 15+ dias'],
    ['bg-teal', 'fa-check-circle', 'APROVAÇÃO MÉDIA', pct(g.taxaAprovacao), `assiduidade média ${pct(g.assiduidade)}`],
  ]
  const risco = filtroRisco ? d.risco.filter((r) => r.motivos.some((m) => m.tipo === filtroRisco)) : d.risco

  return (
    <>
      <CabecalhoPagina titulo="Indicadores académicos" subtitulo={`ano letivo ${d.anoLetivo || '—'}`} migalhas={[{ rotulo: 'Administração Escolar' }, { rotulo: 'Indicadores' }]}>
        {d.anos.length > 1 && (
          <select className="form-select w-auto" value={ano || d.anoLetivo} onChange={(e) => setAno(e.target.value)} aria-label="Ano letivo">
            {d.anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
      </CabecalhoPagina>
      <div className="row">
        {widgets.map(([cor, icone, titulo, valor, nota]) => (
          <div key={titulo} className="col-xl-3 col-md-6">
            <div className={`widget widget-stats ${cor}`}>
              <div className="stats-icon"><i className={`fa ${icone}`} /></div>
              <div className="stats-info"><h4>{titulo}</h4><p>{valor}</p></div>
              <div className="stats-link"><span className="d-block px-3 py-2 small">{nota}</span></div>
            </div>
          </div>
        ))}
      </div>
      {g.cadeirasSemDocente > 0 && <div className="alert alert-warning"><i className="fa fa-chalkboard-teacher me-2" />{g.cadeirasSemDocente} cadeira(s) sem docente alocado. <Link to="/academico/alocacao">Abrir a alocação de docentes</Link></div>}

      <div className="row">
        <div className="col-xl-7">
          <Painel titulo={`Estudantes em risco (${d.risco.length})`} acoes={(
            <select className="form-select form-select-sm" style={{ width: 170 }} value={filtroRisco} onChange={(e) => setFiltroRisco(e.target.value)} aria-label="Filtrar motivo">
              <option value="">Todos os motivos</option><option value="faltas">Faltas</option><option value="nota">Negativas</option><option value="situacao">Recurso/reprovação</option><option value="acesso">Sem acesso</option>
            </select>
          )} corpo={false}>
            <div className="table-responsive" style={{ maxHeight: 520 }}>
              <table className="table table-striped align-middle mb-0">
                <thead><tr><th>Estudante</th><th>Turma</th><th>Motivos</th></tr></thead>
                <tbody>
                  {risco.length === 0 && <tr><td colSpan={3} className="text-center text-muted py-4">Nenhum estudante em risco.</td></tr>}
                  {risco.map((r) => (
                    <tr key={`${r.turma.id}-${r.estudante.id}`}>
                      <td><b>{r.estudante.nome}</b><div className="small text-muted">{r.estudante.numero}</div></td>
                      <td className="small"><Link to={`/academico/turmas/${r.turma.id}`}>{r.turma.nome}</Link></td>
                      <td>
                        <div className="d-flex flex-wrap gap-1">
                          {r.motivos.map((m, i) => <span key={i} className={`badge ${MOTIVOS[m.tipo][0]}`}><i className={`fa ${MOTIVOS[m.tipo][1]} me-1`} />{m.cadeira ? `${m.cadeira}: ` : ''}{m.texto}</span>)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Painel>
        </div>
        <div className="col-xl-5">
          <Painel titulo={`Pautas em atraso (${d.atrasos.length})`} corpo={false}>
            <div className="list-group list-group-flush">
              {d.atrasos.length === 0 && <div className="list-group-item text-muted">Todas as notas das provas realizadas estão lançadas.</div>}
              {d.atrasos.map((a, i) => (
                <Link key={i} to={`/academico/cadeiras/${a.cadeira.id}?separador=pauta`} className="list-group-item list-group-item-action">
                  <div className="d-flex justify-content-between gap-2">
                    <b>{a.cadeira.codigo} · {NOMES[a.componente]}</b>
                    <span className="badge bg-danger">{a.diasAtraso} dias</span>
                  </div>
                  <div className="small text-muted">{a.turma} · prova a {new Date(`${a.data}T12:00:00`).toLocaleDateString('pt-PT')} · faltam {a.faltam} nota(s)</div>
                  <div className="small">{a.docentes.length ? a.docentes.join(', ') : 'Sem docente'}</div>
                </Link>
              ))}
            </div>
          </Painel>
          <Painel titulo="Turmas" corpo={false}>
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead><tr><th>Turma</th><th className="text-center">Estudantes</th><th className="text-center">Em risco</th><th>Aprovação</th></tr></thead>
                <tbody>
                  {d.turmas.map((t) => (
                    <tr key={t.id}>
                      <td><Link to={`/academico/turmas/${t.id}`} className="fw-bold">{t.nome}</Link><div className="small text-muted">{t.anoCurricular}.º ano · média {num(t.media)}</div></td>
                      <td className="text-center">{t.estudantes}</td>
                      <td className="text-center">{t.emRisco ? <span className="badge bg-danger">{t.emRisco}</span> : 0}</td>
                      <td style={{ minWidth: 120 }}><Barra valor={t.taxaAprovacao} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Painel>
        </div>
      </div>

      <Painel titulo="Cadeiras" corpo={false}>
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead><tr><th>Cadeira</th><th>Turma</th><th>Docentes</th><th className="text-center">Em curso</th><th className="text-center">Exame</th><th className="text-center">Recurso</th><th className="text-center">Aprov.</th><th className="text-center">Reprov.</th><th className="text-center">Média</th><th>Assiduidade</th><th>Aprovação</th></tr></thead>
            <tbody>
              {d.cadeiras.map((c) => (
                <tr key={c.id}>
                  <td><Link to={`/academico/cadeiras/${c.id}`}><b>{c.codigo}</b></Link> · {c.nome}</td>
                  <td className="small">{c.turma}</td>
                  <td className="small">{c.semDocente ? <span className="badge bg-warning text-dark">Sem docente</span> : c.docentes.join(', ')}</td>
                  <td className="text-center">{c.emCurso}</td>
                  <td className="text-center">{c.exame}</td>
                  <td className="text-center">{c.recurso}</td>
                  <td className="text-center text-success fw-bold">{c.aprovados}</td>
                  <td className="text-center text-danger fw-bold">{c.reprovados}</td>
                  <td className="text-center">{num(c.media)}</td>
                  <td style={{ minWidth: 120 }}><Barra valor={c.assiduidade} /></td>
                  <td style={{ minWidth: 120 }}><Barra valor={c.taxaAprovacao} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Painel>
    </>
  )
}

export default Indicadores
