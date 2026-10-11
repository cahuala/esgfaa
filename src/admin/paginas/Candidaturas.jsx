import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { CabecalhoPagina, Carregando, Erro, Painel } from '../componentes/Ui'
import { dataHora } from '../formatar'
import { ESTADOS } from './candidaturasEstados'

// Candidaturas aos cursos recebidas pelo site
function Candidaturas() {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [estado, setEstado] = useState('')
  const [curso, setCurso] = useState('')
  const [pesquisa, setPesquisa] = useState('')
  const [cursos, setCursos] = useState([])

  const carregar = useCallback(() => {
    const p = new URLSearchParams()
    if (estado) p.set('estado', estado)
    if (curso) p.set('curso', curso)
    if (pesquisa.trim()) p.set('q', pesquisa.trim())
    api(`/candidaturas?${p}`).then((r) => { setErro(''); setDados(r) }).catch((e) => setErro(e.message))
  }, [estado, curso, pesquisa])

  useEffect(() => {
    const t = setTimeout(carregar, 250) // espera que se acabe de escrever na pesquisa
    return () => clearTimeout(t)
  }, [carregar])

  useEffect(() => {
    api('/colecoes/cursos').then(setCursos).catch(() => setCursos([]))
  }, [])

  const nomeCurso = (id) => cursos.find((c) => c.id === id)?.nome || id
  const porEstado = dados?.porEstado || {}

  return (
    <>
      <CabecalhoPagina titulo="Candidaturas" subtitulo="aos cursos da Escola" migalhas={[{ rotulo: 'Candidaturas' }]} />

      <div className="row">
        {Object.entries(ESTADOS).map(([chave, e]) => (
          <div className="col-xl-3 col-md-6" key={chave}>
            <button type="button" className={`widget widget-stats ${e.classe} border-0 w-100 text-start`} onClick={() => setEstado(estado === chave ? '' : chave)} aria-pressed={estado === chave}>
              <div className="stats-info">
                <h4>{e.rotulo.toUpperCase()}</h4>
                <p>{porEstado[chave] || 0}</p>
              </div>
              <div className="stats-link"><span className="d-block py-1">{estado === chave ? 'A mostrar só estas' : 'Filtrar'}</span></div>
            </button>
          </div>
        ))}
      </div>

      {erro && <Erro texto={erro} onRepetir={carregar} />}

      <Painel titulo={`Candidaturas${dados ? ` (${dados.lista.length})` : ''}`} corpo={false}>
        <div className="panel-body d-flex gap-2 flex-wrap pb-0">
          <div className="input-group lista-pesquisa">
            <span className="input-group-text"><i className="fa fa-search" /></span>
            <input className="form-control" placeholder="Nome, e-mail ou código…" value={pesquisa} onChange={(e) => setPesquisa(e.target.value)} />
          </div>
          <select className="form-select w-auto" value={curso} onChange={(e) => setCurso(e.target.value)} aria-label="Curso">
            <option value="">Todos os cursos</option>
            {cursos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <select className="form-select w-auto" value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Estado">
            <option value="">Todos os estados</option>
            {Object.entries(ESTADOS).map(([k, e]) => <option key={k} value={k}>{e.rotulo}</option>)}
          </select>
        </div>
        {!dados && !erro ? <Carregando /> : (
          <div className="table-responsive mt-3">
            <table className="table table-striped align-middle mb-0">
              <thead>
                <tr><th>Código</th><th>Candidato</th><th>Curso</th><th>Posto</th><th>Recebida</th><th>Estado</th><th /></tr>
              </thead>
              <tbody>
                {dados?.lista.length === 0 && <tr><td colSpan={7} className="text-center text-muted py-4">Sem candidaturas.</td></tr>}
                {dados?.lista.map((c) => (
                  <tr key={c.id}>
                    <td className="font-monospace text-nowrap">{c.codigo}</td>
                    <td><span className="fw-bold">{c.nome}</span><div className="text-muted small">{c.email}</div></td>
                    <td>{nomeCurso(c.curso)}</td>
                    <td className="text-nowrap">{c.dados?.posto}<div className="text-muted small">{c.dados?.ramo}</div></td>
                    <td className="text-nowrap">{dataHora(c.criadaEm)}</td>
                    <td><span className={`badge ${ESTADOS[c.estado]?.classe || 'bg-secondary'}`}>{ESTADOS[c.estado]?.rotulo || c.estado}</span></td>
                    <td className="text-end"><Link to={`/candidaturas/${c.id}`} className="btn btn-sm btn-primary">Abrir</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Painel>
    </>
  )
}

export default Candidaturas
