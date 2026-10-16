import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../api'
import { Painel } from './Ui'
import { confirmar } from '../../portal/dialogos'
import { t as tx } from '../../i18n/linguas'

const NOMES = { titulo: tx('Título'), subtitulo: tx('Subtítulo'), resumo: tx('Resumo'), texto: tx('Texto'), html: tx('Texto formatado'), legenda: tx('Legenda'), categoria: tx('Categoria'), conteudo: tx('Conteúdo'), nome: 'Nome', cargo: tx('Cargo'), destaque: tx('Destaque'), autor: tx('Autor'), local: 'Local', programa: tx('Programa'), atividade: tx('Atividade'), itens: tx('Itens'), apresentacao: tx('Apresentação'), objetivos: tx('Objetivos'), requisitos: tx('Requisitos'), saidas: tx('Saídas'), plano: tx('Plano'), unidades: tx('Unidades'), periodo: tx('Período'), regime: tx('Regime'), duracao: tx('Duração'), destinatarios: tx('Destinatários'), palavrasChave: tx('Palavras-chave'), area: tx('Área'), tipo: 'Tipo', pergunta: tx('Pergunta'), resposta: tx('Resposta'), etiqueta: tx('Etiqueta'), botao: tx('Botão') }
// "conteudo.3.texto" -> "Conteúdo › 4 › Texto"
const rotulo = (c) => c.split('.').map((p) => (/^\d+$/.test(p) ? String(Number(p) + 1) : NOMES[p] || p)).join(' › ')

function estadoDe(t) {
  if (!t) return ['bg-light text-dark border', tx('Por traduzir')]
  if (t.desatualizados.length) return ['bg-warning text-dark', tx('{0} · {1} mudou', { 0: t.estado === 'publicada' ? 'Publicada' : 'Rascunho', 1: t.desatualizados.length })]
  if (t.estado === 'publicada') return [t.emFalta.length ? 'bg-info' : 'bg-success', t.emFalta.length ? tx('Publicada · faltam {0}', { 0: t.emFalta.length }) : tx('Publicada')]
  return ['bg-secondary', tx('Rascunho')]
}

/*
  Traduções de um conteúdo (notícia, artigo, evento, curso, pessoa ou página):
  estado por língua e, ao abrir, a revisão campo a campo ao lado do original.
*/
function Traducoes({ colecao, id, horizontal = false }) {
  const [d, setD] = useState(null)
  const [erro, setErro] = useState('')
  const [aberta, setAberta] = useState(null)
  const carregar = useCallback(() => api(`/traducoes/${colecao}/${id}`).then(setD).catch((e) => setErro(e.message)), [colecao, id])
  useEffect(() => { carregar() }, [carregar])
  if (erro) return null
  if (!d) return null
  const linhas = Object.entries(d.linguas).map(([l, nome]) => {
    const [cor, texto] = estadoDe(d.traducoes[l])
    return (
      <button key={l} type="button" className={`list-group-item list-group-item-action d-flex align-items-center gap-2 ${horizontal ? 'border rounded' : ''}`} onClick={() => setAberta(l)}>
        <b className="text-uppercase" style={{ width: 26 }}>{l}</b>
        <span className="flex-grow-1 small">{nome}</span>
        <span className={`badge ${cor}`}>{texto}</span>
      </button>
    )
  })
  return (
    <>
      <Painel titulo={<><i className="fa fa-language me-2" />{tx('Traduções')}</>} corpo={false}>
        <div className={horizontal ? 'd-flex flex-wrap gap-2 p-3' : 'list-group list-group-flush'}>{linhas}</div>
        <div className="px-3 pb-3 pt-2 small text-muted">
          {tx('O site mostra a tradução publicada a quem escolher essa língua; o que faltar aparece em português.')}
          {d.ia ? tx(' Ao publicar, o tradutor automático ({0}) traduz para as outras línguas; reveja e corrija quando puder.', { 0: d.tradutor }) : tx(' A tradução automática não está ativa no servidor: traduza à mão.')}
        </div>
      </Painel>
      {aberta && <EditorTraducao colecao={colecao} id={id} lingua={aberta} d={d} fechar={() => setAberta(null)} recarregar={carregar} />}
    </>
  )
}

function EditorTraducao({ colecao, id, lingua, d, fechar, recarregar }) {
  const t = d.traducoes[lingua]
  const [textos, setTextos] = useState(() => ({ ...(t?.textos || {}) }))
  const [filtro, setFiltro] = useState(t ? 'rever' : 'todos')
  const [ocupado, setOcupado] = useState('')
  const [msg, setMsg] = useState(null)
  const desat = useMemo(() => new Set(t?.desatualizados || []), [t])
  const caminhos = Object.keys(d.originais)
  const visiveis = filtro === 'todos' ? caminhos : caminhos.filter((c) => !textos[c] || desat.has(c))
  const feitos = caminhos.filter((c) => textos[c]?.trim()).length
  const alterado = JSON.stringify(textos) !== JSON.stringify(t?.textos || {})

  async function ia() {
    if (alterado && !(await confirmar(tx('O tradutor automático traduz o que falta e o que mudou no original. As alterações por guardar nesta janela perdem-se. Continuar?'), { titulo: tx('Tradução automática'), botao: tx('Traduzir') }))) return
    setOcupado('ia')
    setMsg(null)
    try {
      const r = await api(`/traducoes/${colecao}/${id}/${lingua}/ia`, { metodo: 'POST' })
      setTextos({ ...r.traducao.textos })
      setMsg({ tipo: 'success', texto: r.traduzidos ? tx('{0} texto(s) traduzido(s) automaticamente. Reveja e publique.', { 0: r.traduzidos }) : tx('Não havia nada novo para traduzir.') })
      setFiltro('todos')
      recarregar()
    } catch (e) {
      setMsg({ tipo: 'danger', texto: e.message })
    } finally {
      setOcupado('')
    }
  }
  async function guardar(estado) {
    setOcupado(estado)
    setMsg(null)
    try {
      await api(`/traducoes/${colecao}/${id}/${lingua}`, { metodo: 'PUT', corpo: { textos, estado } })
      await recarregar()
      if (estado === 'publicada') fechar()
      else setMsg({ tipo: 'success', texto: tx('Rascunho guardado.') })
    } catch (e) {
      setMsg({ tipo: 'danger', texto: e.message })
    } finally {
      setOcupado('')
    }
  }
  async function apagar() {
    if (!(await confirmar(tx('Apagar a tradução em {0}? O site volta a mostrar o original em português nessa língua.', { 0: d.linguas[lingua] }), { titulo: tx('Apagar tradução'), botao: tx('Apagar'), perigo: true }))) return
    await api(`/traducoes/${colecao}/${id}/${lingua}`, { metodo: 'DELETE' })
    await recarregar()
    fechar()
  }

  // desenhada no <body>, acima da barra lateral e da barra do editor
  return createPortal(
    <>
      <div className="modal d-block" style={{ zIndex: 2050 }} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="trad-titulo">
        <div className="modal-dialog modal-xl modal-dialog-scrollable" style={{ maxWidth: 1240 }}>
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title" id="trad-titulo"><i className="fa fa-language me-2" />{tx('Tradução —')} {d.linguas[lingua]}
                <small className="d-block fs-12px text-muted fw-normal mt-1">{feitos} {tx('de')} {caminhos.length} {tx('textos traduzidos')}{t?.automatica ? tx(' · tradução automática') : ''}{t ? ` · ${t.estado === 'publicada' ? tx('publicada') : tx('rascunho')}` : ''}</small>
              </h4>
              <button type="button" className="btn-close" onClick={fechar} aria-label={tx('Fechar')} />
            </div>
            <div className="px-3 py-2 border-bottom d-flex flex-wrap gap-2 align-items-center">
              <button type="button" className="btn btn-sm btn-theme" onClick={ia} disabled={!d.ia || !d.podeEditar || Boolean(ocupado)} title={d.ia ? '' : tx('Falta a chave ANTHROPIC_API_KEY no servidor')}>
                <i className={`fa ${ocupado === 'ia' ? 'fa-circle-notch fa-spin' : 'fa-magic'} me-1`} />{ocupado === 'ia' ? tx('A traduzir…') : tx('Tradução automática')}
              </button>
              <div className="btn-group btn-group-sm">
                <button type="button" className={`btn ${filtro === 'rever' ? 'btn-dark' : 'btn-white'}`} onClick={() => setFiltro('rever')}>{tx('Por traduzir ou mudados (')}{caminhos.filter((c) => !textos[c] || desat.has(c)).length})</button>
                <button type="button" className={`btn ${filtro === 'todos' ? 'btn-dark' : 'btn-white'}`} onClick={() => setFiltro('todos')}>{tx('Todos (')}{caminhos.length})</button>
              </div>
              {msg && <span className={`small text-${msg.tipo} ms-2`}>{msg.texto}</span>}
            </div>
            <div className="modal-body p-0">
              <div className="row g-0 border-bottom bg-light small fw-bold text-muted d-none d-lg-flex">
                <div className="col-lg-6 px-3 py-2">{tx('Original (português)')}</div>
                <div className="col-lg-6 px-3 py-2 border-start">{d.linguas[lingua]}</div>
              </div>
              {visiveis.length === 0 && <p className="text-center text-muted py-5 mb-0">{tx('Está tudo traduzido. Veja "Todos" para rever.')}</p>}
              {visiveis.map((c) => {
                const original = d.originais[c]
                const linhas = Math.min(14, Math.max(2, Math.ceil(original.length / 80)))
                return (
                  <div key={c} className="row g-0 border-bottom">
                    <div className="col-lg-6 px-3 py-2">
                      <div className="small text-muted mb-1">{rotulo(c)} {desat.has(c) && <span className="badge bg-warning text-dark ms-1">{tx('o original mudou')}</span>}</div>
                      <div style={{ whiteSpace: 'pre-wrap' }} className="fs-13px">{original}</div>
                    </div>
                    <div className="col-lg-6 px-3 py-2 border-start">
                      <textarea className="form-control fs-13px" rows={linhas} lang={lingua} value={textos[c] || ''} onChange={(e) => setTextos({ ...textos, [c]: e.target.value })} readOnly={!d.podeEditar} aria-label={tx('{0} em {1}', { 0: rotulo(c), 1: d.linguas[lingua] })} />
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="modal-footer">
              {t && d.podeEditar && <button type="button" className="btn btn-white text-danger me-auto" onClick={apagar}><i className="fa fa-trash-alt me-1" />{tx('Apagar tradução')}</button>}
              <button type="button" className="btn btn-white" onClick={fechar}>{tx('Fechar')}</button>
              {d.podeEditar && <button type="button" className="btn btn-white" disabled={Boolean(ocupado)} onClick={() => guardar('rascunho')}><i className="fa fa-save me-1" />{tx('Guardar rascunho')}</button>}
              {d.podePublicar && <button type="button" className="btn btn-theme" disabled={Boolean(ocupado)} onClick={() => guardar('publicada')}><i className="fa fa-globe me-1" />{tx('Publicar tradução')}</button>}
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" style={{ zIndex: 2040 }} />
    </>,
    document.body,
  )
}

export default Traducoes
