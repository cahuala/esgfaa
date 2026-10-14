import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { CabecalhoPagina, Carregando, Erro, Painel } from '../../componentes/Ui'
import { PAPEIS_DOCENCIA, PERIODOS } from './comum'

// alocação de docentes: carga horária de cada docente e cadeiras por alocar (turmas ativas)
function Alocacao() {
  const [d, setD] = useState(null)
  const [erro, setErro] = useState('')
  const [filtro, setFiltro] = useState('todas')
  useEffect(() => { api('/academico/alocacao').then(setD).catch((e) => setErro(e.message)) }, [])

  if (erro) return <Erro texto={erro} />
  if (!d) return <Carregando />

  const semRegente = d.cadeiras.filter((c) => !c.docentes.some((x) => x.papel === 'regente'))
  const semDocentes = d.cadeiras.filter((c) => c.docentes.length === 0)
  const horasTotal = d.docentes.reduce((s, x) => s + x.horas, 0)
  const cadeiras = filtro === 'sem-regente' ? semRegente : d.cadeiras
  const maxHoras = Math.max(1, ...d.docentes.map((x) => x.horas))

  const widgets = [
    ['bg-dark', 'fa-chalkboard-teacher', 'DOCENTES', d.docentes.length, `${d.docentes.filter((x) => x.cadeiras.length).length} com cadeiras`],
    ['bg-red', 'fa-book', 'CADEIRAS (TURMAS ATIVAS)', d.cadeiras.length, `${semDocentes.length} sem docentes`],
    ['bg-orange', 'fa-user-clock', 'SEM REGENTE', semRegente.length, 'precisam de alocação'],
    ['bg-teal', 'fa-clock', 'HORAS ALOCADAS', horasTotal, 'em todas as cadeiras'],
  ]

  return (
    <>
      <CabecalhoPagina titulo="Alocação de docentes" subtitulo="regentes, assistentes e carga horária" migalhas={[{ rotulo: 'Administração Escolar' }, { rotulo: 'Alocação de docentes' }]} />
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

      <div className="row">
        <div className="col-xl-5">
          <Painel titulo="Carga horária por docente" corpo={false}>
            <div className="list-group list-group-flush">
              {d.docentes.length === 0 && <div className="list-group-item text-muted">Ainda não há docentes. Crie-os em Contas do portal.</div>}
              {d.docentes.map((x) => (
                <div key={x.docente.id} className="list-group-item">
                  <div className="d-flex justify-content-between align-items-baseline">
                    <span className="fw-bold">{x.docente.nome} {!x.docente.ativo && <span className="badge bg-secondary">Inativo</span>}</span>
                    <span className="fw-bold">{x.horas} h</span>
                  </div>
                  <div className="progress my-1" style={{ height: 6 }}><div className="progress-bar bg-red" style={{ width: `${(x.horas / maxHoras) * 100}%` }} /></div>
                  <div className="small text-muted">
                    {x.cadeiras.length === 0 ? 'Sem cadeiras' : x.cadeiras.map((c) => (
                      <Link key={c.id} to={`/academico/cadeiras/${c.id}?separador=docentes`} className="me-2 text-decoration-none">{c.codigo} <span className="text-muted">({PAPEIS_DOCENCIA[c.papel].toLowerCase()}, {c.horas} h)</span></Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Painel>
        </div>
        <div className="col-xl-7">
          <Painel
            titulo="Cadeiras"
            corpo={false}
            acoes={(
              <div className="btn-group btn-group-sm">
                <button type="button" className={`btn ${filtro === 'todas' ? 'btn-light text-dark' : 'btn-outline-light'}`} onClick={() => setFiltro('todas')}>Todas</button>
                <button type="button" className={`btn ${filtro === 'sem-regente' ? 'btn-light text-dark' : 'btn-outline-light'}`} onClick={() => setFiltro('sem-regente')}>Sem regente ({semRegente.length})</button>
              </div>
            )}
          >
            <div className="table-responsive">
              <table className="table table-striped align-middle mb-0">
                <thead><tr><th>Cadeira</th><th>Turma</th><th>Período</th><th>Docentes</th><th className="text-end">Horas</th><th /></tr></thead>
                <tbody>
                  {cadeiras.length === 0 && <tr><td colSpan={6} className="text-center text-muted py-4">Nada a mostrar.</td></tr>}
                  {cadeiras.map((c) => (
                    <tr key={c.id}>
                      <td><span className="fw-bold">{c.codigo}</span> {c.nome}</td>
                      <td className="small">{c.turma?.nome}</td>
                      <td className="small text-nowrap">{PERIODOS[c.periodo]}</td>
                      <td className="small">
                        {c.docentes.length === 0 ? <span className="badge bg-warning text-dark">Por alocar</span> : c.docentes.map((x) => (
                          <div key={x.id}>{x.papel === 'regente' ? <i className="fa fa-star text-warning me-1" title="Regente" /> : <i className="fa fa-user text-muted me-1" title="Assistente" />}{x.nome}</div>
                        ))}
                      </td>
                      <td className={`text-end text-nowrap ${c.horasAlocadas < c.horas ? 'text-warning' : ''}`}>{c.horasAlocadas} / {c.horas}</td>
                      <td className="text-end"><Link to={`/academico/cadeiras/${c.id}?separador=docentes`} className="btn btn-xs btn-primary">Alocar</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Painel>
        </div>
      </div>
    </>
  )
}

export default Alocacao
