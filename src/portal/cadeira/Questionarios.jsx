import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { Bloqueio, Campo, Cartao, Carregando, Erro, Etiqueta, Vazio } from '../componentes'
import { dataHora, localParaIso, nota, paraLocal } from '../formatar'
import FormPergunta, { SolucaoPergunta } from './FormPergunta'
import { TIPOS_PERGUNTA as TIPOS } from './tiposPergunta'
import { BancoJanela } from './Banco'
import { confirmar as perguntar, pedir } from '../dialogos'
import { t as tx } from '../../i18n/linguas'
const ESTADOS = { em_breve: ['azul', tx('Abre em breve')], aberto: ['verde', tx('Aberto')], fechado: ['cinzento', tx('Fechado')] }
// ISO → valor de <input type="datetime-local"> na hora local

// questionários online da cadeira (como os do Moodle)
function Questionarios(props) {
  const [aberto, setAberto] = useState(props.so ?? null)
  const voltar = props.voltar || (() => setAberto(null))
  if (aberto) {
    const bloqueio = !props.eDocente && props.c.questionarios.find((x) => x.id === aberto)?.bloqueio
    if (bloqueio) {
      return (
        <Cartao titulo={<><i className="fa fa-question-circle me-2" />{props.c.questionarios.find((x) => x.id === aberto).titulo}</>}>
          <Bloqueio motivos={bloqueio} />
          <button type="button" className="btn btn-white mt-3" onClick={voltar}><i className="fa fa-arrow-left me-1" />{tx('Voltar')}</button>
        </Cartao>
      )
    }
    return props.eDocente
      ? <EditorQuestionario id={aberto} avisar={props.avisar} voltar={voltar} />
      : <Realizar id={aberto} avisar={props.avisar} recarregar={props.recarregar} voltar={voltar} />
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
      <Cartao titulo={<><i className="fa fa-question-circle me-2" />{tx('Questionários')}</>} corpo={false}>
        {lista.length === 0 ? <div className="panel-body"><Vazio>{eDocente ? tx('Ainda não criou questionários.') : tx('Não há questionários publicados.')}</Vazio></div> : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead><tr><th>{tx('Questionário')}</th><th>{tx('Fecha')}</th><th className="text-center">{tx('Duração')}</th>{eDocente ? <th className="text-center">{tx('Estado')}</th> : <><th className="text-center">{tx('Tentativas')}</th><th className="text-center">{tx('Melhor nota')}</th></>}<th /></tr></thead>
              <tbody>
                {lista.map((q) => (
                  <tr key={q.id}>
                    <td><span className="fw-bold">{q.titulo}</span><div className="small text-muted">{q.numeroPerguntas} {tx('pergunta(s)')}</div></td>
                    <td className="small">{q.fecha ? dataHora(q.fecha) : tx('Sem prazo')}</td>
                    <td className="text-center small">{q.duracao ? tx('{0} min', { 0: q.duracao }) : tx('Livre')}</td>
                    {eDocente ? (
                      <td className="text-center">{q.publicado ? <Etiqueta cor="verde">{tx('Publicado')}</Etiqueta> : <Etiqueta>{tx('Rascunho')}</Etiqueta>}</td>
                    ) : (
                      <>
                        <td className="text-center small">{q.feitas} / {q.tentativas}</td>
                        <td className="text-center fw-bold">{nota(q.melhorNota)}</td>
                      </>
                    )}
                    <td className="text-end text-nowrap">
                      {!eDocente && <span className="me-2"><Etiqueta cor={ESTADOS[q.estado][0]}>{ESTADOS[q.estado][1]}</Etiqueta></span>}
                      <button type="button" className="btn btn-sm btn-theme" onClick={() => abrir(q.id)}>{eDocente ? tx('Editar') : tx('Abrir')}</button>
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
    baralhar: inicial?.baralhar ?? false, perguntasPorTentativa: inicial?.perguntasPorTentativa ?? 0,
  })
  const [erro, setErro] = useState('')
  async function submeter(e) {
    e.preventDefault()
    setErro('')
    try {
      await guardar({ ...f, abre: f.abre ? localParaIso(f.abre) : null, fecha: f.fecha ? localParaIso(f.fecha) : null, duracao: Number(f.duracao || 0), tentativas: Number(f.tentativas || 1), perguntasPorTentativa: Number(f.perguntasPorTentativa || 0) })
    } catch (falha) {
      setErro(falha.message)
    }
  }
  return (
    <form onSubmit={submeter} className="p-formulario">
      {erro && <p className="p-erro" role="alert">{erro}</p>}
      <Campo id="q-titulo" rotulo={tx('Título')}><input id="q-titulo" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} maxLength={200} required /></Campo>
      <Campo id="q-desc" rotulo={tx('Instruções (opcional)')}><textarea id="q-desc" rows={2} value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} /></Campo>
      <div className="row g-2">
        <div className="col-sm-6"><Campo id="q-abre" rotulo={tx('Abre em')}><input id="q-abre" type="datetime-local" value={f.abre} onChange={(e) => setF({ ...f, abre: e.target.value })} /></Campo></div>
        <div className="col-sm-6"><Campo id="q-fecha" rotulo={tx('Fecha em')}><input id="q-fecha" type="datetime-local" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></Campo></div>
        <div className="col-sm-6"><Campo id="q-duracao" rotulo={tx('Duração (min, 0 = livre)')}><input id="q-duracao" type="number" min={0} max={600} value={f.duracao} onChange={(e) => setF({ ...f, duracao: e.target.value })} /></Campo></div>
        <div className="col-sm-6"><Campo id="q-tent" rotulo={tx('Tentativas')}><input id="q-tent" type="number" min={1} max={10} value={f.tentativas} onChange={(e) => setF({ ...f, tentativas: e.target.value })} /></Campo></div>
      </div>
      <label className="p-caixa"><input type="checkbox" checked={f.mostrarRespostas} onChange={(e) => setF({ ...f, mostrarRespostas: e.target.checked })} /> {tx('Mostrar as respostas certas depois da entrega')}</label>
      <label className="p-caixa"><input type="checkbox" checked={f.baralhar} onChange={(e) => setF({ ...f, baralhar: e.target.checked })} /> {tx('Baralhar as perguntas e as opções em cada tentativa')}</label>
      <Campo id="q-sorteio" rotulo={tx('Perguntas sorteadas por tentativa (0 = todas)')} ajuda={tx('Com um conjunto grande de perguntas, cada estudante recebe só algumas, ao acaso.')}>
        <input id="q-sorteio" type="number" min={0} max={200} value={f.perguntasPorTentativa} onChange={(e) => setF({ ...f, perguntasPorTentativa: e.target.value })} />
      </Campo>
      <div><button type="submit" className="btn btn-theme">{botao}</button></div>
    </form>
  )
}

function NovoQuestionario({ c, avisar, criado }) {
  return (
    <Cartao titulo={<><i className="fa fa-plus me-2" />{tx('Novo questionário')}</>}>
      <Definicoes botao={tx('Criar e juntar perguntas')} guardar={async (dados) => { const q = await api(`/cadeiras/${c.id}/questionarios`, { metodo: 'POST', corpo: dados }); avisar({ texto: tx('Questionário criado. Junte as perguntas.') }); criado(q) }} />
    </Cartao>
  )
}

// ---------- docente: perguntas, publicação e resultados ----------

function EditorQuestionario({ id, avisar, voltar }) {
  const [q, setQ] = useState(null)
  const [vista, setVista] = useState('perguntas')
  const [banco, setBanco] = useState(false)
  const [corrigir, setCorrigir] = useState(null) // tentativa a corrigir
  const falhou = useCallback((e) => avisar({ tipo: 'erro', texto: e.message }), [avisar])
  const carregar = useCallback(() => api(`/questionarios/${id}/edicao`).then(setQ).catch(falhou), [id, falhou])
  useEffect(() => { carregar() }, [carregar])
  if (!q) return <Carregando />
  const bloqueado = q.resultados.length > 0
  const porCorrigir = q.resultados.filter((r) => r.porCorrigir).length

  const publicar = () => api(`/questionarios/${id}`, { metodo: 'PUT', corpo: { publicado: !q.publicado } })
    .then(() => { avisar({ texto: q.publicado ? tx('Questionário escondido dos estudantes.') : tx('Questionário publicado.') }); carregar() }).catch(falhou)
  const apagar = async () => (await perguntar(tx('Apagar "{0}" e todas as tentativas?', { 0: q.titulo }), { titulo: tx('Apagar questionário'), botao: tx('Apagar'), perigo: true })) && api(`/questionarios/${id}`, { metodo: 'DELETE' }).then(voltar).catch(falhou)
  const apagarPergunta = (p) => api(`/perguntas/${p.id}`, { metodo: 'DELETE' }).then(carregar).catch(falhou)
  const paraBanco = async (p) => {
    const categoria = await pedir(tx('Categoria no banco de perguntas'), tx('Geral'), { botao: tx('Guardar no banco') })
    if (categoria === null) return
    api(`/perguntas/${p.id}/banco`, { metodo: 'POST', corpo: { categoria } }).then(() => avisar({ texto: tx('Pergunta guardada no seu banco.') })).catch(falhou)
  }
  const total = q.perguntas.reduce((s, p) => s + p.pontos, 0)
  const separadores = [['perguntas', 'fa-list-ol', tx('Perguntas ({0})', { 0: q.perguntas.length })], ['resultados', 'fa-poll', tx('Resultados ({0})', { 0: q.resultados.length })], ['estatisticas', 'fa-chart-bar', tx('Estatísticas')], ['definicoes', 'fa-cog', tx('Definições')]]

  return (
    <>
      <div className="d-flex gap-2 mb-3 flex-wrap">
        <button type="button" className="btn btn-white" onClick={voltar}><i className="fa fa-arrow-left me-1" /> {tx('Voltar à cadeira')}</button>
        <button type="button" className={`btn ${q.publicado ? 'btn-white' : 'btn-success'}`} onClick={publicar}><i className={`fa ${q.publicado ? 'fa-eye-slash' : 'fa-eye'} me-1`} />{q.publicado ? tx('Esconder') : tx('Publicar')}</button>
        <button type="button" className="btn btn-danger ms-auto" onClick={apagar}><i className="fa fa-trash-alt me-1" /> {tx('Apagar')}</button>
      </div>
      <ul className="nav nav-tabs">
        {separadores.map(([k, icone, texto]) => (
          <li key={k} className="nav-item">
            <button type="button" className={`nav-link ${vista === k ? 'active' : ''}`} onClick={() => setVista(k)}>
              <i className={`fa ${icone} me-1`} />{texto}{k === 'resultados' && porCorrigir > 0 && <span className="badge bg-danger ms-1">{porCorrigir} {tx('por corrigir')}</span>}
            </button>
          </li>
        ))}
      </ul>
      <div className="tab-content panel rounded-0 rounded-bottom p-3 mb-4">
        {vista === 'perguntas' && (
          <div className="row">
            <div className="col-xl-7">
              <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
                <h3 className="h5 mb-0 flex-grow-1">{q.titulo} {q.publicado ? <span className="badge bg-success ms-1">{tx('Publicado')}</span> : <span className="badge bg-gray-500 ms-1">{tx('Rascunho')}</span>}</h3>
                <span className="small text-muted">{q.perguntas.length} {tx('pergunta(s) ·')} {nota(total)} {tx('pontos')}{q.perguntasPorTentativa > 0 && tx(' · {0} sorteadas por tentativa', { 0: q.perguntasPorTentativa })}{q.baralhar && tx(' · baralhado')}</span>
              </div>
              {bloqueado && <div className="alert alert-warning py-2"><i className="fa fa-lock me-1" /> {tx('Já há tentativas: as perguntas não podem mudar.')}</div>}
              {q.perguntas.length === 0 && <Vazio>{tx('Junte a primeira pergunta (escreva-a ou traga-a do seu banco de perguntas).')}</Vazio>}
              <ol className="ps-3 mb-0">
                {q.perguntas.map((p) => (
                  <li key={p.id} className="mb-3">
                    <div className="d-flex justify-content-between gap-2">
                      <span><b>{p.enunciado}</b> <span className="small text-muted">· {TIPOS[p.tipo]} · {nota(p.pontos)} {tx('pt')}</span></span>
                      <span className="text-nowrap">
                        <button type="button" className="btn btn-xs btn-white me-1" onClick={() => paraBanco(p)} title={tx('Guardar no banco de perguntas')} aria-label={tx('Guardar no banco')}><i className="fa fa-archive" /></button>
                        {!bloqueado && <button type="button" className="btn btn-xs btn-white text-danger" onClick={() => apagarPergunta(p)} aria-label={tx('Apagar pergunta')}><i className="fa fa-times" /></button>}
                      </span>
                    </div>
                    <SolucaoPergunta p={p} />
                  </li>
                ))}
              </ol>
            </div>
            <div className="col-xl-5">
              {!bloqueado && (
                <>
                  <button type="button" className="btn btn-white w-100 mb-3" onClick={() => setBanco(true)}><i className="fa fa-archive me-1" /> {tx('Juntar do meu banco de perguntas')}</button>
                  <Cartao titulo={<><i className="fa fa-plus me-2" />{tx('Nova pergunta')}</>}>
                    <FormPergunta guardar={async (corpo) => { await api(`/questionarios/${q.id}/perguntas`, { metodo: 'POST', corpo }); avisar({ texto: tx('Pergunta juntada.') }); carregar() }} />
                  </Cartao>
                </>
              )}
            </div>
          </div>
        )}
        {vista === 'resultados' && (
          q.resultados.length === 0 ? <Vazio>{tx('Ainda ninguém entregou.')}</Vazio> : (
            <table className="table table-hover align-middle mb-0">
              <thead><tr><th>{tx('Estudante')}</th><th className="text-center">{tx('Tentativa')}</th><th>{tx('Entregue')}</th><th className="text-end">{tx('Nota')}</th><th /></tr></thead>
              <tbody>
                {q.resultados.map((r) => (
                  <tr key={r.id}>
                    <td className="fw-bold">{r.estudante.nome}</td><td className="text-center">{r.numero}</td><td className="small">{dataHora(r.entregueEm)}</td>
                    <td className={`text-end fw-bold ${r.nota !== null && r.nota < 10 ? 'text-danger' : ''}`}>{r.porCorrigir ? <span className="badge bg-warning text-dark">{tx('Por corrigir')}</span> : nota(r.nota)}</td>
                    <td className="text-end"><button type="button" className={`btn btn-sm ${r.porCorrigir ? 'btn-theme' : 'btn-white'}`} onClick={() => setCorrigir(r.id)}>{r.porCorrigir ? tx('Corrigir') : tx('Ver')}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
        {vista === 'estatisticas' && <Estatisticas id={q.id} perguntas={q.perguntas} falhou={falhou} />}
        {vista === 'definicoes' && <Definicoes inicial={q} botao={tx('Guardar definições')} guardar={async (dados) => { await api(`/questionarios/${id}`, { metodo: 'PUT', corpo: dados }); avisar({ texto: tx('Definições guardadas.') }); carregar() }} />}
      </div>
      {banco && <BancoJanela fechar={() => setBanco(false)} juntar={async (ids) => { await api(`/questionarios/${q.id}/do-banco`, { metodo: 'POST', corpo: { ids } }); avisar({ texto: tx('{0} pergunta(s) juntada(s) do banco.', { 0: ids.length }) }); setBanco(false); carregar() }} />}
      {corrigir && <CorrigirTentativa id={corrigir} avisar={avisar} fechar={() => { setCorrigir(null); carregar() }} />}
    </>
  )
}

// a resposta dada a uma pergunta, em texto legível (correção do docente)
function RespostaDada({ p, x }) {
  const dada = x?.dada
  if (dada === null || dada === undefined) return <span className="text-muted fst-italic">{tx('Sem resposta')}</span>
  if (p.tipo === 'correspondencia') return <span>{p.opcoes.pares.map((par, i) => <span key={i} className="d-block">{par.a} → {dada[i] === null || dada[i] === undefined ? '—' : p.opcoes.pares[dada[i]]?.b}</span>)}</span>
  if (Array.isArray(dada)) return <span>{dada.map((i) => p.opcoes[i]?.texto ?? i).join(' · ')}</span>
  return <span className="p-texto-pre">{String(dada)}</span>
}

// docente: corrigir à mão as dissertações de uma tentativa (e ver as restantes respostas)
function CorrigirTentativa({ id, avisar, fechar }) {
  const [d, setD] = useState(null)
  const [pontos, setPontos] = useState({})
  const [comentario, setComentario] = useState('')
  useEffect(() => {
    api(`/tentativas/${id}/correcao`).then((r) => {
      setD(r)
      setPontos(r.tentativa.manuais || {})
      setComentario(r.tentativa.comentario || '')
    }).catch((e) => avisar({ tipo: 'erro', texto: e.message }))
  }, [id, avisar])

  async function guardar() {
    try {
      const r = await api(`/tentativas/${id}/correcao`, { metodo: 'PUT', corpo: { pontos, comentario } })
      avisar({ texto: r.porCorrigir ? tx('Guardado. Ainda faltam dissertações.') : tx('Corrigido: {0} valores. O estudante foi avisado.', { 0: nota(r.nota) }) })
      fechar()
    } catch (e) {
      avisar({ tipo: 'erro', texto: e.message })
    }
  }

  return (
    <>
      <div className="modal d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="corrigir-t" onClick={fechar}>
        <div className="modal-dialog modal-lg modal-dialog-scrollable" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title" id="corrigir-t"><i className="fa fa-pen me-2" />{d ? `${d.estudante?.nome || tx('Tentativa')} — ${d.questionario.titulo}` : tx('A carregar…')}</h4>
              <button type="button" className="btn-close" onClick={fechar} aria-label={tx('Fechar')} />
            </div>
            {d && (
              <div className="modal-body">
                {d.perguntas.map((p, n) => {
                  const x = d.detalhe.find((y) => y.perguntaId === p.id)
                  return (
                    <div key={p.id} className="mb-3 pb-3 border-bottom">
                      <div className="d-flex justify-content-between gap-2"><b>{n + 1}. {p.enunciado}</b><span className="small text-muted text-nowrap">{TIPOS[p.tipo]}</span></div>
                      <div className="my-1"><RespostaDada p={p} x={x} /></div>
                      {p.tipo === 'dissertacao' ? (
                        <div className="d-flex align-items-center gap-2">
                          <label className="small fw-bold" htmlFor={`pd-${p.id}`}>{tx('Pontos')}</label>
                          <input id={`pd-${p.id}`} className="form-control form-control-sm" style={{ width: 80 }} inputMode="decimal" value={pontos[p.id] ?? ''} onChange={(e) => setPontos({ ...pontos, [p.id]: e.target.value })} />
                          <span className="small text-muted">{tx('de')} {nota(p.pontos)}</span>
                        </div>
                      ) : <span className={`badge ${x.certa ? 'bg-success' : x.obtidos > 0 ? 'bg-warning text-dark' : 'bg-danger'}`}>{nota(x.obtidos)} / {nota(p.pontos)} {tx('pt')}</span>}
                    </div>
                  )
                })}
                <label className="form-label fw-bold" htmlFor="ct-coment">{tx('Comentário para o estudante')}</label>
                <textarea id="ct-coment" className="form-control" rows={2} value={comentario} onChange={(e) => setComentario(e.target.value)} />
              </div>
            )}
            <div className="modal-footer">
              <button type="button" className="btn btn-white" onClick={fechar}>{tx('Fechar')}</button>
              <button type="button" className="btn btn-theme" onClick={guardar} disabled={!d}><i className="fa fa-save me-1" />{tx('Guardar correção')}</button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  )
}

// estatísticas do questionário (como o relatório do Moodle)
function Estatisticas({ id, perguntas, falhou }) {
  const [e, setE] = useState(null)
  useEffect(() => { api(`/questionarios/${id}/estatisticas`).then(setE).catch(falhou) }, [id, falhou])
  if (!e) return <Carregando />
  if (!e.tentativas) return <Vazio>{tx('Ainda não há tentativas entregues.')}</Vazio>
  const cor = (f) => (f === null ? 'bg-gray-400' : f >= 70 ? 'bg-success' : f >= 40 ? 'bg-warning' : 'bg-danger')
  return (
    <>
      <div className="row g-2 mb-3">
        {[[tx('Tentativas'), e.tentativas], [tx('Média'), nota(e.media)], [tx('Mediana'), nota(e.mediana)], [tx('Máxima'), nota(e.maxima)], [tx('Mínima'), nota(e.minima)]].map(([k, v]) => (
          <div key={k} className="col"><div className="border rounded p-2 text-center"><div className="small text-muted">{k}</div><div className="fs-18px fw-bold">{v}</div></div></div>
        ))}
      </div>
      <table className="table table-bordered align-middle mb-0">
        <thead><tr><th>{tx('Pergunta')}</th><th className="text-center">{tx('Respostas')}</th><th style={{ width: 220 }}>{tx('Facilidade (média dos pontos)')}</th></tr></thead>
        <tbody>
          {e.porPergunta.map((p, n) => {
            const original = perguntas.find((x) => x.id === p.perguntaId)
            return (
              <tr key={p.perguntaId}>
                <td>
                  <b>{n + 1}.</b> {p.enunciado} <span className="small text-muted">· {TIPOS[p.tipo]}</span>
                  {p.escolhas && original && (
                    <div className="mt-1">
                      {original.opcoes.map((o, i) => (
                        <div key={i} className="d-flex align-items-center gap-2 small">
                          <span className={`text-truncate ${o.correta ? 'text-success fw-bold' : ''}`} style={{ width: 200 }}>{o.correta && <i className="fa fa-check me-1" />}{o.texto}</span>
                          <div className="progress flex-grow-1" style={{ height: 6 }}><div className={`progress-bar ${o.correta ? 'bg-success' : 'bg-gray-500'}`} style={{ width: `${p.respondidas ? (p.escolhas[i] / p.respondidas) * 100 : 0}%` }} /></div>
                          <span className="text-muted" style={{ width: 24 }}>{p.escolhas[i]}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td className="text-center">{p.respondidas}</td>
                <td>
                  {p.facilidade === null ? <span className="small text-muted">{tx('Por corrigir')}</span> : (
                    <div className="d-flex align-items-center gap-2"><div className="progress flex-grow-1" style={{ height: 8 }}><div className={`progress-bar ${cor(p.facilidade)}`} style={{ width: `${p.facilidade}%` }} /></div><b className="small">{p.facilidade}%</b></div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="p-legenda">{tx('Facilidade baixa (vermelho) indica uma pergunta difícil ou mal formulada; nas de escolha, veja que opções enganaram mais.')}</p>
    </>
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
  const [erroCarga, setErroCarga] = useState('')
  const carregar = useCallback(() => api(`/questionarios/${id}`).then((r) => {
    setQ(r)
    if (r.emCurso) { setTentativa(r.emCurso); setRespostas(r.emCurso.respostas || {}) }
  }).catch((e) => setErroCarga(e.message)), [id])
  useEffect(() => { carregar() }, [carregar])

  const entregar = useCallback(async (confirmar = true) => {
    if (!tentativa || entregando.current) return
    if (confirmar && !(await perguntar(tx('Entregar o questionário? Depois não pode mudar as respostas.'), { titulo: tx('Entregar'), botao: tx('Entregar') }))) return
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

  // muda a resposta de uma pergunta e grava (com uma pequena espera, enquanto se escreve)
  function responder(p, valor) {
    const nova = { ...respostas, [p.id]: valor }
    setRespostas(nova)
    clearTimeout(guardarT.current)
    guardarT.current = setTimeout(() => api(`/tentativas/${tentativa.id}/respostas`, { metodo: 'PUT', corpo: { respostas: nova } }).catch(() => {}), 800)
  }
  const escolher = (p, i, marcado) => {
    const atual = respostas[p.id] || []
    responder(p, p.tipo === 'multipla' ? (marcado ? [...atual, i] : atual.filter((x) => x !== i)) : [i])
  }
  const respondida = (p) => {
    const v = respostas[p.id]
    return Array.isArray(v) ? v.some((x) => x !== null && x !== undefined) : v !== undefined && String(v).trim() !== ''
  }

  if (erroCarga) return <><Erro texto={erroCarga} /><button type="button" className="btn btn-white" onClick={voltar}><i className="fa fa-arrow-left me-1" />{tx('Voltar')}</button></>
  if (!q) return <Carregando />
  const respondidas = tentativa ? tentativa.perguntas.filter(respondida).length : 0

  if (tentativa) {
    return (
      <>
        <div className="d-flex align-items-center gap-3 mb-3 flex-wrap sticky-top bg-body py-2" style={{ top: 60 }}>
          <h2 className="h5 mb-0 flex-grow-1">{q.titulo} <small className="text-muted">{tx('· tentativa')} {tentativa.numero}</small></h2>
          <span className="small text-muted">{respondidas} {tx('de')} {tentativa.perguntas.length} {tx('respondidas')}</span>
          {resta !== null && <span className={`badge fs-14px ${resta < 60 ? 'bg-danger' : 'bg-dark'}`}><i className="fa fa-clock me-1" />{String(Math.floor(resta / 60)).padStart(2, '0')}:{String(resta % 60).padStart(2, '0')}</span>}
          <button type="button" className="btn btn-theme" onClick={() => entregar(true)}><i className="fa fa-paper-plane me-1" /> {tx('Entregar')}</button>
        </div>
        {tentativa.perguntas.map((p, n) => (
          <Cartao key={p.id} titulo={tx('Pergunta {0}', { 0: n + 1 })} acoes={<span className="text-white small">{p.pontos} {tx('pt ·')} {TIPOS[p.tipo]}</span>}>
            <p className="fw-bold">{p.enunciado}</p>
            {p.opcoes && p.opcoes.map((o) => (
              <label key={o.i} className="d-flex gap-2 align-items-center py-1">
                <input type={p.tipo === 'multipla' ? 'checkbox' : 'radio'} className="form-check-input mt-0" name={`p-${p.id}`} checked={(respostas[p.id] || []).includes(o.i)} onChange={(e) => escolher(p, o.i, e.target.checked)} />
                {o.texto}
              </label>
            ))}
            {p.tipo === 'curta' && <input className="form-control" style={{ maxWidth: 420 }} value={respostas[p.id] ?? ''} onChange={(e) => responder(p, e.target.value)} aria-label={tx('Resposta à pergunta {0}', { 0: n + 1 })} placeholder={tx('A sua resposta')} />}
            {p.tipo === 'numerica' && <input className="form-control" style={{ maxWidth: 220 }} inputMode="decimal" value={respostas[p.id] ?? ''} onChange={(e) => responder(p, e.target.value)} aria-label={tx('Resposta à pergunta {0}', { 0: n + 1 })} placeholder={tx('Número')} />}
            {p.tipo === 'correspondencia' && (
              <table className="table table-sm align-middle mb-0" style={{ maxWidth: 640 }}>
                <tbody>
                  {p.itens.map((item, k) => (
                    <tr key={k}>
                      <td className="fw-bold">{item}</td>
                      <td style={{ width: '55%' }}>
                        <select className="form-select form-select-sm" value={respostas[p.id]?.[k] ?? ''} aria-label={tx('Correspondência de {0}', { 0: item })}
                          onChange={(e) => { const atual = [...(respostas[p.id] || p.itens.map(() => null))]; atual[k] = e.target.value === '' ? null : Number(e.target.value); responder(p, atual) }}>
                          <option value="">{tx('Escolha…')}</option>
                          {p.escolhas.map((x) => <option key={x.i} value={x.i}>{x.texto}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {p.tipo === 'dissertacao' && (
              <>
                {p.orientacao && <p className="small text-muted">{p.orientacao}</p>}
                <textarea className="form-control" rows={8} value={respostas[p.id] ?? ''} onChange={(e) => responder(p, e.target.value)} aria-label={tx('Resposta à pergunta {0}', { 0: n + 1 })} />
                <div className="small text-muted mt-1">{String(respostas[p.id] ?? '').trim() ? String(respostas[p.id]).trim().split(/\s+/).length : 0} {tx('palavras · corrigida pelo docente')}</div>
              </>
            )}
          </Cartao>
        ))}
        <p className="p-legenda">{tx('As respostas são gravadas automaticamente. No fim do tempo o questionário é entregue sozinho.')}</p>
      </>
    )
  }

  const podeComecar = q.estado === 'aberto' && q.feitas.length < q.tentativas
  return (
    <>
      <button type="button" className="btn btn-white mb-3" onClick={voltar}><i className="fa fa-arrow-left me-1" /> {tx('Voltar à cadeira')}</button>
      {resultado && (resultado.porCorrigir ? (
        <div className="alert alert-info">
          <h4 className="alert-heading mb-1">{tx('Entregue')}</h4>
          {tx('Tem respostas de desenvolvimento que o docente vai corrigir; a nota aparece depois (será avisado).')}{resultado.foraDeTempo && tx(' O tempo terminou: contaram as respostas gravadas até ao fim.')}
        </div>
      ) : (
        <div className={`alert ${resultado.nota >= 10 ? 'alert-success' : 'alert-danger'}`}>
          <h4 className="alert-heading mb-1">{tx('Nota:')} {nota(resultado.nota)} {tx('valores')}</h4>
          {nota(resultado.obtidos)} {tx('de')} {nota(resultado.total)} {tx('pontos.')}{resultado.foraDeTempo && tx(' O tempo terminou: contaram as respostas gravadas até ao fim.')}
        </div>
      ))}
      <Cartao titulo={q.titulo}>
        {q.descricao && <p className="p-texto-pre">{q.descricao}</p>}
        <dl className="p-ficha">
          <div><dt>{tx('Perguntas')}</dt><dd>{q.numeroPerguntas}{q.pontos !== null && tx(' ({0} pontos)', { 0: nota(q.pontos) })}</dd></div>
          <div><dt>{tx('Duração')}</dt><dd>{q.duracao ? tx('{0} minutos', { 0: q.duracao }) : tx('Sem limite')}</dd></div>
          <div><dt>{tx('Abre / fecha')}</dt><dd>{q.abre ? dataHora(q.abre) : '—'} / {q.fecha ? dataHora(q.fecha) : tx('sem prazo')}</dd></div>
          <div><dt>{tx('Tentativas')}</dt><dd>{q.feitas.length} {tx('de')} {q.tentativas}</dd></div>
        </dl>
        {q.feitas.length > 0 && (
          <table className="table table-sm mt-3 mb-0">
            <thead><tr><th>{tx('Tentativa')}</th><th>{tx('Entregue')}</th><th className="text-end">{tx('Nota')}</th><th /></tr></thead>
            <tbody>{q.feitas.map((t) => <LinhaTentativa key={t.id} t={t} falhou={falhou} />)}</tbody>
          </table>
        )}
        <div className="mt-3">
          {podeComecar
            ? <button type="button" className="btn btn-theme" onClick={() => api(`/questionarios/${id}/tentativas`, { metodo: 'POST' }).then((t) => { setResultado(null); setTentativa(t); setRespostas(t.respostas || {}) }).catch(falhou)}><i className="fa fa-play me-1" /> {q.feitas.length ? tx('Nova tentativa') : tx('Começar')}</button>
            : <span className="text-muted">{q.estado === 'em_breve' ? tx('Ainda não abriu.') : q.estado === 'fechado' ? tx('O questionário fechou.') : tx('Já usou todas as tentativas.')}</span>}
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
        <td>{t.numero}</td><td className="small">{dataHora(t.entregueEm)}</td>
        <td className="text-end fw-bold">{t.porCorrigir ? <span className="badge bg-warning text-dark">{tx('Por corrigir')}</span> : nota(t.nota)}</td>
        <td className="text-end"><button type="button" className="btn btn-xs btn-white" onClick={() => (rev ? setRev(null) : api(`/tentativas/${t.id}`).then(setRev).catch(falhou))}>{rev ? tx('Fechar') : tx('Rever')}</button></td>
      </tr>
      {rev && (
        <tr><td colSpan={4}>
          {rev.comentario && <div className="alert alert-secondary py-2"><b>{tx('Comentário do docente:')}</b> {rev.comentario}</div>}
          {rev.perguntas.map((p, n) => {
            const c = rev.correcao?.find((x) => x.perguntaId === p.id)
            const minha = rev.tentativa.respostas[p.id]
            return (
              <div key={p.id} className="mb-3">
                <div className="fw-bold">{n + 1}. {p.enunciado} {c && (c.certa ? <i className="fa fa-check text-success" /> : c.obtidos > 0 ? <span className="badge bg-warning text-dark">{nota(c.obtidos)} / {nota(c.pontos)}</span> : <i className="fa fa-times text-danger" />)}</div>
                {p.opcoes && p.opcoes.map((o) => {
                  const escolhida = (minha || []).includes(o.i)
                  return (
                    <div key={o.i} className={`small ${c?.solucao?.includes(o.i) ? 'text-success fw-bold' : escolhida ? 'text-danger' : 'text-muted'}`}>
                      <i className={`fa ${escolhida ? 'fa-dot-circle' : 'fa-circle'} me-1`} />{o.texto}
                    </div>
                  )
                })}
                {(p.tipo === 'curta' || p.tipo === 'numerica' || p.tipo === 'dissertacao') && (
                  <div className="small">
                    <span className="text-muted">{tx('A sua resposta:')} </span>{minha ? <span className="p-texto-pre">{String(minha)}</span> : <i>{tx('sem resposta')}</i>}
                    {c && p.tipo === 'curta' && <div className="text-success">{tx('Aceites:')} {c.solucao.join(' · ')}</div>}
                    {c && p.tipo === 'numerica' && <div className="text-success">{tx('Certa:')} {c.solucao.valor}{c.solucao.tolerancia ? ` (± ${c.solucao.tolerancia})` : ''}</div>}
                    {c && p.tipo === 'dissertacao' && <div className="text-muted">{nota(c.obtidos)} {tx('de')} {nota(c.pontos)} {tx('pontos')}</div>}
                  </div>
                )}
                {p.tipo === 'correspondencia' && (
                  <table className="table table-sm mb-0 small" style={{ maxWidth: 640 }}>
                    <tbody>
                      {p.itens.map((item, k) => {
                        const dada = c?.textos?.dadas?.[k] ?? p.escolhas.find((x) => x.i === minha?.[k])?.texto
                        const certa = c?.textos?.certas?.[k]
                        return <tr key={k}><td className="fw-bold">{item}</td><td className={c ? (dada === certa ? 'text-success' : 'text-danger') : ''}>{dada ?? '—'}{c && dada !== certa && <span className="text-success d-block">{tx('Certa:')} {certa}</span>}</td></tr>
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )
          })}
          {!rev.correcao && !rev.porCorrigir && <p className="small text-muted mb-0">{tx('O docente não mostra as respostas certas.')}</p>}
        </td></tr>
      )}
    </>
  )
}

export default Questionarios
