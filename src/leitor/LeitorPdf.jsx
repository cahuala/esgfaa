import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { FaChevronLeft, FaChevronRight, FaCompress, FaDownload, FaExpand, FaMinus, FaPlus } from 'react-icons/fa'
import { t } from '../i18n/linguas'
import { carregarPdfjs } from './pdfjs'
import styles from './LeitorPdf.module.css'

/*
  Leitor de PDF com aspeto de página web: as páginas seguem-se na própria página (sem moldura
  nem caixa de rolagem), à largura do texto, e o texto é texto — seleciona-se e encontra-se
  com Ctrl+F. Só se desenham as páginas perto do ecrã. Usado no site (revista) e no portal.

  fonte: endereço do PDF ou { data }; descarregar: endereço ou função (sem ele, não há botão)
  protegido: para ler e não levar (biblioteca) — sem texto selecionável, sem menu do botão
    direito, sem imprimir nem guardar com o teclado, e com uma marca de água (marca)
  topo: altura do cabeçalho fixo da página, para a barra do leitor ficar logo abaixo
  ref: { irPara(n) } — saltar para uma página (ex.: a partir do sumário)
  Para mudar de documento, dê-lhe uma key nova.
*/
const ZOOMS = [0.75, 1, 1.25, 1.5, 2]
const PIXEIS = () => Math.min(window.devicePixelRatio || 1, 2)

function Pagina({ doc, lib, numero, largura, proporcao, registar, comTexto, marca }) {
  const caixa = useRef(null)
  const tela = useRef(null)
  const texto = useRef(null)
  const [perto, setPerto] = useState(numero <= 2)
  const [pronta, setPronta] = useState(false)

  useEffect(() => {
    const el = caixa.current
    if (!el) return undefined
    registar(numero, el)
    const obs = new IntersectionObserver(([e]) => setPerto(e.isIntersecting), { rootMargin: '1200px 0px' })
    obs.observe(el)
    return () => { obs.disconnect(); registar(numero, null) }
  }, [numero, registar])

  useEffect(() => {
    const c = tela.current
    if (!perto || !c || !largura) {
      if (c && !perto) { c.width = 0; c.height = 0; setPronta(false); texto.current?.replaceChildren() }
      return undefined
    }
    let tarefa = null
    let camada = null
    let cancelada = false
    doc.getPage(numero).then(async (p) => {
      if (cancelada) return
      const escala = largura / p.getViewport({ scale: 1 }).width
      const vp = p.getViewport({ scale: escala * PIXEIS() })
      c.width = Math.floor(vp.width)
      c.height = Math.floor(vp.height)
      tarefa = p.render({ canvas: c, viewport: vp })
      await tarefa.promise
      if (cancelada) return
      setPronta(true)
      // o texto da página por cima do desenho: invisível, mas seleciona-se e pesquisa-se como numa página web
      if (comTexto && texto.current) {
        texto.current.replaceChildren()
        texto.current.style.setProperty('--scale-factor', escala)
        texto.current.style.setProperty('--total-scale-factor', escala)
        camada = new lib.TextLayer({ textContentSource: p.streamTextContent(), container: texto.current, viewport: p.getViewport({ scale: escala }) })
        await camada.render()
      }
    }).catch((e) => { if (e?.name !== 'RenderingCancelledException' && e?.name !== 'AbortException') console.warn(e) })
    return () => { cancelada = true; tarefa?.cancel(); camada?.cancel() }
  }, [doc, lib, numero, largura, perto, comTexto])

  return (
    <div ref={caixa} className={styles.pagina} style={{ width: largura, height: largura * proporcao }} data-pagina={numero}>
      <canvas ref={tela} className={pronta ? styles.tela : `${styles.tela} ${styles.aDesenhar}`} aria-hidden="true" />
      {comTexto && <div ref={texto} className={`textLayer ${styles.texto}`} />}
      {marca && <div className={styles.marca} aria-hidden="true"><span>{marca}</span><span>{marca}</span><span>{marca}</span></div>}
      {!pronta && <span className={styles.numeroFundo} aria-hidden="true">{numero}</span>}
    </div>
  )
}

function LeitorPdf({ fonte, titulo, descarregar, nomeFicheiro, protegido = false, marca = '', topo = 60, ref }) {
  const raiz = useRef(null)
  const area = useRef(null)
  const paginas = useRef(new Map())
  const manter = useRef(1)
  const [lib, setLib] = useState(null)
  const [doc, setDoc] = useState(null)
  const [erro, setErro] = useState(null)
  const [progresso, setProgresso] = useState(0)
  const [proporcao, setProporcao] = useState(1.414)
  const [largura, setLargura] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [atual, setAtual] = useState(1)
  const [campo, setCampo] = useState('1')
  const [inteiro, setInteiro] = useState(false)

  useEffect(() => {
    let tarefa = null
    let ativo = true
    carregarPdfjs().then(async (l) => {
      tarefa = l.getDocument(typeof fonte === 'string' ? { url: fonte } : fonte)
      tarefa.onProgress = ({ loaded, total }) => { if (ativo && total) setProgresso(loaded / total) }
      const d = await tarefa.promise
      const v = (await d.getPage(1)).getViewport({ scale: 1 })
      if (!ativo) return
      setProporcao(v.height / v.width)
      setLib(l)
      setDoc(d)
    }).catch((e) => { if (ativo) { console.warn(e); setErro(t('Não foi possível abrir o PDF.')) } })
    return () => { ativo = false; tarefa?.destroy() }
  }, [fonte])

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

  // protegido: sem imprimir nem guardar pelo teclado; a impressão da página sai sem a obra
  useEffect(() => {
    if (!protegido) return undefined
    document.body.classList.add('leitura-protegida')
    const tecla = (e) => { if ((e.ctrlKey || e.metaKey) && ['s', 'p'].includes(e.key.toLowerCase())) e.preventDefault() }
    window.addEventListener('keydown', tecla, true)
    return () => { document.body.classList.remove('leitura-protegida'); window.removeEventListener('keydown', tecla, true) }
  }, [protegido])

  const total = doc?.numPages || 0
  // à largura do texto de uma página web (até 900 px); com zoom pode passar a largura e rola-se para o lado
  const larguraPagina = useMemo(() => (largura ? Math.max(200, Math.floor(Math.min(largura, 900) * zoom)) : 0), [largura, zoom])
  const registar = useCallback((n, el) => { if (el) paginas.current.set(n, el); else paginas.current.delete(n) }, [])

  const irPara = useCallback((n) => {
    const alvo = Math.min(Math.max(1, Number(n) || 1), total || 1)
    const el = paginas.current.get(alvo)
    if (el) {
      if (document.fullscreenElement === raiz.current) raiz.current.scrollTo({ top: el.offsetTop - 56, behavior: 'smooth' })
      else window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - topo - 56, behavior: 'smooth' })
    }
    manter.current = alvo
    setAtual(alvo); setCampo(String(alvo))
  }, [total, topo])
  useImperativeHandle(ref, () => ({ irPara }), [irPara])

  // página atual: a última cujo cimo já passou o primeiro terço do ecrã
  useEffect(() => {
    if (!doc) return undefined
    const alvo = inteiro ? raiz.current : window
    const aoRolar = () => {
      const linha = window.innerHeight / 3
      let n = 1
      for (const [k, el] of [...paginas.current.entries()].sort((a, b) => a[0] - b[0])) if (el.getBoundingClientRect().top <= linha) n = k
      manter.current = n
      setAtual(n)
      setCampo(String(n))
    }
    alvo.addEventListener('scroll', aoRolar, { passive: true })
    return () => alvo.removeEventListener('scroll', aoRolar)
  }, [doc, inteiro])

  // ao mudar o zoom, fica na mesma página
  const ultimaLargura = useRef(0)
  useEffect(() => {
    if (ultimaLargura.current && ultimaLargura.current !== larguraPagina && manter.current > 1) requestAnimationFrame(() => irPara(manter.current))
    ultimaLargura.current = larguraPagina
  }, [larguraPagina, irPara])

  function ecraInteiro() {
    if (document.fullscreenElement) document.exitFullscreen?.()
    else raiz.current?.requestFullscreen?.().catch(() => {})
  }

  const zoomIdx = ZOOMS.indexOf(zoom)
  const botaoDescarga = !protegido && descarregar && (typeof descarregar === 'function'
    ? <button type="button" className={styles.botao} onClick={descarregar} title={t('Descarregar o PDF')}><FaDownload aria-hidden="true" /><span className={styles.soLargo}>{t('Descarregar')}</span></button>
    : <a className={styles.botao} href={descarregar} download={nomeFicheiro || true} title={t('Descarregar o PDF')}><FaDownload aria-hidden="true" /><span className={styles.soLargo}>{t('Descarregar')}</span></a>)

  return (
    <section
      ref={raiz}
      className={`${styles.leitor} ${inteiro ? styles.inteiro : ''} ${protegido ? styles.protegido : ''}`}
      style={{ '--leitor-topo': `${topo}px` }}
      aria-label={titulo ? t('Leitor: {titulo}', { titulo }) : t('Leitor de PDF')}
      onContextMenu={protegido ? (e) => e.preventDefault() : undefined}
      onDragStart={protegido ? (e) => e.preventDefault() : undefined}
    >
      <div className={styles.barra} role="toolbar" aria-label={t('Controlos do leitor')}>
        <div className={styles.titulo}>{titulo}</div>
        <div className={styles.grupo}>
          <button type="button" className={styles.botao} onClick={() => irPara(atual - 1)} disabled={!doc || atual <= 1} aria-label={t('Página anterior')}><FaChevronLeft aria-hidden="true" /></button>
          <form className={styles.paginaAtual} onSubmit={(e) => { e.preventDefault(); irPara(campo) }}>
            <input value={campo} onChange={(e) => setCampo(e.target.value.replace(/\D/g, ''))} onBlur={() => irPara(campo)} inputMode="numeric" aria-label={t('Página atual')} disabled={!doc} />
            <span>/ {total || '…'}</span>
          </form>
          <button type="button" className={styles.botao} onClick={() => irPara(atual + 1)} disabled={!doc || atual >= total} aria-label={t('Página seguinte')}><FaChevronRight aria-hidden="true" /></button>
        </div>
        <div className={styles.grupo}>
          <button type="button" className={styles.botao} onClick={() => setZoom(ZOOMS[Math.max(0, zoomIdx - 1)])} disabled={zoomIdx <= 0} aria-label={t('Diminuir')}><FaMinus aria-hidden="true" /></button>
          <button type="button" className={`${styles.botao} ${styles.zoom}`} onClick={() => setZoom(1)} title={t('Ajustar à largura')}>{Math.round(zoom * 100)}%</button>
          <button type="button" className={styles.botao} onClick={() => setZoom(ZOOMS[Math.min(ZOOMS.length - 1, zoomIdx + 1)])} disabled={zoomIdx >= ZOOMS.length - 1} aria-label={t('Aumentar')}><FaPlus aria-hidden="true" /></button>
        </div>
        <div className={styles.grupo}>
          <button type="button" className={styles.botao} onClick={ecraInteiro} aria-label={inteiro ? t('Sair do ecrã inteiro') : t('Ecrã inteiro')} title={inteiro ? t('Sair do ecrã inteiro') : t('Ecrã inteiro')}>
            {inteiro ? <FaCompress aria-hidden="true" /> : <FaExpand aria-hidden="true" />}
          </button>
          {botaoDescarga}
        </div>
      </div>

      <div ref={area} className={styles.area} aria-label={t('Páginas do documento')}>
        {erro && <p className={styles.aviso}>{erro}</p>}
        {!erro && !doc && (
          <div className={styles.aviso} role="status">
            <div className={styles.barraProgresso}><span style={{ width: `${Math.round(progresso * 100)}%` }} /></div>
            <p>{progresso ? t('A abrir o documento… {n}%', { n: Math.round(progresso * 100) }) : t('A abrir o documento…')}</p>
          </div>
        )}
        {doc && larguraPagina > 0 && (
          <div className={styles.paginas}>
            {Array.from({ length: total }, (_, i) => (
              <Pagina key={i + 1} doc={doc} lib={lib} numero={i + 1} largura={larguraPagina} proporcao={proporcao} registar={registar} comTexto={!protegido} marca={protegido ? marca : ''} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export default LeitorPdf
