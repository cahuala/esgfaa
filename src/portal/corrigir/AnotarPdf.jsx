import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { carregarFicheiro } from '../api'
import { carregarPdfjs } from '../../leitor/pdfjs'
import { alturaNota, LARGURA_NOTA, partirLinhas, TAMANHO_LETRA } from './gerarPdf'
import { t as tx } from '../../i18n/linguas'

/*
  Correção no navegador (como o "anotar PDF" do Moodle): o docente escreve por cima do PDF
  entregue — caneta, realce, comentários, ✓ e ✗ —, e o portal gera o PDF corrigido para o estudante.
  As anotações ficam em coordenadas da página (escala 1), para se poderem voltar a editar.
*/
const FERRAMENTAS = [
  { id: 'caneta', icone: 'fa-pen', nome: tx('Caneta') },
  { id: 'realce', icone: 'fa-highlighter', nome: tx('Realce') },
  { id: 'texto', icone: 'fa-comment-alt', nome: tx('Comentário') },
  { id: 'certo', icone: 'fa-check', nome: tx('Certo') },
  { id: 'errado', icone: 'fa-times', nome: tx('Errado') },
  { id: 'borracha', icone: 'fa-eraser', nome: tx('Apagar') },
]
const CORES = [['#e53917', tx('Vermelho')], ['#2f5fa8', tx('Azul')], ['#1e7d4b', tx('Verde')], ['#f2c200', tx('Amarelo')]]
const PIXEIS = () => Math.min(window.devicePixelRatio || 1, 2)

// medida aproximada do texto no ecrã (a do PDF usa a mesma letra, Helvetica)
let contexto = null
const medirEcra = (t) => {
  contexto ||= document.createElement('canvas').getContext('2d')
  contexto.font = `${TAMANHO_LETRA}px Helvetica, Arial, sans-serif`
  return contexto.measureText(t).width
}

function Folha({ doc, numero, tamanho, escala, anotacoes, atual, ferramenta, cor, aoAnotar, aoApagar, aoComentar }) {
  const tela = useRef(null)
  const svg = useRef(null)
  const [desenho, setDesenho] = useState(null)
  const largura = tamanho.w * escala

  useEffect(() => {
    let tarefa = null
    let ativo = true
    doc.getPage(numero).then((p) => {
      if (!ativo || !tela.current) return
      const vp = p.getViewport({ scale: escala * PIXEIS() })
      tela.current.width = Math.floor(vp.width)
      tela.current.height = Math.floor(vp.height)
      tarefa = p.render({ canvas: tela.current, viewport: vp })
      return tarefa.promise
    }).catch(() => {})
    return () => { ativo = false; tarefa?.cancel() }
  }, [doc, numero, escala])

  // posição do ponteiro em coordenadas da página (escala 1)
  const ponto = (e) => {
    const r = svg.current.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * tamanho.w, ((e.clientY - r.top) / r.height) * tamanho.h]
  }
  function baixo(e) {
    if (e.button !== 0) return
    const [x, y] = ponto(e)
    if (ferramenta === 'borracha') {
      const i = e.target.closest?.('[data-i]')?.dataset.i
      if (i !== undefined) aoApagar(Number(i))
      return
    }
    if (ferramenta === 'certo' || ferramenta === 'errado') { aoAnotar({ pagina: numero, tipo: ferramenta, cor: ferramenta === 'certo' && cor === '#e53917' ? '#1e7d4b' : cor, x, y }); return }
    if (ferramenta === 'texto') { aoComentar({ pagina: numero, x, y }); return }
    svg.current.setPointerCapture(e.pointerId)
    if (ferramenta === 'caneta') setDesenho({ pagina: numero, tipo: 'caneta', cor, espessura: 2, pontos: [[x, y]] })
    if (ferramenta === 'realce') setDesenho({ pagina: numero, tipo: 'realce', cor: cor === '#e53917' ? '#f2c200' : cor, x0: x, y0: y, x, y, w: 0, h: 0 })
  }
  function mover(e) {
    if (!desenho) return
    const [x, y] = ponto(e)
    if (desenho.tipo === 'caneta') {
      const [ux, uy] = desenho.pontos.at(-1)
      if (Math.hypot(x - ux, y - uy) > 1.2) setDesenho({ ...desenho, pontos: [...desenho.pontos, [x, y]] })
    } else {
      setDesenho({ ...desenho, x: Math.min(x, desenho.x0), y: Math.min(y, desenho.y0), w: Math.abs(x - desenho.x0), h: Math.abs(y - desenho.y0) })
    }
  }
  function cima() {
    if (!desenho) return
    if (desenho.tipo === 'caneta' && desenho.pontos.length > 1) aoAnotar(desenho)
    if (desenho.tipo === 'realce' && desenho.w > 3 && desenho.h > 3) { const { x0, y0, ...r } = desenho; void x0; void y0; aoAnotar(r) }
    setDesenho(null)
  }

  return (
    <div className="p-anotar-folha" style={{ width: largura, height: tamanho.h * escala }}>
      <canvas ref={tela} className="p-anotar-tela" />
      <svg ref={svg} viewBox={`0 0 ${tamanho.w} ${tamanho.h}`} className={`p-anotar-svg ferramenta-${ferramenta}`} onPointerDown={baixo} onPointerMove={mover} onPointerUp={cima} onPointerCancel={() => setDesenho(null)} role="img" aria-label={tx('Página {0}', { 0: numero })}>
        {[...anotacoes, ...(desenho ? [{ ...desenho, i: -1 }] : [])].map((a) => <Desenho key={a.i} a={a} />)}
        {atual?.pagina === numero && <rect x={atual.x} y={atual.y} width={LARGURA_NOTA} height={24} fill="none" stroke="#2f5fa8" strokeDasharray="3 2" />}
      </svg>
    </div>
  )
}

// uma anotação no ecrã (o mesmo desenho que o PDF gerado)
function Desenho({ a }) {
  const comum = { 'data-i': a.i >= 0 ? a.i : undefined, className: 'p-anotacao' }
  if (a.tipo === 'caneta') return <polyline {...comum} points={a.pontos.map((p) => p.join(',')).join(' ')} fill="none" stroke={a.cor} strokeWidth={a.espessura || 2} strokeLinecap="round" strokeLinejoin="round" />
  if (a.tipo === 'realce') return <rect {...comum} x={a.x} y={a.y} width={a.w} height={a.h} fill={a.cor} opacity={0.3} />
  if (a.tipo === 'certo') return <polyline {...comum} points={`${a.x - 7},${a.y} ${a.x - 2},${a.y + 6} ${a.x + 8},${a.y - 7}`} fill="none" stroke={a.cor} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
  if (a.tipo === 'errado') return <g {...comum} stroke={a.cor} strokeWidth={2.4} strokeLinecap="round"><line x1={a.x - 6} y1={a.y - 6} x2={a.x + 6} y2={a.y + 6} /><line x1={a.x - 6} y1={a.y + 6} x2={a.x + 6} y2={a.y - 6} /></g>
  const linhas = partirLinhas(a.texto, medirEcra)
  return (
    <g {...comum}>
      <rect x={a.x} y={a.y} width={LARGURA_NOTA} height={alturaNota(linhas)} fill="#fff8c4" stroke={a.cor} strokeWidth={0.8} />
      <text x={a.x + 5} y={a.y + 4 + TAMANHO_LETRA} fontSize={TAMANHO_LETRA} fontFamily="Helvetica, Arial, sans-serif" fill="#1f1f1f">
        {linhas.map((t, k) => <tspan key={k} x={a.x + 5} dy={k ? 11.5 : 0}>{t}</tspan>)}
      </text>
    </g>
  )
}

function AnotarPdf({ ficheiro, iniciais = [], guardar, fechar }) {
  const area = useRef(null)
  const [doc, setDoc] = useState(null)
  const [tamanhos, setTamanhos] = useState([])
  const [erro, setErro] = useState('')
  const [anotacoes, setAnotacoes] = useState(iniciais)
  const [ferramenta, setFerramenta] = useState('caneta')
  const [cor, setCor] = useState('#e53917')
  const [comentario, setComentario] = useState(null) // { pagina, x, y, texto }
  const [largura, setLargura] = useState(900)
  const [aGuardar, setAGuardar] = useState(false)
  const alterado = useRef(false)

  useEffect(() => {
    let tarefa = null
    let url = null
    let ativo = true
    Promise.all([carregarFicheiro(ficheiro.id), carregarPdfjs()]).then(async ([f, lib]) => {
      url = f.url
      tarefa = lib.getDocument({ url: f.url })
      const d = await tarefa.promise
      const lista = []
      for (let n = 1; n <= d.numPages; n++) {
        const v = (await d.getPage(n)).getViewport({ scale: 1 })
        lista.push({ w: v.width, h: v.height })
      }
      if (ativo) { setTamanhos(lista); setDoc(d) }
    }).catch((e) => { if (ativo) setErro(e.message || tx('Não foi possível abrir o PDF.')) })
    return () => { ativo = false; tarefa?.destroy(); if (url) URL.revokeObjectURL(url) }
  }, [ficheiro.id])

  useEffect(() => {
    const el = area.current
    if (!el) return undefined
    const obs = new ResizeObserver(([e]) => setLargura(e.contentRect.width))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const juntar = useCallback((a) => { alterado.current = true; setAnotacoes((l) => [...l, a]) }, [])
  const apagar = useCallback((i) => { alterado.current = true; setAnotacoes((l) => l.filter((_, k) => k !== i)) }, [])
  const desfazer = useCallback(() => { alterado.current = true; setAnotacoes((l) => l.slice(0, -1)) }, [])
  useEffect(() => {
    const tecla = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !['TEXTAREA', 'INPUT'].includes(e.target.tagName)) { e.preventDefault(); desfazer() }
    }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [desfazer])

  function fecharComentario(confirmar) {
    if (confirmar && comentario?.texto?.trim()) juntar({ pagina: comentario.pagina, tipo: 'texto', cor, x: comentario.x, y: comentario.y, texto: comentario.texto.trim() })
    setComentario(null)
  }
  async function concluir() {
    setAGuardar(true)
    try {
      await guardar(anotacoes)
    } catch (e) {
      setErro(e.message)
      setAGuardar(false)
    }
  }
  function sair() {
    if (alterado.current && !window.confirm(tx('Sair sem guardar as anotações?'))) return
    fechar()
  }

  const maior = Math.max(...tamanhos.map((t) => t.w), 1)
  const escala = Math.min(largura - 40, 1000) / maior
  const porPagina = useMemo(() => anotacoes.map((a, i) => ({ ...a, i })).reduce((m, a) => ((m[a.pagina] ||= []).push(a), m), {}), [anotacoes])

  return createPortal(
    <div className="p-anotar" role="dialog" aria-modal="true" aria-label={tx('Corrigir no PDF: {0}', { 0: ficheiro.nome })}>
      <div className="p-anotar-barra">
        <div className="p-anotar-titulo"><i className="fa fa-file-pdf me-2" />{ficheiro.nome}</div>
        <div className="btn-group" role="group" aria-label={tx('Ferramentas')}>
          {FERRAMENTAS.map((f) => (
            <button key={f.id} type="button" className={`btn btn-sm ${ferramenta === f.id ? 'btn-theme' : 'btn-dark'}`} onClick={() => setFerramenta(f.id)} aria-pressed={ferramenta === f.id} title={f.nome}>
              <i className={`fa ${f.icone}`} /><span className="d-none d-xl-inline ms-1">{f.nome}</span>
            </button>
          ))}
        </div>
        <div className="d-flex gap-1" role="group" aria-label={tx('Cor')}>
          {CORES.map(([c, nome]) => <button key={c} type="button" className={`p-anotar-cor ${cor === c ? 'ativa' : ''}`} style={{ background: c }} onClick={() => setCor(c)} aria-label={nome} aria-pressed={cor === c} title={nome} />)}
        </div>
        <button type="button" className="btn btn-sm btn-dark" onClick={desfazer} disabled={!anotacoes.length} title={tx('Desfazer (Ctrl+Z)')}><i className="fa fa-undo" /></button>
        <span className="small text-white-50 ms-auto">{tx('{0} anotação(ões)', { 0: anotacoes.length })}</span>
        <button type="button" className="btn btn-sm btn-white" onClick={sair} disabled={aGuardar}>{tx('Cancelar')}</button>
        <button type="button" className="btn btn-sm btn-theme" onClick={concluir} disabled={aGuardar || !doc}><i className="fa fa-check me-1" />{aGuardar ? tx('A preparar o PDF…') : tx('Concluir correção')}</button>
      </div>
      <div className="p-anotar-dica">{{
        caneta: tx('Escreva ou sublinhe com o rato, o dedo ou a caneta do tablet.'),
        realce: tx('Arraste para realçar uma passagem.'),
        texto: tx('Clique onde quer deixar o comentário.'),
        certo: tx('Clique para marcar como certo.'),
        errado: tx('Clique para marcar como errado.'),
        borracha: tx('Clique numa anotação para a apagar.'),
      }[ferramenta]}</div>
      <div className="p-anotar-area" ref={area}>
        {erro && <div className="alert alert-danger m-3">{erro}</div>}
        {!doc && !erro && <div className="text-white-50 p-4">{tx('A abrir o documento…')}</div>}
        {doc && tamanhos.map((t, k) => (
          <div key={k} className="p-anotar-pagina">
            <Folha doc={doc} numero={k + 1} tamanho={t} escala={escala} anotacoes={porPagina[k + 1] || []} atual={comentario} ferramenta={ferramenta} cor={cor} aoAnotar={juntar} aoApagar={apagar} aoComentar={(c) => setComentario({ ...c, texto: '' })} />
            {comentario?.pagina === k + 1 && (
              <div className="p-anotar-comentario" style={{ left: comentario.x * escala, top: comentario.y * escala }}>
                <textarea autoFocus rows={3} value={comentario.texto} onChange={(e) => setComentario({ ...comentario, texto: e.target.value })} placeholder={tx('Comentário para o estudante')}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) fecharComentario(true); if (e.key === 'Escape') fecharComentario(false) }} aria-label={tx('Comentário para o estudante')} />
                <div className="d-flex gap-1 justify-content-end mt-1">
                  <button type="button" className="btn btn-xs btn-white" onClick={() => fecharComentario(false)}>{tx('Cancelar')}</button>
                  <button type="button" className="btn btn-xs btn-theme" onClick={() => fecharComentario(true)}>{tx('Juntar')}</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>,
    document.body,
  )
}

export default AnotarPdf
