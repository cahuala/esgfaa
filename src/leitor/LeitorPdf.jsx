import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { FaChevronLeft, FaChevronRight, FaColumns, FaCompress, FaDownload, FaExpand, FaMinus, FaPlus, FaRegFile } from 'react-icons/fa'
import { t } from '../i18n/linguas'
import styles from './LeitorPdf.module.css'
import { carregarPdfjs } from './pdfjs'

/*
  Leitor de PDF dentro da página (pdf.js), usado pela revista no site e pelos materiais no portal.
  Desenha só as páginas perto do ecrã, em página simples ou dupla (como uma revista aberta),
  com zoom, ir para a página, ecrã inteiro e descarga. Funciona igual no telemóvel.

  fonte: endereço do PDF ou { data: Uint8Array }; descarregar: endereço do ficheiro (ou função)
  ref: { irPara(n) } para saltar para uma página (ex.: a partir do sumário)
  Para mudar de documento, dê-lhe uma key nova (o leitor começa do zero).
*/

const ZOOMS = [0.5, 0.67, 0.8, 1, 1.25, 1.5, 2, 3]
const PIXEIS = () => Math.min(window.devicePixelRatio || 1, 2)


// uma página: só se desenha quando está perto do ecrã (e apaga-se quando fica longe, para poupar memória)
function Pagina({ doc, numero, largura, proporcao, raiz, registar }) {
  const caixa = useRef(null)
  const tela = useRef(null)
  const [perto, setPerto] = useState(numero <= 2)
  const [pronta, setPronta] = useState(false)

  useEffect(() => {
    const el = caixa.current
    if (!el) return undefined
    registar(numero, el)
    const obs = new IntersectionObserver(([e]) => setPerto(e.isIntersecting), { root: raiz.current, rootMargin: '900px 0px' })
    obs.observe(el)
    return () => { obs.disconnect(); registar(numero, null) }
  }, [numero, raiz, registar])

  useEffect(() => {
    const c = tela.current
    if (!perto || !c || !largura) {
      if (c && !perto) { c.width = 0; c.height = 0; setPronta(false) }
      return undefined
    }
    let tarefa = null
    let cancelada = false
    doc.getPage(numero).then((p) => {
      if (cancelada) return
      const base = p.getViewport({ scale: 1 })
      const vp = p.getViewport({ scale: (largura / base.width) * PIXEIS() })
      c.width = Math.floor(vp.width)
      c.height = Math.floor(vp.height)
      tarefa = p.render({ canvas: c, viewport: vp })
      return tarefa.promise.then(() => { if (!cancelada) setPronta(true) })
    }).catch((e) => { if (e?.name !== 'RenderingCancelledException') console.warn(e) })
    return () => { cancelada = true; tarefa?.cancel() }
  }, [doc, numero, largura, perto])

  return (
    <div ref={caixa} className={styles.pagina} style={{ width: largura, height: largura * proporcao }} role="img" aria-label={t('Página {n}', { n: numero })} data-pagina={numero}>
      <canvas ref={tela} className={pronta ? styles.tela : `${styles.tela} ${styles.aDesenhar}`} />
      {!pronta && <span className={styles.numeroFundo} aria-hidden="true">{numero}</span>}
    </div>
  )
}

function LeitorPdf({ fonte, titulo, descarregar, nomeFicheiro, duplaPorOmissao = false, altura, ref }) {
  const raiz = useRef(null)
  const area = useRef(null)
  const paginas = useRef(new Map())
  const [doc, setDoc] = useState(null)
  const [erro, setErro] = useState(null)
  const [progresso, setProgresso] = useState(0)
  const [proporcao, setProporcao] = useState(1.414)
  const [largura, setLargura] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [dupla, setDupla] = useState(duplaPorOmissao)
  const [atual, setAtual] = useState(1)
  const [campo, setCampo] = useState('1')
  const [inteiro, setInteiro] = useState(false)

  // página à vista, para a manter ao mudar o zoom ou a disposição
  const manter = useRef(1)

  // abrir o documento
  useEffect(() => {
    let tarefa = null
    let ativo = true
    carregarPdfjs().then(async (lib) => {
      tarefa = lib.getDocument(typeof fonte === 'string' ? { url: fonte } : fonte)
      tarefa.onProgress = ({ loaded, total }) => { if (ativo && total) setProgresso(loaded / total) }
      const d = await tarefa.promise
      const p1 = await d.getPage(1)
      const v = p1.getViewport({ scale: 1 })
      if (!ativo) return
      setProporcao(v.height / v.width)
      setDoc(d)
    }).catch((e) => { if (ativo) { console.warn(e); setErro(t('Não foi possível abrir o PDF.')) } })
    return () => { ativo = false; tarefa?.destroy() }
  }, [fonte])

  // largura disponível (muda com a janela e o ecrã inteiro)
  useEffect(() => {
    const el = area.current
    if (!el) return undefined
    const obs = new ResizeObserver(([e]) => setLargura(e.contentRect.width))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    const mudou = () => setInteiro(document.fullscreenElement === raiz.current)
    document.addEventListener('fullscreenchange', mudou)
    return () => document.removeEventListener('fullscreenchange', mudou)
  }, [])

  const total = doc?.numPages || 0
  const larga = largura >= 820
  const emDupla = dupla && larga && total > 1
  // página simples: até 900 px; dupla: metade do espaço cada (a capa fica sozinha, como numa revista)
  const larguraPagina = useMemo(() => {
    if (!largura) return 0
    const util = largura - 32
    const base = emDupla ? Math.min((util - 12) / 2, 620) : Math.min(util, 900)
    return Math.max(120, Math.floor(base * zoom))
  }, [largura, zoom, emDupla])
  const linhas = useMemo(() => {
    const ns = Array.from({ length: total }, (_, i) => i + 1)
    if (!emDupla) return ns.map((n) => [n])
    const r = [[1]]
    for (let i = 2; i <= total; i += 2) r.push(i + 1 <= total ? [i, i + 1] : [i])
    return r
  }, [total, emDupla])

  const registar = useCallback((n, el) => { if (el) paginas.current.set(n, el); else paginas.current.delete(n) }, [])

  const irPara = useCallback((n) => {
    const alvo = Math.min(Math.max(1, Number(n) || 1), total || 1)
    const el = paginas.current.get(alvo)
    const contentor = area.current
    if (el && contentor) contentor.scrollTo({ top: el.offsetTop - 16, behavior: 'smooth' })
    manter.current = alvo
    setAtual(alvo); setCampo(String(alvo))
  }, [total])
  useImperativeHandle(ref, () => ({ irPara }), [irPara])

  // página atual: a primeira cujo fundo passa do primeiro terço da área visível
  function aoRolar() {
    const c = area.current
    if (!c) return
    const linha = c.scrollTop + c.clientHeight / 3
    // em página dupla as duas da mesma linha têm a mesma altura: conta a primeira
    let n = 1
    let topo = -1
    for (const [k, el] of [...paginas.current.entries()].sort((a, b) => a[0] - b[0])) {
      if (el.offsetTop <= linha && el.offsetTop > topo) { n = k; topo = el.offsetTop }
    }
    manter.current = n
    if (n !== atual) { setAtual(n); setCampo(String(n)) }
  }

  // ao mudar o zoom ou a disposição, mantém a página que estava à vista
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const el = paginas.current.get(manter.current)
      if (el && area.current) area.current.scrollTop = el.offsetTop - 16
    })
    return () => cancelAnimationFrame(id)
  }, [larguraPagina, emDupla])

  // anterior / seguinte andam uma linha (uma página, ou duas em página dupla)
  const linhaAtual = Math.max(0, linhas.findIndex((l) => l.includes(atual)))
  const anterior = () => irPara(linhas[Math.max(0, linhaAtual - 1)]?.[0])
  const seguinte = () => irPara(linhas[Math.min(linhas.length - 1, linhaAtual + 1)]?.[0])
  const zoomIdx = ZOOMS.indexOf(zoom)

  function teclas(e) {
    if (e.target.tagName === 'INPUT') return
    if (['ArrowRight', 'PageDown'].includes(e.key)) { e.preventDefault(); seguinte() }
    if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); anterior() }
    if (e.key === 'Home') { e.preventDefault(); irPara(1) }
    if (e.key === 'End') { e.preventDefault(); irPara(total) }
  }

  function ecraInteiro() {
    if (document.fullscreenElement) document.exitFullscreen?.()
    else raiz.current?.requestFullscreen?.().catch(() => {})
  }

  const botaoDescarga = descarregar && (typeof descarregar === 'function'
    ? <button type="button" className={styles.botao} onClick={descarregar} title={t('Descarregar o PDF')}><FaDownload aria-hidden="true" /><span className={styles.soLargo}>{t('Descarregar')}</span></button>
    : <a className={styles.botao} href={descarregar} download={nomeFicheiro || true} title={t('Descarregar o PDF')}><FaDownload aria-hidden="true" /><span className={styles.soLargo}>{t('Descarregar')}</span></a>)

  return (
    <section ref={raiz} className={`${styles.leitor} ${inteiro ? styles.inteiro : ''}`} style={altura && !inteiro ? { '--altura': altura } : undefined} aria-label={titulo ? t('Leitor: {titulo}', { titulo }) : t('Leitor de PDF')} onKeyDown={teclas}>
      <div className={styles.barra} role="toolbar" aria-label={t('Controlos do leitor')}>
        <div className={styles.titulo}><FaRegFile aria-hidden="true" /><span>{titulo}</span></div>
        <div className={styles.grupo}>
          <button type="button" className={styles.botao} onClick={anterior} disabled={!doc || linhaAtual <= 0} aria-label={t('Página anterior')}><FaChevronLeft aria-hidden="true" /></button>
          <form className={styles.paginaAtual} onSubmit={(e) => { e.preventDefault(); irPara(campo) }}>
            <input value={campo} onChange={(e) => setCampo(e.target.value.replace(/\D/g, ''))} onBlur={() => irPara(campo)} inputMode="numeric" aria-label={t('Página atual')} disabled={!doc} />
            <span>/ {total || '…'}</span>
          </form>
          <button type="button" className={styles.botao} onClick={seguinte} disabled={!doc || linhaAtual >= linhas.length - 1} aria-label={t('Página seguinte')}><FaChevronRight aria-hidden="true" /></button>
        </div>
        <div className={styles.grupo}>
          <button type="button" className={styles.botao} onClick={() => setZoom(ZOOMS[Math.max(0, zoomIdx - 1)])} disabled={zoomIdx <= 0} aria-label={t('Diminuir')}><FaMinus aria-hidden="true" /></button>
          <button type="button" className={`${styles.botao} ${styles.zoom}`} onClick={() => setZoom(1)} title={t('Ajustar à largura')}>{Math.round(zoom * 100)}%</button>
          <button type="button" className={styles.botao} onClick={() => setZoom(ZOOMS[Math.min(ZOOMS.length - 1, zoomIdx + 1)])} disabled={zoomIdx >= ZOOMS.length - 1} aria-label={t('Aumentar')}><FaPlus aria-hidden="true" /></button>
        </div>
        <div className={styles.grupo}>
          {larga && total > 1 && (
            <button type="button" className={`${styles.botao} ${emDupla ? styles.ativo : ''}`} onClick={() => setDupla(!dupla)} aria-pressed={emDupla} title={t('Página dupla')}>
              <FaColumns aria-hidden="true" /><span className={styles.soLargo}>{t('Página dupla')}</span>
            </button>
          )}
          <button type="button" className={styles.botao} onClick={ecraInteiro} aria-label={inteiro ? t('Sair do ecrã inteiro') : t('Ecrã inteiro')} title={inteiro ? t('Sair do ecrã inteiro') : t('Ecrã inteiro')}>
            {inteiro ? <FaCompress aria-hidden="true" /> : <FaExpand aria-hidden="true" />}
          </button>
          {botaoDescarga}
        </div>
      </div>

      <div ref={area} className={styles.area} onScroll={aoRolar} tabIndex={0} aria-label={t('Páginas do documento')}>
        {erro && (
          <div className={styles.aviso}>
            <p>{erro}</p>
            {typeof descarregar === 'string' && <a className={styles.botao} href={descarregar} download={nomeFicheiro || true}><FaDownload aria-hidden="true" /> {t('Descarregar o PDF')}</a>}
          </div>
        )}
        {!erro && !doc && (
          <div className={styles.aviso} role="status">
            <div className={styles.barraProgresso}><span style={{ width: `${Math.round(progresso * 100)}%` }} /></div>
            <p>{progresso ? t('A abrir o documento… {n}%', { n: Math.round(progresso * 100) }) : t('A abrir o documento…')}</p>
          </div>
        )}
        {doc && larguraPagina > 0 && linhas.map((l) => (
          <div key={l.join('-')} className={styles.linha}>
            {l.map((n) => <Pagina key={n} doc={doc} numero={n} largura={larguraPagina} proporcao={proporcao} raiz={area} registar={registar} />)}
          </div>
        ))}
      </div>
    </section>
  )
}

export default LeitorPdf
