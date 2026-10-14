import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api'
import { useSessao } from '../../sessaoContexto'
import { Aviso, CabecalhoPagina, Carregando, Erro, Painel } from '../../componentes/Ui'
import { PERIODOS } from './comum'
import CopiarTurma from './CopiarTurma'
import AvaliacaoDocentes from './AvaliacaoDocentes'
import ImportarEstudantes from './ImportarEstudantes'
import Finalistas from './Finalistas'
import { confirmar } from '../../../portal/dialogos'

const DIAS = ['', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const ESTADOS = { ativa: ['bg-success', 'Ativa'], suspensa: ['bg-warning text-dark', 'Suspensa'], concluida: ['bg-info', 'Concluída'], anulada: ['bg-secondary', 'Anulada'] }

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
        {gerir && <button type="button" className="btn btn-white" onClick={() => setImportar(true)}><i className="fa fa-file-excel me-1 text-success" /> Matricular a partir de Excel/CSV</button>}
        {gerir && <button type="button" className="btn btn-theme" onClick={() => setCopiar(true)}><i className="fa fa-copy me-1" /> Copiar cadeiras de outra turma</button>}
        <Link to="/academico/turmas" className="btn btn-white"><i className="fa fa-arrow-left me-1" /> Turmas</Link>
      </CabecalhoPagina>
      {importar && <ImportarEstudantes turma={t} fechar={() => setImportar(false)} concluido={carregar} />}
      <div className="panel panel-inverse">
        <div className="panel-heading"><h4 className="panel-title"><i className="fa fa-print me-2" />Documentos da turma</h4></div>
        <div className="panel-body d-flex flex-wrap gap-2 align-items-center">
          <Link to={`/academico/documentos/turma/${t.id}/pauta`} className="btn btn-white"><i className="fa fa-table me-1" />Pauta da turma</Link>
          <span className="text-muted small">Por cadeira (pauta, folha de presenças, lista para a prova): botões em cada cadeira abaixo.</span>
          {gerir && (
            <label className="form-check form-switch ms-auto mb-0">
              <input className="form-check-input" type="checkbox" checked={Boolean(t.anoFinal)} onChange={(e) => api(`/academico/turmas/${t.id}`, { metodo: 'PUT', corpo: { anoFinal: e.target.checked } }).then(carregar).catch(falhou)} />
              <span className="form-check-label fw-bold">Turma de finalistas (último ano: trabalho de fim de curso)</span>
            </label>
          )}
        </div>
      </div>
      {t.anoFinal && <Finalistas turma={t} gerir={gerir} avisar={setAviso} />}
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
                      <td><Link to={`/academico/documentos/estudante/${m.estudante.id}/historico`} className="fw-bold" title="Histórico académico">{m.estudante.nome}</Link><div className="small text-muted">{m.estudante.email}</div></td>
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
          {gerir && <MatricularEstudantes turma={t} carregar={carregar} avisar={setAviso} />}
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

// matricular estudantes já registados pelo Pessoal e Quadros: pesquisar e escolher (vários de uma vez)
function MatricularEstudantes({ turma, carregar, avisar }) {
  const [q, setQ] = useState('')
  const [encontrados, setEncontrados] = useState([])
  const [escolhidos, setEscolhidos] = useState([])
  const [aGravar, setAGravar] = useState(false)
  const jaNaTurma = new Set(turma.matriculas.map((m) => m.estudante.id))
  useEffect(() => {
    const t = setTimeout(() => api(`/academico/contas?tipo=estudante${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ''}`).then((l) => setEncontrados(l.filter((e) => e.ativo && !jaNaTurma.has(e.id)).slice(0, 30))).catch(() => {}), 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, turma.matriculas.length])
  const alternar = (e) => setEscolhidos((l) => (l.some((x) => x.id === e.id) ? l.filter((x) => x.id !== e.id) : [...l, e]))
  async function matricular() {
    setAGravar(true)
    try {
      const r = await api(`/academico/turmas/${turma.id}/matricular`, { metodo: 'POST', corpo: { estudanteIds: escolhidos.map((e) => e.id) } })
      avisar({ texto: `${r.matriculados} estudante(s) matriculado(s) em ${turma.nome}.` })
      setEscolhidos([])
      carregar()
    } catch (e) {
      avisar({ tipo: 'erro', texto: e.message })
    } finally {
      setAGravar(false)
    }
  }
  return (
    <Painel titulo="Matricular estudantes registados">
      <p className="small text-muted">O registo dos estudantes é feito pela Repartição de Pessoal e Quadros. Aqui escolhe-se quem entra nesta turma.</p>
      <div className="input-group mb-2">
        <span className="input-group-text"><i className="fa fa-search" /></span>
        <input className="form-control" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome, e-mail ou número de estudante" aria-label="Pesquisar estudantes registados" />
      </div>
      <div className="list-group mb-2" style={{ maxHeight: 260, overflowY: 'auto' }}>
        {encontrados.length === 0 && <div className="list-group-item small text-muted">{q.trim() ? 'Ninguém encontrado (ou já está na turma).' : 'Todos os estudantes registados já estão nesta turma.'}</div>}
        {encontrados.map((e) => {
          const marcado = escolhidos.some((x) => x.id === e.id)
          return (
            <label key={e.id} className={`list-group-item list-group-item-action d-flex align-items-center gap-2 ${marcado ? 'active' : ''}`}>
              <input type="checkbox" className="form-check-input mt-0" checked={marcado} onChange={() => alternar(e)} aria-label={e.nome} />
              <span className="flex-grow-1"><b>{e.nome}</b><span className="d-block small opacity-75">{e.numero}{e.dados?.posto ? ` · ${e.dados.posto}` : ''}</span></span>
            </label>
          )
        })}
      </div>
      {escolhidos.length > 0 && <div className="d-flex flex-wrap gap-1 mb-2">{escolhidos.map((e) => <span key={e.id} className="badge bg-theme">{e.nome} <button type="button" className="btn-close btn-close-white ms-1" style={{ fontSize: 8 }} onClick={() => alternar(e)} aria-label={`Retirar ${e.nome}`} /></span>)}</div>}
      <button type="button" className="btn btn-theme w-100" onClick={matricular} disabled={!escolhidos.length || aGravar}><i className="fa fa-user-check me-1" />{aGravar ? 'A matricular…' : `Matricular ${escolhidos.length || ''} estudante(s)`}</button>
    </Painel>
  )
}

function CadeiraTurma({ c, gerir, carregar, avisar }) {
  const [h, setH] = useState({ diaSemana: '1', inicio: '08:00', fim: '10:00', sala: '' })
  const falhou = (e) => avisar({ tipo: 'erro', texto: e.message })
  return (
    <Painel titulo={`${c.codigo} · ${c.nome}`} acoes={gerir && (
      <button type="button" className="btn btn-xs btn-icon btn-danger" title="Apagar cadeira" onClick={async () => {
        if (await confirmar(`Apagar "${c.nome}" com materiais, notas, trabalhos e presenças?`, { titulo: 'Apagar cadeira', botao: 'Apagar', perigo: true })) api(`/academico/cadeiras/${c.id}`, { metodo: 'DELETE' }).then(carregar).catch(falhou)
      }}><i className="fa fa-times" /></button>
    )}>
      <div className="d-flex flex-wrap gap-1 mb-2">
        <Link to={`/academico/documentos/cadeira/${c.id}/pauta`} className="btn btn-xs btn-white"><i className="fa fa-print me-1" />Pauta</Link>
        <Link to={`/academico/documentos/cadeira/${c.id}/presencas`} className="btn btn-xs btn-white"><i className="fa fa-user-check me-1" />Folha de presenças</Link>
        <Link to={`/academico/documentos/cadeira/${c.id}/prova`} className="btn btn-xs btn-white"><i className="fa fa-signature me-1" />Lista para a prova</Link>
      </div>
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
