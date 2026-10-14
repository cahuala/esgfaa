import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { Campo, Cartao, Carregando, Etiqueta, Vazio } from '../componentes'
import { dataHora, localParaIso, nota } from '../formatar'

const TIPOS = { unica: 'Escolha única', multipla: 'Escolha múltipla', vf: 'Verdadeiro ou falso' }
const ESTADOS = { em_breve: ['azul', 'Abre em breve'], aberto: ['verde', 'Aberto'], fechado: ['cinzento', 'Fechado'] }
// ISO → valor de <input type="datetime-local"> na hora local
const paraLocal = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

// questionários online da cadeira (como os do Moodle)
function Questionarios(props) {
  const [aberto, setAberto] = useState(null)
  if (aberto) {
    return props.eDocente
      ? <EditorQuestionario id={aberto} avisar={props.avisar} voltar={() => setAberto(null)} />
      : <Realizar id={aberto} avisar={props.avisar} recarregar={props.recarregar} voltar={() => setAberto(null)} />
  }
  return <Lista {...props} abrir={setAberto} />
}

function Lista({ c, eDocente, avisar, abrir }) {
  const [lista, setLista] = useState(null)
  const falhou = useCallback((e) => avisar({ tipo: 'erro', texto: e.message }), [avisar])
  useEffect(() => { api(`/cadeiras/${c.id}/questionarios`).then(setLista).catch(falhou) }, [c.id, falhou])
  if (!lista) return <Carregando />

  return (
    <div className={eDocente ? 'p-grelha-lado' : ''}>
      <Cartao titulo={<><i className="fa fa-question-circle me-2" />Questionários</>} corpo={false}>
        {lista.length === 0 ? <div className="panel-body"><Vazio>{eDocente ? 'Ainda não criou questionários.' : 'Não há questionários publicados.'}</Vazio></div> : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead><tr><th>Questionário</th><th>Fecha</th><th className="text-center">Duração</th>{eDocente ? <th className="text-center">Estado</th> : <><th className="text-center">Tentativas</th><th className="text-center">Melhor nota</th></>}<th /></tr></thead>
              <tbody>
                {lista.map((q) => (
                  <tr key={q.id}>
                    <td><span className="fw-bold">{q.titulo}</span><div className="small text-muted">{q.numeroPerguntas} pergunta(s)</div></td>
                    <td className="small">{q.fecha ? dataHora(q.fecha) : 'Sem prazo'}</td>
                    <td className="text-center small">{q.duracao ? `${q.duracao} min` : 'Livre'}</td>
                    {eDocente ? (
                      <td className="text-center">{q.publicado ? <Etiqueta cor="verde">Publicado</Etiqueta> : <Etiqueta>Rascunho</Etiqueta>}</td>
                    ) : (
                      <>
                        <td className="text-center small">{q.feitas} / {q.tentativas}</td>
                        <td className="text-center fw-bold">{nota(q.melhorNota)}</td>
                      </>
                    )}
                    <td className="text-end text-nowrap">
                      {!eDocente && <span className="me-2"><Etiqueta cor={ESTADOS[q.estado][0]}>{ESTADOS[q.estado][1]}</Etiqueta></span>}
                      <button type="button" className="btn btn-sm btn-theme" onClick={() => abrir(q.id)}>{eDocente ? 'Editar' : 'Abrir'}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>
      {eDocente && <NovoQuestionario c={c} avisar={avisar} criado={(q) => abrir(q.id)} />}
    </div>
  )
}

function Definicoes({ inicial, guardar, botao }) {
  const [f, setF] = useState({
    titulo: inicial?.titulo || '', descricao: inicial?.descricao || '', abre: paraLocal(inicial?.abre), fecha: paraLocal(inicial?.fecha),
    duracao: inicial?.duracao ?? 30, tentativas: inicial?.tentativas ?? 1, mostrarRespostas: inicial?.mostrarRespostas ?? true,
  })
  const [erro, setErro] = useState('')
  async function submeter(e) {
    e.preventDefault()
    setErro('')
    try {
      await guardar({ ...f, abre: f.abre ? localParaIso(f.abre) : null, fecha: f.fecha ? localParaIso(f.fecha) : null, duracao: Number(f.duracao || 0), tentativas: Number(f.tentativas || 1) })
    } catch (falha) {
      setErro(falha.message)
    }
  }
  return (
    <form onSubmit={submeter} className="p-formulario">
      {erro && <p className="p-erro" role="alert">{erro}</p>}
      <Campo id="q-titulo" rotulo="Título"><input id="q-titulo" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} maxLength={200} required /></Campo>
      <Campo id="q-desc" rotulo="Instruções (opcional)"><textarea id="q-desc" rows={2} value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} /></Campo>
      <div className="row g-2">
        <div className="col-sm-6"><Campo id="q-abre" rotulo="Abre em"><input id="q-abre" type="datetime-local" value={f.abre} onChange={(e) => setF({ ...f, abre: e.target.value })} /></Campo></div>
        <div className="col-sm-6"><Campo id="q-fecha" rotulo="Fecha em"><input id="q-fecha" type="datetime-local" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></Campo></div>
        <div className="col-sm-6"><Campo id="q-duracao" rotulo="Duração (min, 0 = livre)"><input id="q-duracao" type="number" min={0} max={600} value={f.duracao} onChange={(e) => setF({ ...f, duracao: e.target.value })} /></Campo></div>
        <div className="col-sm-6"><Campo id="q-tent" rotulo="Tentativas"><input id="q-tent" type="number" min={1} max={10} value={f.tentativas} onChange={(e) => setF({ ...f, tentativas: e.target.value })} /></Campo></div>
      </div>
      <label className="p-caixa"><input type="checkbox" checked={f.mostrarRespostas} onChange={(e) => setF({ ...f, mostrarRespostas: e.target.checked })} /> Mostrar as respostas certas depois da entrega</label>
      <div><button type="submit" className="btn btn-theme">{botao}</button></div>
    </form>
  )
}

function NovoQuestionario({ c, avisar, criado }) {
  return (
    <Cartao titulo={<><i className="fa fa-plus me-2" />Novo questionário</>}>
      <Definicoes botao="Criar e juntar perguntas" guardar={async (dados) => { const q = await api(`/cadeiras/${c.id}/questionarios`, { metodo: 'POST', corpo: dados }); avisar({ texto: 'Questionário criado. Junte as perguntas.' }); criado(q) }} />
    </Cartao>
  )
}

// ---------- docente: perguntas, publicação e resultados ----------

function EditorQuestionario({ id, avisar, voltar }) {
  const [q, setQ] = useState(null)
  const falhou = useCallback((e) => avisar({ tipo: 'erro', texto: e.message }), [avisar])
  const carregar = useCallback(() => api(`/questionarios/${id}/edicao`).then(setQ).catch(falhou), [id, falhou])
  useEffect(() => { carregar() }, [carregar])
  if (!q) return <Carregando />
  const bloqueado = q.resultados.length > 0

  const publicar = () => api(`/questionarios/${id}`, { metodo: 'PUT', corpo: { publicado: !q.publicado } })
    .then(() => { avisar({ texto: q.publicado ? 'Questionário escondido dos estudantes.' : 'Questionário publicado.' }); carregar() }).catch(falhou)
  const apagar = () => window.confirm(`Apagar "${q.titulo}" e todas as tentativas?`) && api(`/questionarios/${id}`, { metodo: 'DELETE' }).then(voltar).catch(falhou)
  const apagarPergunta = (p) => api(`/perguntas/${p.id}`, { metodo: 'DELETE' }).then(carregar).catch(falhou)
  const total = q.perguntas.reduce((s, p) => s + p.pontos, 0)

  return (
    <>
      <div className="d-flex gap-2 mb-3 flex-wrap">
        <button type="button" className="btn btn-white" onClick={voltar}><i className="fa fa-arrow-left me-1" /> Questionários</button>
        <button type="button" className={`btn ${q.publicado ? 'btn-white' : 'btn-success'}`} onClick={publicar}><i className={`fa ${q.publicado ? 'fa-eye-slash' : 'fa-eye'} me-1`} />{q.publicado ? 'Esconder' : 'Publicar'}</button>
        <button type="button" className="btn btn-danger ms-auto" onClick={apagar}><i className="fa fa-trash-alt me-1" /> Apagar</button>
      </div>
      <div className="row">
        <div className="col-xl-7">
          <Cartao titulo={<>{q.titulo} {q.publicado ? <span className="badge bg-success ms-2">Publicado</span> : <span className="badge bg-gray-500 ms-2">Rascunho</span>}</>} acoes={<span className="text-white small">{q.perguntas.length} pergunta(s) · {total} pontos</span>}>
            {bloqueado && <div className="alert alert-warning py-2"><i className="fa fa-lock me-1" /> Já há tentativas: as perguntas não podem mudar.</div>}
            {q.perguntas.length === 0 && <Vazio>Junte a primeira pergunta.</Vazio>}
            <ol className="ps-3 mb-0">
              {q.perguntas.map((p) => (
                <li key={p.id} className="mb-3">
                  <div className="d-flex justify-content-between gap-2">
                    <span><b>{p.enunciado}</b> <span className="small text-muted">· {TIPOS[p.tipo]} · {p.pontos} pt</span></span>
                    {!bloqueado && <button type="button" className="btn btn-xs btn-white text-danger" onClick={() => apagarPergunta(p)} aria-label="Apagar pergunta"><i className="fa fa-times" /></button>}
                  </div>
                  <ul className="list-unstyled small mb-0 mt-1">
                    {p.opcoes.map((o, i) => <li key={i} className={o.correta ? 'text-success fw-bold' : 'text-muted'}><i className={`fa ${o.correta ? 'fa-check-circle' : 'fa-circle'} me-1`} />{o.texto}</li>)}
                  </ul>
                </li>
              ))}
            </ol>
          </Cartao>
          {!bloqueado && <NovaPergunta questionarioId={q.id} avisar={avisar} atualizado={carregar} />}
        </div>
        <div className="col-xl-5">
          <Cartao titulo={<><i className="fa fa-cog me-2" />Definições</>}>
            <Definicoes inicial={q} botao="Guardar definições" guardar={async (dados) => { await api(`/questionarios/${id}`, { metodo: 'PUT', corpo: dados }); avisar({ texto: 'Definições guardadas.' }); carregar() }} />
          </Cartao>
          <Cartao titulo={<><i className="fa fa-poll me-2" />Resultados</>} corpo={false}>
            {q.resultados.length === 0 ? <div className="panel-body"><Vazio>Ainda ninguém entregou.</Vazio></div> : (
              <table className="table mb-0">
                <thead><tr><th>Estudante</th><th className="text-center">Tentativa</th><th className="text-end">Nota</th></tr></thead>
                <tbody>
                  {q.resultados.map((r) => (
                    <tr key={r.id}><td>{r.estudante.nome}<div className="small text-muted">{dataHora(r.entregueEm)}</div></td><td className="text-center">{r.numero}</td><td className={`text-end fw-bold ${r.nota < 10 ? 'text-danger' : ''}`}>{nota(r.nota)}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </Cartao>
        </div>
      </div>
    </>
  )
}

function NovaPergunta({ questionarioId, avisar, atualizado }) {
  const vazio = { tipo: 'unica', enunciado: '', pontos: 1, opcoes: [{ texto: '', correta: true }, { texto: '', correta: false }], correta: 'verdadeiro' }
  const [f, setF] = useState(vazio)
  const [erro, setErro] = useState('')
  const mudarOpcao = (i, k, v) => setF({
    ...f,
    opcoes: f.opcoes.map((o, j) => {
      if (k === 'correta' && f.tipo === 'unica') return { ...o, correta: i === j }
      return i === j ? { ...o, [k]: v } : o
    }),
  })
  async function juntar(e) {
    e.preventDefault()
    setErro('')
    try {
      await api(`/questionarios/${questionarioId}/perguntas`, { metodo: 'POST', corpo: f.tipo === 'vf' ? { tipo: 'vf', enunciado: f.enunciado, pontos: f.pontos, correta: f.correta } : f })
      atualizado()
      setF({ ...vazio, tipo: f.tipo })
      avisar({ texto: 'Pergunta juntada.' })
    } catch (falha) {
      setErro(falha.message)
    }
  }
  return (
    <Cartao titulo={<><i className="fa fa-plus me-2" />Nova pergunta</>}>
      <form onSubmit={juntar} className="p-formulario">
        {erro && <p className="p-erro" role="alert">{erro}</p>}
        <div className="row g-2">
          <div className="col-sm-8"><Campo id="np-tipo" rotulo="Tipo"><select id="np-tipo" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>{Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Campo></div>
          <div className="col-sm-4"><Campo id="np-pontos" rotulo="Pontos"><input id="np-pontos" inputMode="decimal" value={f.pontos} onChange={(e) => setF({ ...f, pontos: e.target.value })} /></Campo></div>
        </div>
        <Campo id="np-enunciado" rotulo="Enunciado"><textarea id="np-enunciado" rows={2} value={f.enunciado} onChange={(e) => setF({ ...f, enunciado: e.target.value })} required /></Campo>
        {f.tipo === 'vf' ? (
          <Campo id="np-vf" rotulo="Resposta certa">
            <select id="np-vf" value={f.correta} onChange={(e) => setF({ ...f, correta: e.target.value })}><option value="verdadeiro">Verdadeiro</option><option value="falso">Falso</option></select>
          </Campo>
        ) : (
          <div>
            <span className="form-label fw-bold d-block mb-1">Opções <small className="text-muted fw-normal">(marque {f.tipo === 'unica' ? 'a certa' : 'as certas'})</small></span>
            {f.opcoes.map((o, i) => (
              <div key={i} className="d-flex gap-2 align-items-center mb-1">
                <input type={f.tipo === 'unica' ? 'radio' : 'checkbox'} name="np-certa" checked={o.correta} onChange={(e) => mudarOpcao(i, 'correta', e.target.checked)} aria-label={`Opção ${i + 1} certa`} />
                <input className="form-control form-control-sm" value={o.texto} onChange={(e) => mudarOpcao(i, 'texto', e.target.value)} placeholder={`Opção ${i + 1}`} aria-label={`Opção ${i + 1}`} required />
                {f.opcoes.length > 2 && <button type="button" className="btn btn-xs btn-white" onClick={() => setF({ ...f, opcoes: f.opcoes.filter((_, j) => j !== i) })} aria-label="Retirar opção"><i className="fa fa-times" /></button>}
              </div>
            ))}
            {f.opcoes.length < 8 && <button type="button" className="btn btn-xs btn-white mt-1" onClick={() => setF({ ...f, opcoes: [...f.opcoes, { texto: '', correta: false }] })}><i className="fa fa-plus me-1" />Opção</button>}
          </div>
        )}
        <div><button type="submit" className="btn btn-theme">Juntar pergunta</button></div>
      </form>
    </Cartao>
  )
}

// ---------- estudante: responder com tempo e rever ----------

function Realizar({ id, avisar, recarregar, voltar }) {
  const [q, setQ] = useState(null)
  const [tentativa, setTentativa] = useState(null)
  const [respostas, setRespostas] = useState({})
  const [resultado, setResultado] = useState(null)
  const [resta, setResta] = useState(null)
  const guardarT = useRef(null)
  const entregando = useRef(false)
  const falhou = useCallback((e) => avisar({ tipo: 'erro', texto: e.message }), [avisar])
  const carregar = useCallback(() => api(`/questionarios/${id}`).then((r) => {
    setQ(r)
    if (r.emCurso) { setTentativa(r.emCurso); setRespostas(r.emCurso.respostas || {}) }
  }).catch(falhou), [id, falhou])
  useEffect(() => { carregar() }, [carregar])

  const entregar = useCallback(async (confirmar = true) => {
    if (!tentativa || entregando.current) return
    if (confirmar && !window.confirm('Entregar o questionário? Depois não pode mudar as respostas.')) return
    entregando.current = true
    clearTimeout(guardarT.current)
    try {
      setResultado(await api(`/tentativas/${tentativa.id}/entrega`, { metodo: 'POST', corpo: { respostas } }))
      setTentativa(null)
      carregar()
      recarregar?.() // o progresso da cadeira conta o questionário feito
    } catch (e) {
      falhou(e)
    } finally {
      entregando.current = false
    }
  }, [tentativa, respostas, carregar, recarregar, falhou])

  // cronómetro: no fim do tempo entrega sozinho (o servidor só aceita o que chegou a tempo)
  useEffect(() => {
    if (!tentativa?.limite) return undefined
    const passo = () => {
      const s = Math.max(0, Math.round((new Date(tentativa.limite) - Date.now()) / 1000))
      setResta(s)
      if (s === 0) entregar(false)
    }
    passo()
    const t = setInterval(passo, 1000)
    return () => clearInterval(t)
  }, [tentativa, entregar])

  function escolher(p, i, marcado) {
    const atual = respostas[p.id] || []
    const nova = { ...respostas, [p.id]: p.tipo === 'multipla' ? (marcado ? [...atual, i] : atual.filter((x) => x !== i)) : [i] }
    setRespostas(nova)
    clearTimeout(guardarT.current)
    guardarT.current = setTimeout(() => api(`/tentativas/${tentativa.id}/respostas`, { metodo: 'PUT', corpo: { respostas: nova } }).catch(() => {}), 800)
  }

  if (!q) return <Carregando />
  const respondidas = tentativa ? tentativa.perguntas.filter((p) => respostas[p.id]?.length).length : 0

  if (tentativa) {
    return (
      <>
        <div className="d-flex align-items-center gap-3 mb-3 flex-wrap sticky-top bg-body py-2" style={{ top: 60 }}>
          <h2 className="h5 mb-0 flex-grow-1">{q.titulo} <small className="text-muted">· tentativa {tentativa.numero}</small></h2>
          <span className="small text-muted">{respondidas} de {tentativa.perguntas.length} respondidas</span>
          {resta !== null && <span className={`badge fs-14px ${resta < 60 ? 'bg-danger' : 'bg-dark'}`}><i className="fa fa-clock me-1" />{String(Math.floor(resta / 60)).padStart(2, '0')}:{String(resta % 60).padStart(2, '0')}</span>}
          <button type="button" className="btn btn-theme" onClick={() => entregar(true)}><i className="fa fa-paper-plane me-1" /> Entregar</button>
        </div>
        {tentativa.perguntas.map((p, n) => (
          <Cartao key={p.id} titulo={`Pergunta ${n + 1}`} acoes={<span className="text-white small">{p.pontos} pt · {TIPOS[p.tipo]}</span>}>
            <p className="fw-bold">{p.enunciado}</p>
            {p.opcoes.map((o, i) => (
              <label key={i} className="d-flex gap-2 align-items-center py-1">
                <input type={p.tipo === 'multipla' ? 'checkbox' : 'radio'} name={`p-${p.id}`} checked={(respostas[p.id] || []).includes(i)} onChange={(e) => escolher(p, i, e.target.checked)} />
                {o}
              </label>
            ))}
          </Cartao>
        ))}
        <p className="p-legenda">As respostas são gravadas automaticamente. No fim do tempo o questionário é entregue sozinho.</p>
      </>
    )
  }

  const podeComecar = q.estado === 'aberto' && q.feitas.length < q.tentativas
  return (
    <>
      <button type="button" className="btn btn-white mb-3" onClick={voltar}><i className="fa fa-arrow-left me-1" /> Questionários</button>
      {resultado && (
        <div className={`alert ${resultado.nota >= 10 ? 'alert-success' : 'alert-danger'}`}>
          <h4 className="alert-heading mb-1">Nota: {nota(resultado.nota)} valores</h4>
          {resultado.obtidos} de {resultado.total} pontos.{resultado.foraDeTempo && ' O tempo terminou: contaram as respostas gravadas até ao fim.'}
        </div>
      )}
      <Cartao titulo={q.titulo}>
        {q.descricao && <p className="p-texto-pre">{q.descricao}</p>}
        <dl className="p-ficha">
          <div><dt>Perguntas</dt><dd>{q.numeroPerguntas} ({q.pontos} pontos)</dd></div>
          <div><dt>Duração</dt><dd>{q.duracao ? `${q.duracao} minutos` : 'Sem limite'}</dd></div>
          <div><dt>Abre / fecha</dt><dd>{q.abre ? dataHora(q.abre) : '—'} / {q.fecha ? dataHora(q.fecha) : 'sem prazo'}</dd></div>
          <div><dt>Tentativas</dt><dd>{q.feitas.length} de {q.tentativas}</dd></div>
        </dl>
        {q.feitas.length > 0 && (
          <table className="table table-sm mt-3 mb-0">
            <thead><tr><th>Tentativa</th><th>Entregue</th><th className="text-end">Nota</th><th /></tr></thead>
            <tbody>{q.feitas.map((t) => <LinhaTentativa key={t.id} t={t} falhou={falhou} />)}</tbody>
          </table>
        )}
        <div className="mt-3">
          {podeComecar
            ? <button type="button" className="btn btn-theme" onClick={() => api(`/questionarios/${id}/tentativas`, { metodo: 'POST' }).then((t) => { setResultado(null); setTentativa(t); setRespostas(t.respostas || {}) }).catch(falhou)}><i className="fa fa-play me-1" /> {q.feitas.length ? 'Nova tentativa' : 'Começar'}</button>
            : <span className="text-muted">{q.estado === 'em_breve' ? 'Ainda não abriu.' : q.estado === 'fechado' ? 'O questionário fechou.' : 'Já usou todas as tentativas.'}</span>}
        </div>
      </Cartao>
    </>
  )
}

function LinhaTentativa({ t, falhou }) {
  const [rev, setRev] = useState(null)
  return (
    <>
      <tr>
        <td>{t.numero}</td><td className="small">{dataHora(t.entregueEm)}</td><td className="text-end fw-bold">{nota(t.nota)}</td>
        <td className="text-end"><button type="button" className="btn btn-xs btn-white" onClick={() => (rev ? setRev(null) : api(`/tentativas/${t.id}`).then(setRev).catch(falhou))}>{rev ? 'Fechar' : 'Rever'}</button></td>
      </tr>
      {rev && (
        <tr><td colSpan={4}>
          {rev.perguntas.map((p, n) => {
            const c = rev.correcao?.find((x) => x.perguntaId === p.id)
            const minhas = rev.tentativa.respostas[p.id] || []
            return (
              <div key={p.id} className="mb-2">
                <div className="fw-bold">{n + 1}. {p.enunciado} {c && (c.certa ? <i className="fa fa-check text-success" /> : <i className="fa fa-times text-danger" />)}</div>
                {p.opcoes.map((o, i) => (
                  <div key={i} className={`small ${c?.corretas.includes(i) ? 'text-success fw-bold' : minhas.includes(i) ? 'text-danger' : 'text-muted'}`}>
                    <i className={`fa ${minhas.includes(i) ? 'fa-dot-circle' : 'fa-circle'} me-1`} />{o}
                  </div>
                ))}
              </div>
            )
          })}
          {!rev.correcao && <p className="small text-muted mb-0">O docente não mostra as respostas certas.</p>}
        </td></tr>
      )}
    </>
  )
}

export default Questionarios
