import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api'
import { Aviso, CabecalhoPagina, Carregando, Erro, Painel } from '../../componentes/Ui'
import ResultadosInquerito from '../../../portal/cadeira/ResultadosInquerito'
import { confirmar } from '../../../portal/dialogos'
import { descarregarCsv } from './documentos/csv'
import { t as tx, localAtual } from '../../../i18n/linguas'

const ESTADOS = { rascunho: ['bg-gray-500', tx('Rascunho')], aberto: ['bg-success', tx('Aberto')], fechado: ['bg-dark', tx('Fechado')] }
const TIPOS = { escala: tx('Escala 1 a 5'), escolha: tx('Escolha'), aberta: tx('Resposta livre') }
const dataLocal = (iso) => (iso ? new Date(iso).toLocaleDateString(localAtual()) : '—')
const paraCampo = (iso) => (iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : '')

/*
  Inquéritos institucionais de satisfação (Administração Escolar): preparar a partir de um modelo,
  escolher a quem se destinam, lançar (o portal avisa) e ver os resultados, sempre anónimos.
*/
function Satisfacao() {
  const [d, setD] = useState(null)
  const [turmas, setTurmas] = useState([])
  const [erro, setErro] = useState('')
  const [editar, setEditar] = useState(null) // formulário em edição
  const [resultados, setResultados] = useState(null)
  const [aviso, setAviso] = useState(null)
  const falhou = useCallback((e) => setAviso({ tipo: 'erro', texto: e.message }), [])
  const carregar = useCallback(() => api('/academico/satisfacao').then(setD).catch((e) => setErro(e.message)), [])
  useEffect(() => { carregar(); api('/academico/turmas').then((l) => setTurmas(l.filter((t) => t.ativa !== false))).catch(() => {}) }, [carregar])
  if (erro) return <Erro texto={erro} />
  if (!d) return <Carregando />

  const novo = (modelo) => setEditar({ titulo: '', descricao: '', publico: 'todos', turmaIds: [], fecha: '', perguntas: [{ tipo: 'escala', texto: '' }], ...(modelo ? structuredClone(d.modelos[modelo]) : {}) })
  async function lancar(i) {
    if (!(await confirmar(tx('Lançar "{0}" a {1} pessoa(s)? Depois de lançado, as perguntas já não mudam.', { 0: i.titulo, 1: i.destinatarios }), { titulo: tx('Lançar inquérito'), botao: tx('Lançar') }))) return
    await api(`/academico/satisfacao/${i.id}/lancar`, { metodo: 'POST' }).then((r) => { setAviso({ texto: tx('Inquérito lançado: {0} pessoa(s) avisada(s) no portal.', { 0: r.destinatarios }) }); carregar() }).catch(falhou)
  }
  async function apagar(i) {
    if (!(await confirmar(tx('Apagar "{0}"{1}?', { 0: i.titulo, 1: i.respostas ? ` e as ${i.respostas} respostas` : '' }), { titulo: tx('Apagar inquérito'), botao: tx('Apagar'), perigo: true }))) return
    await api(`/academico/satisfacao/${i.id}`, { metodo: 'DELETE' }).then(carregar).catch(falhou)
  }
  const verResultados = (i) => api(`/academico/satisfacao/${i.id}/resultados`).then(setResultados).catch(falhou)
  function exportar(r) {
    const linhas = r.resultados.perguntas.flatMap((p, k) => {
      if (p.tipo === 'escala') return [[k + 1, p.texto, tx('Média'), String(p.media ?? '').replace('.', ','), ...p.distribuicao]]
      if (p.tipo === 'escolha') return p.opcoes.map((o, j) => [k + 1, p.texto, o, p.contagens[j], `${p.percentagens[j]}%`])
      return p.comentarios.map((c) => [k + 1, p.texto, tx('Comentário'), c])
    })
    descarregarCsv(`inquerito-${r.id}`, [[r.titulo], [`${r.resultados.total} respostas de ${r.destinatarios} destinatários`], [], ['N.º', 'Pergunta', 'Opção', 'Valor', '1', '2', '3', '4', '5'], ...linhas])
  }

  return (
    <>
      <CabecalhoPagina titulo={tx('Inquéritos de satisfação')} subtitulo={tx('opinião anónima de estudantes e docentes')} migalhas={[{ rotulo: tx('Administração Escolar') }, { rotulo: tx('Inquéritos de satisfação') }]}>
        <div className="btn-group">
          <button type="button" className="btn btn-theme" onClick={() => novo(null)}><i className="fa fa-plus me-1" />{tx('Novo inquérito')}</button>
          {Object.entries(d.modelos).map(([k, m]) => <button key={k} type="button" className="btn btn-white" onClick={() => novo(k)}>{m.titulo}</button>)}
        </div>
      </CabecalhoPagina>
      {editar && <Editor f={editar} setF={setEditar} publicos={d.publicos} turmas={turmas} feito={() => { setEditar(null); carregar(); setAviso({ texto: tx('Inquérito guardado como rascunho.') }) }} falhou={falhou} />}
      <Painel titulo={tx('Inquéritos ({0})', { 0: d.inqueritos.length })} corpo={false}>
        <div className="table-responsive">
          <table className="table table-striped align-middle mb-0">
            <thead><tr><th>{tx('Inquérito')}</th><th>{tx('Para')}</th><th className="text-center">{tx('Respostas')}</th><th>{tx('Fecha')}</th><th>{tx('Estado')}</th><th /></tr></thead>
            <tbody>
              {d.inqueritos.length === 0 && <tr><td colSpan={6} className="text-center text-muted py-4">{tx('Ainda não há inquéritos. Comece por um modelo.')}</td></tr>}
              {d.inqueritos.map((i) => (
                <tr key={i.id}>
                  <td><b>{i.titulo}</b><div className="small text-muted">{i.perguntas.length} {tx('pergunta(s)')}</div></td>
                  <td className="small">{d.publicos[i.publico]}{i.turmaIds.length ? tx(' · {0} turma(s)', { 0: i.turmaIds.length }) : ''}</td>
                  <td className="text-center">{i.respostas} / {i.destinatarios}</td>
                  <td className="small">{dataLocal(i.fecha)}</td>
                  <td><span className={`badge ${ESTADOS[i.estado][0]}`}>{ESTADOS[i.estado][1]}</span></td>
                  <td className="text-end text-nowrap">
                    {i.estado === 'rascunho' && <button type="button" className="btn btn-xs btn-white me-1" onClick={() => setEditar({ ...i, fecha: paraCampo(i.fecha) })}><i className="fa fa-pen me-1" />{tx('Editar')}</button>}
                    {i.estado === 'rascunho' && <button type="button" className="btn btn-xs btn-theme me-1" onClick={() => lancar(i)}><i className="fa fa-paper-plane me-1" />{tx('Lançar')}</button>}
                    {i.estado !== 'rascunho' && <button type="button" className="btn btn-xs btn-white me-1" onClick={() => verResultados(i)}><i className="fa fa-chart-bar me-1" />{tx('Resultados')}</button>}
                    <button type="button" className="btn btn-xs btn-white text-danger" onClick={() => apagar(i)} aria-label={tx('Apagar {0}', { 0: i.titulo })}><i className="fa fa-trash-alt" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Painel>
      {resultados && (
        <>
          <div className="modal d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="sat-titulo" onClick={() => setResultados(null)}>
            <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable" onClick={(e) => e.stopPropagation()}>
              <div className="modal-content">
                <div className="modal-header">
                  <h4 className="modal-title" id="sat-titulo">{resultados.titulo}<small className="d-block fs-12px text-muted fw-normal">{resultados.resultados.total} {tx('de')} {resultados.destinatarios} {tx('responderam')}</small></h4>
                  <button type="button" className="btn-close" onClick={() => setResultados(null)} aria-label={tx('Fechar')} />
                </div>
                <div className="modal-body"><ResultadosInquerito resultados={resultados.resultados} media={resultados.media} /></div>
                <div className="modal-footer"><button type="button" className="btn btn-white" onClick={() => exportar(resultados)}><i className="fa fa-file-excel me-1 text-success" />{tx('Exportar Excel')}</button></div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      )}
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

// editor do inquérito: dados, destinatários e perguntas (acrescentar, mudar de ordem, retirar)
function Editor({ f, setF, publicos, turmas, feito, falhou }) {
  const [aGuardar, setAGuardar] = useState(false)
  const pergunta = (k, mud) => setF({ ...f, perguntas: f.perguntas.map((p, j) => (j === k ? { ...p, ...mud } : p)) })
  const mover = (k, d) => { const l = [...f.perguntas]; [l[k], l[k + d]] = [l[k + d], l[k]]; setF({ ...f, perguntas: l }) }
  async function guardar(e) {
    e.preventDefault()
    setAGuardar(true)
    try {
      const corpo = { titulo: f.titulo, descricao: f.descricao, publico: f.publico, turmaIds: f.publico === 'docentes' ? [] : f.turmaIds, fecha: f.fecha ? new Date(f.fecha).toISOString() : '', perguntas: f.perguntas }
      if (f.id) await api(`/academico/satisfacao/${f.id}`, { metodo: 'PUT', corpo })
      else await api('/academico/satisfacao', { metodo: 'POST', corpo })
      feito()
    } catch (falha) {
      falhou(falha)
    } finally {
      setAGuardar(false)
    }
  }
  return (
    <Painel titulo={f.id ? tx('Editar inquérito') : tx('Novo inquérito')}>
      <form onSubmit={guardar}>
        <div className="row g-2 mb-2">
          <div className="col-lg-6"><label className="form-label fw-bold" htmlFor="s-titulo">{tx('Título')}</label><input id="s-titulo" className="form-control" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} required /></div>
          <div className="col-lg-3"><label className="form-label fw-bold" htmlFor="s-publico">{tx('Para')}</label><select id="s-publico" className="form-select" value={f.publico} onChange={(e) => setF({ ...f, publico: e.target.value })}>{Object.entries(publicos).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="col-lg-3"><label className="form-label fw-bold" htmlFor="s-fecha">{tx('Responder até')}</label><input id="s-fecha" type="datetime-local" className="form-control" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} required /></div>
          <div className="col-12"><label className="form-label" htmlFor="s-desc">{tx('Texto de apresentação')}</label><input id="s-desc" className="form-control" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} /></div>
          {f.publico !== 'docentes' && (
            <div className="col-12">
              <span className="form-label d-block">{tx('Turmas (nenhuma marcada = todos os estudantes)')}</span>
              <div className="d-flex flex-wrap gap-2">
                {turmas.map((t) => (
                  <label key={t.id} className={`btn btn-sm ${f.turmaIds.includes(t.id) ? 'btn-theme' : 'btn-white'}`}>
                    <input type="checkbox" className="d-none" checked={f.turmaIds.includes(t.id)} onChange={(e) => setF({ ...f, turmaIds: e.target.checked ? [...f.turmaIds, t.id] : f.turmaIds.filter((x) => x !== t.id) })} />{t.nome}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <span className="form-label fw-bold d-block mt-3">{tx('Perguntas')}</span>
        {f.perguntas.map((p, k) => (
          <div key={k} className="border rounded p-2 mb-2">
            <div className="d-flex gap-2 align-items-center">
              <b className="text-muted">{k + 1}.</b>
              <select className="form-select form-select-sm" style={{ width: 150 }} value={p.tipo} onChange={(e) => pergunta(k, { tipo: e.target.value, ...(e.target.value === 'escolha' && !p.opcoes ? { opcoes: ['', ''] } : {}) })} aria-label={tx('Tipo da pergunta {0}', { 0: k + 1 })}>{Object.entries(TIPOS).map(([t, n]) => <option key={t} value={t}>{n}</option>)}</select>
              <input className="form-control form-control-sm" value={p.texto} onChange={(e) => pergunta(k, { texto: e.target.value })} placeholder={p.tipo === 'escala' ? tx('Afirmação (de discordo totalmente a concordo totalmente)') : tx('Pergunta')} aria-label={tx('Texto da pergunta {0}', { 0: k + 1 })} required />
              <button type="button" className="btn btn-xs btn-white" disabled={k === 0} onClick={() => mover(k, -1)} aria-label={tx('Subir')}><i className="fa fa-arrow-up" /></button>
              <button type="button" className="btn btn-xs btn-white" disabled={k === f.perguntas.length - 1} onClick={() => mover(k, 1)} aria-label={tx('Descer')}><i className="fa fa-arrow-down" /></button>
              <button type="button" className="btn btn-xs btn-white text-danger" disabled={f.perguntas.length === 1} onClick={() => setF({ ...f, perguntas: f.perguntas.filter((_, j) => j !== k) })} aria-label={tx('Retirar pergunta')}><i className="fa fa-times" /></button>
            </div>
            {p.tipo === 'escolha' && (
              <div className="ms-4 mt-2">
                {(p.opcoes || []).map((o, j) => (
                  <div key={j} className="d-flex gap-2 mb-1">
                    <input className="form-control form-control-sm" value={o} onChange={(e) => pergunta(k, { opcoes: p.opcoes.map((x, n) => (n === j ? e.target.value : x)) })} placeholder={tx('Opção {0}', { 0: j + 1 })} aria-label={tx('Opção {0} da pergunta {1}', { 0: j + 1, 1: k + 1 })} required />
                    {p.opcoes.length > 2 && <button type="button" className="btn btn-xs btn-white" onClick={() => pergunta(k, { opcoes: p.opcoes.filter((_, n) => n !== j) })} aria-label={tx('Retirar opção')}><i className="fa fa-times" /></button>}
                  </div>
                ))}
                <div className="d-flex gap-3 align-items-center">
                  {p.opcoes?.length < 10 && <button type="button" className="btn btn-xs btn-white" onClick={() => pergunta(k, { opcoes: [...p.opcoes, ''] })}><i className="fa fa-plus me-1" />{tx('Opção')}</button>}
                  <label className="small"><input type="checkbox" checked={Boolean(p.multipla)} onChange={(e) => pergunta(k, { multipla: e.target.checked })} /> {tx('Várias respostas')}</label>
                </div>
              </div>
            )}
          </div>
        ))}
        {f.perguntas.length < 30 && <button type="button" className="btn btn-sm btn-white mb-3" onClick={() => setF({ ...f, perguntas: [...f.perguntas, { tipo: 'escala', texto: '' }] })}><i className="fa fa-plus me-1" />{tx('Pergunta')}</button>}
        <div className="d-flex gap-2">
          <button type="submit" className="btn btn-theme" disabled={aGuardar}>{aGuardar ? tx('A guardar…') : tx('Guardar rascunho')}</button>
          <button type="button" className="btn btn-white" onClick={() => setF(null)}>{tx('Cancelar')}</button>
        </div>
      </form>
    </Painel>
  )
}

export default Satisfacao
