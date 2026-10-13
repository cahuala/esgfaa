import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useSessao } from '../../sessaoContexto'
import { Aviso, CabecalhoPagina, Carregando, Erro, Painel } from '../../componentes/Ui'

const anoAtual = () => {
  const d = new Date()
  const a = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1
  return `${a}/${a + 1}`
}

// turmas (curso + ano letivo): a partir daqui faz-se a matrícula e se atribuem cadeiras
function Turmas() {
  const { pode } = useSessao()
  const [lista, setLista] = useState(null)
  const [cursos, setCursos] = useState([])
  const [erro, setErro] = useState('')
  const [f, setF] = useState({ curso: '', anoLetivo: anoAtual(), nome: '' })
  const [erroForm, setErroForm] = useState('')
  const [aviso, setAviso] = useState(null)

  const carregar = useCallback(() => api('/academico/turmas').then(setLista).catch((e) => setErro(e.message)), [])
  useEffect(() => {
    carregar()
    api('/colecoes/cursos').then((c) => { setCursos(c); setF((x) => ({ ...x, curso: x.curso || c[0]?.id || '' })) }).catch(() => {})
  }, [carregar])

  const nomeCurso = (id) => cursos.find((c) => c.id === id)?.nome || id

  async function criar(e) {
    e.preventDefault()
    setErroForm('')
    try {
      await api('/academico/turmas', { metodo: 'POST', corpo: f })
      setF({ ...f, nome: '' })
      setAviso({ texto: 'Turma criada.' })
      carregar()
    } catch (falha) {
      setErroForm(falha.message)
    }
  }

  return (
    <>
      <CabecalhoPagina titulo="Turmas" subtitulo="matrículas, cadeiras e horários" migalhas={[{ rotulo: 'Secretaria Académica' }, { rotulo: 'Turmas' }]} />
      <div className="row">
        <div className={pode('academico.gerir') ? 'col-xl-8' : 'col-12'}>
          {erro && <Erro texto={erro} onRepetir={carregar} />}
          <Painel titulo="Turmas" corpo={false}>
            {!lista && !erro ? <Carregando /> : (
              <div className="table-responsive">
                <table className="table table-striped align-middle mb-0">
                  <thead><tr><th>Turma</th><th>Curso</th><th>Ano letivo</th><th className="text-end">Estudantes</th><th className="text-end">Cadeiras</th><th /></tr></thead>
                  <tbody>
                    {lista?.length === 0 && <tr><td colSpan={6} className="text-center text-muted py-4">Ainda não há turmas.</td></tr>}
                    {lista?.map((t) => (
                      <tr key={t.id}>
                        <td className="fw-bold">{t.nome} {!t.ativa && <span className="badge bg-secondary ms-1">Inativa</span>}</td>
                        <td>{nomeCurso(t.curso)}</td>
                        <td>{t.anoLetivo}</td>
                        <td className="text-end">{t.estudantes}</td>
                        <td className="text-end">{t.cadeiras}</td>
                        <td className="text-end"><Link to={`/academico/turmas/${t.id}`} className="btn btn-sm btn-primary">Abrir</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Painel>
        </div>
        {pode('academico.gerir') && (
          <div className="col-xl-4">
            <Painel titulo="Nova turma">
              <form onSubmit={criar}>
                {erroForm && <div className="alert alert-danger py-2">{erroForm}</div>}
                <label className="form-label fw-bold" htmlFor="t-curso">Curso</label>
                <select id="t-curso" className="form-select mb-3" value={f.curso} onChange={(e) => setF({ ...f, curso: e.target.value })} required>
                  {cursos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
                <label className="form-label fw-bold" htmlFor="t-ano">Ano letivo</label>
                <input id="t-ano" className="form-control mb-3" value={f.anoLetivo} onChange={(e) => setF({ ...f, anoLetivo: e.target.value })} placeholder="2026/2027" required />
                <label className="form-label fw-bold" htmlFor="t-nome">Nome da turma</label>
                <input id="t-nome" className="form-control mb-3" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="CEM 2026/2027" required />
                <button type="submit" className="btn btn-theme w-100"><i className="fa fa-plus me-1" /> Criar turma</button>
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
