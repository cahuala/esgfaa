import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api'
import { Aviso, CabecalhoPagina, Carregando, Erro, Painel } from '../../componentes/Ui'
import ResultadosInquerito from '../../../portal/cadeira/ResultadosInquerito'
import { confirmar } from '../../../portal/dialogos'
import { descarregarCsv } from './documentos/csv'
import EditorInquerito from '../../../portal/inquerito/EditorInquerito'
import { t as tx, localAtual } from '../../../i18n/linguas'

const ESTADOS = { rascunho: ['bg-gray-500', tx('Rascunho')], aberto: ['bg-success', tx('Aberto')], fechado: ['bg-dark', tx('Fechado')] }
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

  const novo = (modelo) => setEditar({ titulo: '', descricao: '', publico: 'todos', turmaIds: [], fecha: '', perguntas: [{ tipo: 'escolha', texto: '', opcoes: [''], obrigatoria: true }], ...(modelo ? structuredClone(d.modelos[modelo]) : {}) })
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
    // número de cada pergunta sem contar as secções
    let n = 0
    const linhas = r.resultados.perguntas.flatMap((p) => {
      if (p.tipo === 'seccao') return [[], [tx('Secção'), p.texto]]
      n++
      if (p.tipo === 'escala') return [[n, p.texto, tx('Média'), String(p.media ?? '').replace('.', ','), ...p.distribuicao]]
      if (p.tipo === 'escolha') return [...p.opcoes.map((o, j) => [n, p.texto, o, p.contagens[j], `${p.percentagens[j]}%`]), ...(p.outras || []).map((o) => [n, p.texto, tx('Outra:'), o])]
      if (p.tipo === 'grelha') return p.linhas.flatMap((l, i) => p.colunas.map((c, j) => [n, p.texto, `${l} — ${c}`, p.contagens[i][j]]))
      return p.comentarios.map((c) => [n, p.texto, tx('Resposta'), c])
    })
    descarregarCsv(`inquerito-${r.id}`, [[r.titulo], [`${r.resultados.total} respostas de ${r.destinatarios} destinatários`], [], ['N.º', 'Pergunta', 'Opção', 'Valor', tx('Distribuição (do menor ao maior)')], ...linhas])
  }

  return (
    <>
      <CabecalhoPagina titulo={tx('Inquéritos de satisfação')} subtitulo={tx('opinião anónima de estudantes e docentes')} migalhas={[{ rotulo: tx('Administração Escolar') }, { rotulo: tx('Inquéritos de satisfação') }]}>
        <div className="btn-group">
          <button type="button" className="btn btn-theme" onClick={() => novo(null)}><i className="fa fa-plus me-1" />{tx('Novo inquérito')}</button>
          {Object.entries(d.modelos).map(([k, m]) => <button key={k} type="button" className="btn btn-white" onClick={() => novo(k)}>{m.titulo}</button>)}
        </div>
      </CabecalhoPagina>
      {editar && <EditorInquerito f={editar} setF={setEditar} publicos={d.publicos} turmas={turmas}
        guardar={(corpo, id) => (id ? api(`/academico/satisfacao/${id}`, { metodo: 'PUT', corpo }) : api('/academico/satisfacao', { metodo: 'POST', corpo }))} feito={() => { setEditar(null); carregar(); setAviso({ texto: tx('Inquérito guardado como rascunho.') }) }} falhou={falhou} />}
      <Painel titulo={tx('Inquéritos ({0})', { 0: d.inqueritos.length })} corpo={false}>
        <div className="table-responsive">
          <table className="table table-striped align-middle mb-0">
            <thead><tr><th>{tx('Inquérito')}</th><th>{tx('Para')}</th><th className="text-center">{tx('Respostas')}</th><th>{tx('Fecha')}</th><th>{tx('Estado')}</th><th /></tr></thead>
            <tbody>
              {d.inqueritos.length === 0 && <tr><td colSpan={6} className="text-center text-muted py-4">{tx('Ainda não há inquéritos. Comece por um modelo.')}</td></tr>}
              {d.inqueritos.map((i) => (
                <tr key={i.id}>
                  <td><b>{i.titulo}</b><div className="small text-muted">{i.perguntas.filter((p) => p.tipo !== 'seccao').length} {tx('pergunta(s)')}{i.perguntas.some((p) => p.tipo === 'seccao') ? ` · ${i.perguntas.filter((p) => p.tipo === 'seccao').length} ${tx('secção(ões)')}` : ''}</div></td>
                  <td className="small">{tx(d.publicos[i.publico])}{i.turmaIds.length ? tx(' · {0} turma(s)', { 0: i.turmaIds.length }) : ''}</td>
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

export default Satisfacao
