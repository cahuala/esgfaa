import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, obterFicheiro } from '../../api'
import { Aviso, CabecalhoPagina, Carregando, Erro, Painel } from '../../componentes/Ui'
import Capa from '../../../portal/biblioteca/Capa'

const NUMEROS = [['obras', 'Obras', 'fa-book', 'bg-theme'], ['exemplares', 'Exemplares', 'fa-barcode', 'bg-dark'], ['ativos', 'Emprestados', 'fa-hand-holding', 'bg-info'], ['atrasados', 'Em atraso', 'fa-clock', 'bg-danger'], ['digitais', 'Digitais', 'fa-file-pdf', 'bg-success'], ['reservas', 'Reservas', 'fa-bookmark', 'bg-purple']]

// catálogo da biblioteca: números, pesquisa e lista de obras
function Catalogo() {
  const [resumo, setResumo] = useState(null)
  const [obras, setObras] = useState(null)
  const [f, setF] = useState({ q: '', tipo: '' })
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState(null)
  useEffect(() => { api('/biblioteca').then(setResumo).catch((e) => setErro(e.message)) }, [])
  const procurar = useCallback((filtros) => api(`/biblioteca/obras?${new URLSearchParams(filtros)}`).then(setObras).catch((e) => setErro(e.message)), [])
  // pesquisa enquanto escreve, com uma pequena pausa
  useEffect(() => { const t = setTimeout(() => procurar(f), 250); return () => clearTimeout(t) }, [f, procurar])
  if (erro) return <Erro texto={erro} />
  if (!resumo) return <Carregando />

  return (
    <>
      <CabecalhoPagina titulo="Biblioteca" subtitulo="catálogo de obras, exemplares e versões digitais" migalhas={[{ rotulo: 'Biblioteca' }, { rotulo: 'Catálogo' }]}>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-white" onClick={() => obterFicheiro('/biblioteca/exportar', 'catalogo-dublin-core.xml').catch((e) => setAviso({ tipo: 'erro', texto: e.message }))} title="Registos Dublin Core (OAI-DC) para repositórios e catálogos coletivos"><i className="fa fa-file-code me-1" />Exportar Dublin Core</button>
          <Link to="/biblioteca/obras/nova" className="btn btn-theme"><i className="fa fa-plus me-1" />Nova obra</Link>
        </div>
      </CabecalhoPagina>
      <div className="row g-3 mb-3">
        {NUMEROS.map(([k, rotulo, icone, cor]) => (
          <div key={k} className="col-6 col-md">
            <div className={`widget widget-stats ${cor} mb-0`}>
              <div className="stats-icon"><i className={`fa ${icone}`} /></div>
              <div className="stats-info"><h4>{rotulo}</h4><p>{resumo[k]}</p></div>
              {k === 'reservas' && resumo[k] > 0 && <div className="stats-link"><Link to="/biblioteca/emprestimos?estado=reservas">Atender <i className="fa fa-arrow-alt-circle-right" /></Link></div>}
              {k === 'atrasados' && resumo[k] > 0 && <div className="stats-link"><Link to="/biblioteca/emprestimos?estado=atrasados">Ver atrasos <i className="fa fa-arrow-alt-circle-right" /></Link></div>}
            </div>
          </div>
        ))}
      </div>
      <Painel titulo={obras ? `Obras (${obras.length})` : 'Obras'} corpo={false}>
        <div className="p-3 d-flex flex-wrap gap-2 border-bottom">
          <input type="search" className="form-control" style={{ maxWidth: 420 }} placeholder="Título, autor, assunto, ISBN, cota ou código do exemplar" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} aria-label="Pesquisar no catálogo" />
          <select className="form-select" style={{ maxWidth: 240 }} value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })} aria-label="Tipo de obra">
            <option value="">Todos os tipos</option>
            {Object.entries(resumo.tipos).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        {!obras ? <Carregando /> : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead><tr><th>Obra</th><th>Tipo</th><th>Cota</th><th className="text-center">Disponíveis</th><th className="text-center">Digital</th></tr></thead>
              <tbody>
                {obras.length === 0 && <tr><td colSpan={5} className="text-center text-muted py-4">{f.q || f.tipo ? 'Nada encontrado.' : 'O catálogo está vazio. Registe a primeira obra.'}</td></tr>}
                {obras.map((o) => {
                  const uteis = o.exemplares.filter((x) => x.estado === 'bom' || x.estado === 'danificado')
                  const livres = uteis.filter((x) => !x.emprestimo).length
                  return (
                    <tr key={o.id}>
                      <td>
                        <div className="d-flex align-items-center gap-3">
                          <Link to={`/biblioteca/obras/${o.id}`} style={{ width: 42, flex: '0 0 42px' }} tabIndex={-1}><Capa o={o} /></Link>
                          <div>
                            <Link to={`/biblioteca/obras/${o.id}`} className="fw-bold text-body">{o.titulo}</Link>{o.subtitulo && <span className="text-muted">: {o.subtitulo}</span>}
                            <div className="small text-muted">{[o.autores.join('; '), o.editora, o.ano].filter(Boolean).join(' · ')}</div>
                          </div>
                        </div>
                      </td>
                      <td className="small">{resumo.tipos[o.tipo]}</td>
                      <td className="small text-nowrap">{o.cota || '—'}</td>
                      <td className="text-center">{uteis.length ? <span className={`badge ${livres ? 'bg-success' : 'bg-warning text-dark'}`}>{livres} / {uteis.length}</span> : <span className="text-muted small">—</span>}</td>
                      <td className="text-center">{o.ficheiro ? <i className="fa fa-file-pdf text-danger" title={o.acesso === 'docentes' ? 'Só docentes' : 'Todos'} /> : ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Painel>
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

export default Catalogo
