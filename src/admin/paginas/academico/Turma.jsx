import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api'
import { useSessao } from '../../sessaoContexto'
import { Aviso, CabecalhoPagina, Carregando, Erro, Painel } from '../../componentes/Ui'
import { PERIODOS } from './comum'
import CopiarTurma from './CopiarTurma'
import AvaliacaoDocentes from './AvaliacaoDocentes'
import ImportarEstudantes from './ImportarEstudantes'

const DIAS = ['', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const ESTADOS = { ativa: ['bg-success', 'Ativa'], suspensa: ['bg-warning text-dark', 'Suspensa'], concluida: ['bg-info', 'Concluída'], anulada: ['bg-secondary', 'Anulada'] }
const RAMOS = ['Exército', 'Força Aérea Nacional', 'Marinha de Guerra Angolana']

// uma turma: matrículas, cadeiras (período, docentes alocados) e horário
function Turma() {
  const { id } = useParams()
  const { pode } = useSessao()
  const gerir = pode('academico.gerir')
  const [t, setT] = useState(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState(null)
  const [copiar, setCopiar] = useState(false)
  const [importar, setImportar] = useState(false)

  const carregar = useCallback(() => api(`/academico/turmas/${id}`).then((r) => { setErro(''); setT(r) }).catch((e) => setErro(e.message)), [id])
  useEffect(() => { carregar() }, [carregar])

  const falhou = (e) => setAviso({ tipo: 'erro', texto: e.message })

  if (erro) return <Erro texto={erro} />
  if (!t) return <Carregando />

  return (
    <>
      <CabecalhoPagina titulo={t.nome} subtitulo={`${t.anoLetivo} · ${t.anoCurricular}.º ano`} migalhas={[{ rotulo: 'Turmas', para: '/academico/turmas' }, { rotulo: t.nome }]}>
        {gerir && <button type="button" className="btn btn-white" onClick={() => setImportar(true)}><i className="fa fa-file-excel me-1 text-success" /> Importar estudantes (Excel/CSV)</button>}
        {gerir && <button type="button" className="btn btn-theme" onClick={() => setCopiar(true)}><i className="fa fa-copy me-1" /> Copiar cadeiras de outra turma</button>}
        <Link to="/academico/turmas" className="btn btn-white"><i className="fa fa-arrow-left me-1" /> Turmas</Link>
      </CabecalhoPagina>
      {importar && <ImportarEstudantes turma={t} fechar={() => setImportar(false)} concluido={carregar} />}
      {copiar && <CopiarTurma turma={t} fechar={() => setCopiar(false)} concluido={carregar} />}
      <div className="row">
        <div className="col-xl-6">
          <Painel titulo={`Matrículas (${t.matriculas.length})`} corpo={false}>
            <div className="table-responsive">
              <table className="table table-striped align-middle mb-0">
                <thead><tr><th>Estudante</th><th>N.º</th><th>Estado</th></tr></thead>
                <tbody>
                  {t.matriculas.length === 0 && <tr><td colSpan={3} className="text-center text-muted py-4">Sem estudantes matriculados.</td></tr>}
                  {t.matriculas.map((m) => (
                    <tr key={m.id}>
                      <td><span className="fw-bold">{m.estudante.nome}</span><div className="small text-muted">{m.estudante.email}</div></td>
                      <td className="font-monospace">{m.estudante.numero}</td>
                      <td>
                        {gerir ? (
                          <select className="form-select form-select-sm w-auto" value={m.estado} aria-label={`Estado da matrícula de ${m.estudante.nome}`} onChange={(e) => api(`/academico/matriculas/${m.id}`, { metodo: 'PUT', corpo: { estado: e.target.value } }).then(carregar).catch(falhou)}>
                            {Object.entries(ESTADOS).map(([k, [, v]]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                        ) : <span className={`badge ${ESTADOS[m.estado][0]}`}>{ESTADOS[m.estado][1]}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Painel>
          {gerir && <NovaMatricula turma={t} carregar={carregar} avisar={setAviso} />}
        </div>
        <div className="col-xl-6">
          {t.cadeiras.map((c) => <CadeiraTurma key={c.id} c={c} gerir={gerir} carregar={carregar} avisar={setAviso} />)}
          {t.cadeiras.length === 0 && <div className="alert alert-info">Ainda não há cadeiras nesta turma.</div>}
          {gerir && <NovaCadeira turma={t} carregar={carregar} avisar={setAviso} />}
        </div>
      </div>
      {t.cadeiras.length > 0 && <AvaliacaoDocentes turma={t} gerir={gerir} avisar={setAviso} />}
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

// matrícula de um estudante novo: a conta é criada com o e-mail da Escola (palavra-passe inicial = e-mail)
function NovaMatricula({ turma, carregar, avisar }) {
  const vazio = { nome: '', email: '', posto: '', ramo: '', nip: '', telefone: '' }
  const [f, setF] = useState(vazio)
  const [erro, setErro] = useState('')
  async function matricular(e) {
    e.preventDefault()
    setErro('')
    try {
      const { nome, email, ...dados } = f
      const conta = await api(`/academico/turmas/${turma.id}/matricula-nova`, { metodo: 'POST', corpo: { nome, email, dados } })
      setF(vazio)
      avisar({ texto: `Matriculado: ${conta.nome} (n.º ${conta.numero}). Entra no portal com ${conta.email} e essa mesma palavra-passe na primeira vez.` })
      carregar()
    } catch (falha) {
      setErro(falha.message)
    }
  }
  return (
    <Painel titulo="Nova matrícula">
      <form onSubmit={matricular}>
        {erro && <div className="alert alert-danger py-2">{erro}</div>}
        <div className="row g-2">
          <div className="col-12"><label className="form-label fw-bold" htmlFor="m-nome">Nome completo</label><input id="m-nome" className="form-control" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} required /></div>
          <div className="col-12"><label className="form-label fw-bold" htmlFor="m-email">E-mail da Escola</label><input id="m-email" type="email" className="form-control" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="nome.apelido@esgfaa.gov.ao" required /></div>
          <div className="col-md-6"><label className="form-label" htmlFor="m-posto">Posto</label><input id="m-posto" className="form-control" value={f.posto} onChange={(e) => setF({ ...f, posto: e.target.value })} /></div>
          <div className="col-md-6"><label className="form-label" htmlFor="m-ramo">Ramo</label><select id="m-ramo" className="form-select" value={f.ramo} onChange={(e) => setF({ ...f, ramo: e.target.value })}><option value="">—</option>{RAMOS.map((r) => <option key={r}>{r}</option>)}</select></div>
          <div className="col-md-6"><label className="form-label" htmlFor="m-nip">NIP</label><input id="m-nip" className="form-control" value={f.nip} onChange={(e) => setF({ ...f, nip: e.target.value })} /></div>
          <div className="col-md-6"><label className="form-label" htmlFor="m-tel">Telefone</label><input id="m-tel" className="form-control" value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} /></div>
        </div>
        <div className="form-text mb-3">A palavra-passe inicial é o próprio e-mail; o portal obriga a mudá-la na primeira entrada.</div>
        <button type="submit" className="btn btn-theme w-100"><i className="fa fa-user-plus me-1" /> Matricular</button>
      </form>
    </Painel>
  )
}

function CadeiraTurma({ c, gerir, carregar, avisar }) {
  const [h, setH] = useState({ diaSemana: '1', inicio: '08:00', fim: '10:00', sala: '' })
  const falhou = (e) => avisar({ tipo: 'erro', texto: e.message })
  return (
    <Painel titulo={`${c.codigo} · ${c.nome}`} acoes={gerir && (
      <button type="button" className="btn btn-xs btn-icon btn-danger" title="Apagar cadeira" onClick={() => {
        if (window.confirm(`Apagar "${c.nome}" com materiais, notas, trabalhos e presenças?`)) api(`/academico/cadeiras/${c.id}`, { metodo: 'DELETE' }).then(carregar).catch(falhou)
      }}><i className="fa fa-times" /></button>
    )}>
      <div className="d-flex align-items-start gap-2 mb-2 flex-wrap">
        <div className="d-flex gap-1 flex-wrap">
          {c.docentes.length === 0 && <span className="badge bg-warning text-dark"><i className="fa fa-user-clock me-1" />Docentes por alocar</span>}
          {c.docentes.map((d) => <span key={d.id} className={`badge ${d.papel === 'regente' ? 'bg-dark' : 'bg-gray-500'}`}>{d.papel === 'regente' ? 'Regente' : 'Assistente'}: {d.nome}</span>)}
        </div>
        <span className="text-muted ms-auto small text-nowrap">{PERIODOS[c.periodo]} · {c.horas} h</span>
        <Link to={`/academico/cadeiras/${c.id}`} className="btn btn-xs btn-primary"><i className="fa fa-cog me-1" />Docentes, programa e pauta</Link>
      </div>
      <table className="table table-sm mb-2">
        <tbody>
          {c.horarios.length === 0 && <tr><td className="text-muted">Sem horário.</td></tr>}
          {c.horarios.map((x) => (
            <tr key={x.id}>
              <td>{DIAS[x.diaSemana]}</td><td>{x.inicio}–{x.fim}</td><td>{x.sala}</td>
              <td className="text-end">{gerir && <button type="button" className="btn btn-xs btn-white text-danger" aria-label="Retirar do horário" onClick={() => api(`/academico/horarios/${x.id}`, { metodo: 'DELETE' }).then(carregar).catch(falhou)}><i className="fa fa-times" /></button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {gerir && (
        <form className="d-flex gap-1 flex-wrap" onSubmit={(e) => { e.preventDefault(); api(`/academico/cadeiras/${c.id}/horarios`, { metodo: 'POST', corpo: h }).then(carregar).catch(falhou) }}>
          <select className="form-select form-select-sm w-auto" value={h.diaSemana} onChange={(e) => setH({ ...h, diaSemana: e.target.value })} aria-label="Dia">{DIAS.slice(1).map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</select>
          <input type="time" className="form-control form-control-sm w-auto" value={h.inicio} onChange={(e) => setH({ ...h, inicio: e.target.value })} aria-label="Início" />
          <input type="time" className="form-control form-control-sm w-auto" value={h.fim} onChange={(e) => setH({ ...h, fim: e.target.value })} aria-label="Fim" />
          <input className="form-control form-control-sm w-auto" placeholder="Sala" value={h.sala} onChange={(e) => setH({ ...h, sala: e.target.value })} aria-label="Sala" />
          <button type="submit" className="btn btn-sm btn-default"><i className="fa fa-plus" /> Horário</button>
        </form>
      )}
    </Painel>
  )
}

// a cadeira cria-se sem docentes: a alocação (regente e assistentes) faz-se na ficha da cadeira
function NovaCadeira({ turma, carregar, avisar }) {
  const vazio = { codigo: '', nome: '', periodo: '1', horas: '' }
  const [f, setF] = useState(vazio)
  const [erro, setErro] = useState('')
  async function criar(e) {
    e.preventDefault()
    setErro('')
    try {
      await api(`/academico/turmas/${turma.id}/cadeiras`, { metodo: 'POST', corpo: { ...f, horas: Number(f.horas || 0) } })
      setF(vazio)
      avisar({ texto: 'Cadeira criada. Aloque os docentes na ficha da cadeira.' })
      carregar()
    } catch (falha) {
      setErro(falha.message)
    }
  }
  return (
    <Painel titulo="Nova cadeira">
      <form onSubmit={criar}>
        {erro && <div className="alert alert-danger py-2">{erro}</div>}
        <div className="row g-2">
          <div className="col-md-4"><label className="form-label fw-bold" htmlFor="c-codigo">Código</label><input id="c-codigo" className="form-control" value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value })} placeholder="EST101" required /></div>
          <div className="col-md-8"><label className="form-label fw-bold" htmlFor="c-nome">Nome</label><input id="c-nome" className="form-control" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} required /></div>
          <div className="col-md-6"><label className="form-label" htmlFor="c-periodo">Período</label><select id="c-periodo" className="form-select" value={f.periodo} onChange={(e) => setF({ ...f, periodo: e.target.value })}>{Object.entries(PERIODOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="col-md-6"><label className="form-label" htmlFor="c-horas">Horas</label><input id="c-horas" type="number" min={0} className="form-control" value={f.horas} onChange={(e) => setF({ ...f, horas: e.target.value })} /></div>
        </div>
        <button type="submit" className="btn btn-theme w-100 mt-3"><i className="fa fa-plus me-1" /> Criar cadeira</button>
      </form>
    </Painel>
  )
}

export default Turma
