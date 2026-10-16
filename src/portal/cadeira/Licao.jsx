import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import DOMPurify from 'dompurify'
import { api } from '../api'
import { Cartao, Carregando, Vazio } from '../componentes'
import { nota } from '../formatar'
import { confirmar } from '../dialogos'
import { t as tx } from '../../i18n/linguas'

const EditorPagina = lazy(() => import('./EditorPagina'))
const novoId = () => Math.random().toString(36).slice(2, 8)
const temTexto = (h) => String(h || '').replace(/<[^>]*>/g, '').trim() || /<img|<iframe|<video/i.test(h || '')

/*
  Lição (como a do Moodle): páginas de matéria com perguntas pelo meio. Cada resposta tem
  um comentário do docente e leva a uma página (a seguinte, outra, a mesma, ou o fim).
  O caminho e a nota são do servidor; aqui só se mostra a página onde o estudante vai.
*/
function Licao({ m, eDocente, recarregar, avisar, setProgresso, cadeiraId }) {
  const [vista, setVista] = useState('ver')
  if (eDocente) {
    return (
      <Cartao titulo={<><i className="fa fa-route me-2" />{m.titulo}</>} corpo={false}>
        <ul className="nav nav-tabs px-3 pt-2">
          {[['ver', 'fa-eye', tx('Páginas')], ['editar', 'fa-pen', tx('Editar a lição')], ['resultados', 'fa-poll', tx('Resultados')]].map(([k, i, t]) => (
            <li key={k} className="nav-item"><button type="button" className={`nav-link ${vista === k ? 'active' : ''}`} onClick={() => setVista(k)}><i className={`fa ${i} me-1`} />{t}</button></li>
          ))}
        </ul>
        <div className="panel-body">
          {vista === 'ver' && <Resumo m={m} />}
          {vista === 'editar' && <EditorLicao m={m} recarregar={recarregar} avisar={avisar} fechar={() => setVista('ver')} />}
          {vista === 'resultados' && <Resultados m={m} avisar={avisar} />}
        </div>
      </Cartao>
    )
  }
  return <Fazer m={m} avisar={avisar} setProgresso={setProgresso} cadeiraId={cadeiraId} />
}

// ---------- estudante ----------

function Fazer({ m, avisar, setProgresso, cadeiraId }) {
  const [e, setE] = useState(null)
  const [escolha, setEscolha] = useState(null)
  const [retorno, setRetorno] = useState(null) // { certa, resposta, depois } depois de responder
  const [aEnviar, setAEnviar] = useState(false)
  const falhou = useCallback((x) => avisar({ tipo: 'erro', texto: x.message }), [avisar])
  useEffect(() => { api(`/materiais/${m.id}/licao`).then(setE).catch(falhou) }, [m.id, falhou])

  const atualizarProgresso = () => api(`/cadeiras/${cadeiraId}/progresso`).then(setProgresso).catch(() => {})
  async function passo(url, corpo) {
    setAEnviar(true)
    try {
      const r = await api(url, { metodo: 'POST', corpo })
      if (r.concluida) atualizarProgresso()
      return r
    } catch (x) {
      falhou(x)
      return null
    } finally {
      setAEnviar(false)
    }
  }
  async function continuar() {
    const r = await passo(`/materiais/${m.id}/licao/avancar`, { paginaId: e.pagina })
    if (r) { setE({ ...e, ...r }); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  }
  async function responder() {
    const r = await passo(`/materiais/${m.id}/licao/resposta`, { paginaId: e.pagina, opcao: escolha })
    if (r) setRetorno({ certa: r.certa, resposta: r.resposta, depois: r })
  }
  function seguir() {
    setE({ ...e, ...retorno.depois })
    setRetorno(null)
    setEscolha(null)
  }
  async function recomecar() {
    const r = await passo(`/materiais/${m.id}/licao/recomecar`)
    if (r) { setE({ ...e, ...r }); setRetorno(null); setEscolha(null) }
  }

  if (!e) return <Cartao titulo={m.titulo}><Carregando /></Cartao>
  const i = e.paginas.findIndex((p) => p.id === e.pagina)
  const p = e.paginas[i]

  return (
    <Cartao titulo={<><i className="fa fa-route me-2" />{m.titulo}</>} acoes={!e.concluida && <span className="text-white small">{tx('Página {0} de {1}', { 0: i + 1, 1: e.total })}</span>}>
      {!e.concluida && <div className="progress mb-3" style={{ height: 6 }}><div className="progress-bar bg-pink" style={{ width: `${Math.round(((i + 1) / e.total) * 100)}%` }} /></div>}
      {e.concluida ? (
        <div className="p-licao-fim">
          <i className="fa fa-flag-checkered fa-3x text-success mb-3" />
          <h3 className="h4">{tx('Lição concluída')}</h3>
          {e.perguntas > 0 && <p className="mb-1">{tx('Nota: {0} valores', { 0: nota(e.nota) })}{e.visitas > 1 && ` · ${tx('melhor: {0}', { 0: nota(e.melhorNota) })}`}</p>}
          <p className="text-muted small">{tx('Conta a primeira resposta a cada pergunta.')}</p>
          <button type="button" className="btn btn-white" onClick={recomecar} disabled={aEnviar}><i className="fa fa-redo me-1" />{tx('Fazer de novo')}</button>
        </div>
      ) : p && (
        <>
          <h3 className="h5">{p.titulo}</h3>
          {temTexto(p.conteudo) && <div className="p-programa mb-3" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(p.conteudo) }} />}
          {p.pergunta ? (
            <div className="p-licao-pergunta">
              <p className="fw-bold mb-2">{p.pergunta.enunciado}</p>
              {p.pergunta.opcoes.map((o, k) => (
                <label key={k} className={`d-flex gap-2 align-items-center py-1 ${retorno && escolha === k ? (retorno.certa ? 'text-success fw-bold' : 'text-danger fw-bold') : ''}`}>
                  <input type="radio" className="form-check-input mt-0" name={`l-${p.id}`} checked={escolha === k} disabled={Boolean(retorno)} onChange={() => setEscolha(k)} />{o.texto}
                </label>
              ))}
              {retorno ? (
                <div className={`alert ${retorno.certa ? 'alert-success' : 'alert-warning'} mt-3 mb-0`}>
                  <b>{retorno.certa ? tx('Certo.') : tx('Não é bem assim.')}</b> {retorno.resposta}
                  <div className="mt-2"><button type="button" className="btn btn-sm btn-theme" onClick={seguir}>{tx('Continuar')} <i className="fa fa-arrow-right ms-1" /></button></div>
                </div>
              ) : (
                <button type="button" className="btn btn-theme mt-2" onClick={responder} disabled={escolha === null || aEnviar}>{tx('Responder')}</button>
              )}
              {e.respondidas[p.id] && !retorno && <p className="small text-muted mt-2 mb-0">{tx('Já respondeu a esta pergunta: para a nota conta a primeira resposta.')}</p>}
            </div>
          ) : (
            <div className="d-flex justify-content-end"><button type="button" className="btn btn-theme" onClick={continuar} disabled={aEnviar}>{i === e.total - 1 ? tx('Terminar a lição') : tx('Continuar')} <i className="fa fa-arrow-right ms-1" /></button></div>
          )}
        </>
      )}
    </Cartao>
  )
}

// ---------- docente ----------

const destinoTexto = (paginas, salto) => ({ seguinte: tx('Página seguinte'), repetir: tx('Repetir esta página'), fim: tx('Fim da lição') }[salto] || paginas.find((p) => p.id === salto)?.titulo || '?')

function Resumo({ m }) {
  const paginas = m.estrutura || []
  return (
    <ol className="mb-0">
      {paginas.map((p) => (
        <li key={p.id} className="mb-2">
          <b>{p.titulo}</b>
          {p.pergunta && (
            <ul className="small mb-0">
              <li className="text-muted">{p.pergunta.enunciado}</li>
              {p.pergunta.opcoes.map((o, k) => <li key={k} className={o.correta ? 'text-success' : ''}>{o.correta ? '✓' : '✗'} {o.texto} → {destinoTexto(paginas, o.salto)}</li>)}
            </ul>
          )}
        </li>
      ))}
    </ol>
  )
}

function EditorLicao({ m, recarregar, avisar, fechar }) {
  // um salto para a própria página é o mesmo que "repetir"
  const [paginas, setPaginas] = useState(() => structuredClone(m.estrutura || []).map((x) => (x.pergunta ? { ...x, pergunta: { ...x.pergunta, opcoes: x.pergunta.opcoes.map((o) => (o.salto === x.id ? { ...o, salto: 'repetir' } : o)) } } : x)))
  const [atual, setAtual] = useState(0)
  const [aGuardar, setAGuardar] = useState(false)
  const p = paginas[atual]
  const mudar = (campo, v) => setPaginas((l) => l.map((x, j) => (j === atual ? { ...x, [campo]: v } : x)))
  const mudarPergunta = (campo, v) => mudar('pergunta', { ...p.pergunta, [campo]: v })
  const mudarOpcao = (k, campo, v) => mudarPergunta('opcoes', p.pergunta.opcoes.map((o, j) => (j === k ? { ...o, [campo]: v } : o)))
  const mover = (d) => {
    const j = atual + d
    if (j < 0 || j >= paginas.length) return
    setPaginas((l) => { const n = [...l]; [n[atual], n[j]] = [n[j], n[atual]]; return n })
    setAtual(j)
  }
  const juntar = () => { setPaginas((l) => [...l, { id: novoId(), titulo: tx('Página {0}', { 0: l.length + 1 }), conteudo: '' }]); setAtual(paginas.length) }
  async function apagar() {
    if (paginas.length === 1 || !(await confirmar(tx('Apagar a página "{0}"?', { 0: p.titulo }), { titulo: tx('Apagar página'), botao: tx('Apagar'), perigo: true }))) return
    setPaginas((l) => l.filter((_, j) => j !== atual).map((x) => (x.pergunta ? { ...x, pergunta: { ...x.pergunta, opcoes: x.pergunta.opcoes.map((o) => (o.salto === p.id ? { ...o, salto: 'seguinte' } : o)) } } : x)))
    setAtual(Math.max(0, atual - 1))
  }
  async function guardar() {
    setAGuardar(true)
    try {
      await api(`/materiais/${m.id}`, { metodo: 'PUT', corpo: { estrutura: paginas } })
      avisar({ texto: tx('Lição guardada.') })
      recarregar()
      fechar()
    } catch (e) {
      avisar({ tipo: 'erro', texto: e.message })
    } finally {
      setAGuardar(false)
    }
  }

  return (
    <>
      <div className="row g-4">
        <div className="col-lg-4">
          <ol className="p-livro-indice editar">
            {paginas.map((x, i) => (
              <li key={x.id}>
                <button type="button" className={i === atual ? 'ativo' : ''} onClick={() => setAtual(i)}>
                  <span className="p-livro-num">{i + 1}</span><span>{x.titulo}</span>{x.pergunta && <i className="fa fa-question-circle text-pink ms-1" title={tx('Tem pergunta')} />}
                </button>
              </li>
            ))}
          </ol>
          <div className="d-flex gap-1 mt-2">
            <button type="button" className="btn btn-sm btn-white flex-grow-1" onClick={juntar} disabled={paginas.length >= 60}><i className="fa fa-plus me-1" />{tx('Nova página')}</button>
            <button type="button" className="btn btn-sm btn-white" onClick={() => mover(-1)} disabled={atual === 0} aria-label={tx('Subir página')}><i className="fa fa-arrow-up" /></button>
            <button type="button" className="btn btn-sm btn-white" onClick={() => mover(1)} disabled={atual === paginas.length - 1} aria-label={tx('Descer página')}><i className="fa fa-arrow-down" /></button>
            <button type="button" className="btn btn-sm btn-white text-danger" onClick={apagar} disabled={paginas.length === 1} aria-label={tx('Apagar página')}><i className="fa fa-trash-alt" /></button>
          </div>
        </div>
        <div className="col-lg-8">
          {p && (
            <div key={p.id} className="p-formulario">
              <label htmlFor="lc-titulo"><span className="form-label fw-bold d-block mb-1">{tx('Título da página')}</span>
                <input id="lc-titulo" className="form-control" value={p.titulo} onChange={(e) => mudar('titulo', e.target.value)} maxLength={200} />
              </label>
              <Suspense fallback={<div className="text-muted small">{tx('A abrir o editor…')}</div>}>
                <EditorPagina html={p.conteudo} onChange={(h) => mudar('conteudo', h)} aoErro={(t) => avisar({ tipo: 'erro', texto: t })} placeholder={tx('Matéria desta página…')} />
              </Suspense>
              <label className="p-caixa"><input type="checkbox" checked={Boolean(p.pergunta)} onChange={(e) => mudar('pergunta', e.target.checked ? { enunciado: '', opcoes: [{ texto: '', correta: true, resposta: '', salto: 'seguinte' }, { texto: '', correta: false, resposta: '', salto: 'repetir' }] } : undefined)} /> {tx('Esta página termina com uma pergunta')}</label>
              {p.pergunta && (
                <div className="p-licao-editor-pergunta">
                  <label htmlFor="lc-enunciado"><span className="form-label fw-bold d-block mb-1">{tx('Pergunta')}</span>
                    <input id="lc-enunciado" className="form-control" value={p.pergunta.enunciado} onChange={(e) => mudarPergunta('enunciado', e.target.value)} maxLength={1000} />
                  </label>
                  {p.pergunta.opcoes.map((o, k) => (
                    <div key={k} className="p-licao-opcao">
                      <div className="d-flex gap-2 align-items-center">
                        <input type="checkbox" className="form-check-input mt-0" checked={o.correta} onChange={(e) => mudarOpcao(k, 'correta', e.target.checked)} aria-label={tx('Opção {0} certa', { 0: k + 1 })} title={tx('Certa')} />
                        <input className="form-control form-control-sm" value={o.texto} onChange={(e) => mudarOpcao(k, 'texto', e.target.value)} placeholder={tx('Opção {0}', { 0: k + 1 })} aria-label={tx('Opção {0}', { 0: k + 1 })} />
                        {p.pergunta.opcoes.length > 2 && <button type="button" className="btn btn-xs btn-white" onClick={() => mudarPergunta('opcoes', p.pergunta.opcoes.filter((_, j) => j !== k))} aria-label={tx('Retirar opção')}><i className="fa fa-times" /></button>}
                      </div>
                      <div className="d-flex gap-2 mt-1 ps-4">
                        <input className="form-control form-control-sm" value={o.resposta} onChange={(e) => mudarOpcao(k, 'resposta', e.target.value)} placeholder={tx('Comentário ao estudante (opcional)')} aria-label={tx('Comentário da opção {0}', { 0: k + 1 })} />
                        <select className="form-select form-select-sm" style={{ maxWidth: 220 }} value={o.salto} onChange={(e) => mudarOpcao(k, 'salto', e.target.value)} aria-label={tx('Para onde vai a opção {0}', { 0: k + 1 })}>
                          <option value="seguinte">{tx('→ Página seguinte')}</option>
                          <option value="repetir">{tx('↺ Repetir esta página')}</option>
                          <option value="fim">{tx('■ Fim da lição')}</option>
                          {paginas.filter((x) => x.id !== p.id).map((x) => <option key={x.id} value={x.id}>→ {x.titulo}</option>)}
                        </select>
                      </div>
                    </div>
                  ))}
                  {p.pergunta.opcoes.length < 6 && <button type="button" className="btn btn-xs btn-white" onClick={() => mudarPergunta('opcoes', [...p.pergunta.opcoes, { texto: '', correta: false, resposta: '', salto: 'repetir' }])}><i className="fa fa-plus me-1" />{tx('Opção')}</button>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="d-flex gap-2 mt-3">
        <button type="button" className="btn btn-theme" onClick={guardar} disabled={aGuardar}><i className="fa fa-save me-1" />{aGuardar ? tx('A guardar…') : tx('Guardar a lição')}</button>
        <button type="button" className="btn btn-white" onClick={fechar} disabled={aGuardar}>{tx('Cancelar')}</button>
      </div>
    </>
  )
}

function Resultados({ m, avisar }) {
  const [linhas, setLinhas] = useState(null)
  useEffect(() => { api(`/materiais/${m.id}/licao/resultados`).then(setLinhas).catch((e) => avisar({ tipo: 'erro', texto: e.message })) }, [m.id, avisar])
  if (!linhas) return <Carregando />
  if (!linhas.length) return <Vazio>{tx('A turma não tem estudantes.')}</Vazio>
  return (
    <table className="table table-sm align-middle mb-0">
      <thead><tr><th>{tx('Estudante')}</th><th>{tx('Estado')}</th><th className="text-center">{tx('Acertos à primeira')}</th><th className="text-end">{tx('Melhor nota')}</th></tr></thead>
      <tbody>
        {linhas.map((l) => (
          <tr key={l.estudante.id}>
            <td className="fw-bold">{l.estudante.nome}</td>
            <td className="small">{l.concluida ? <span className="badge bg-success">{tx('Concluída')}</span> : l.comecou ? <span className="text-muted">{tx('Vai em: {0}', { 0: l.pagina })}</span> : <span className="text-muted">{tx('Ainda não começou')}</span>}{l.visitas > 1 && <span className="text-muted"> · {tx('{0} vezes', { 0: l.visitas })}</span>}</td>
            <td className="text-center small">{l.perguntas ? `${l.acertos}/${l.perguntas}` : '—'}</td>
            <td className="text-end fw-bold">{l.melhorNota === null ? '—' : nota(l.melhorNota)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default Licao
