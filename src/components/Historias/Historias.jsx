import { useCallback, useEffect, useRef, useState } from 'react'
import { t as tx, localAtual } from '../../i18n/linguas'
import css from './Historias.module.css'

/*
  Vídeos curtos como os estados do WhatsApp (site, Portal e cadeiras): uma fila de círculos — um por
  actividade ou por cadeira — e, ao tocar, o leitor em ecrã inteiro: vertical, começa sozinho, uma barra
  por vídeo no topo, toque à direita passa ao seguinte e à esquerda volta, carregar sem largar pausa.
  No fim de um grupo segue para o seguinte. Os círculos já vistos ficam cinzentos (só neste navegador).
  grupos: [{ id, titulo, subtitulo?, capa?, itens: [{ id, src | obter(), poster?, legenda?, data? }] }] — obter() dá o
  endereço só quando o vídeo se vai ver (no Portal os ficheiros pedem-se com a sessão); o seguinte prepara-se já.
  adicionar: { texto, aoClicar } — o círculo «+» de quem publica; apagar(item): o caixote no leitor;
  verMais(grupo): o botão «Ver a actividade» (abre o evento ou a notícia).
*/
const CHAVE_VISTOS = 'esg-videos-vistos'
const lerVistos = () => { try { return new Set(JSON.parse(localStorage.getItem(CHAVE_VISTOS) || '[]')) } catch { return new Set() } }
const guardarVistos = (s) => { try { localStorage.setItem(CHAVE_VISTOS, JSON.stringify([...s].slice(-500))) } catch { /* sem armazenamento: fica só nesta visita */ } }
const quando = (d) => {
  if (!d) return ''
  const data = new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T12:00:00` : d)
  return Number.isNaN(data.getTime()) ? '' : data.toLocaleDateString(localAtual(), { day: 'numeric', month: 'short' })
}

export default function Historias({ grupos, titulo = null, adicionar = null, apagar = null, verMais = null, className = '' }) {
  const [vistos, setVistos] = useState(lerVistos)
  const [aberto, setAberto] = useState(null) // { g, i }
  const cheios = grupos.filter((g) => g.itens.length)
  const visto = (item) => vistos.has(String(item.id))
  const marcar = useCallback((item) => setVistos((s) => {
    if (s.has(String(item.id))) return s
    const n = new Set(s).add(String(item.id))
    guardarVistos(n)
    return n
  }), [])
  if (!cheios.length && !adicionar) return null

  // abre no primeiro vídeo ainda por ver do grupo (como o WhatsApp)
  const abrir = (g) => { const i = cheios[g].itens.findIndex((x) => !visto(x)); setAberto({ g, i: i < 0 ? 0 : i }) }
  // os grupos com tudo visto passam para o fim
  const ordem = cheios.map((g, k) => k).sort((a, b) => Number(cheios[a].itens.every(visto)) - Number(cheios[b].itens.every(visto)))

  return (
    <section className={`${css.fila} ${className}`} aria-label={titulo || tx('Vídeos curtos')}>
      {titulo && <h2 className={css.tituloFila}>{titulo}</h2>}
      <div className={css.circulos}>
        {adicionar && (
          <button type="button" className={css.circulo} onClick={adicionar.aoClicar}>
            <span className={`${css.anel} ${css.anelNovo}`}><span className={css.mais} aria-hidden="true">+</span></span>
            <span className={css.nome}>{adicionar.texto}</span>
          </button>
        )}
        {ordem.map((k) => {
          const g = cheios[k]
          const todos = g.itens.every(visto)
          const capa = g.capa || g.itens.find((x) => x.poster)?.poster
          return (
            <button key={g.id} type="button" className={css.circulo} onClick={() => abrir(k)} title={g.titulo}>
              <span className={`${css.anel} ${todos ? css.anelVisto : ''}`}>
                <span className={css.foto}>{capa ? <img src={capa} alt="" loading="lazy" /> : <span className={css.semFoto} aria-hidden="true">▶</span>}</span>
                {g.itens.length > 1 && <span className={css.conta}>{g.itens.length}</span>}
              </span>
              <span className={css.nome}>{g.titulo}</span>
            </button>
          )
        })}
      </div>
      {aberto && (
        <Leitor
          grupos={cheios}
          inicio={aberto}
          aoVer={marcar}
          fechar={() => setAberto(null)}
          verMais={verMais && ((g) => { setAberto(null); verMais(g) })}
          apagar={apagar && (async (item) => { if (await apagar(item)) setAberto(null) })}
        />
      )}
    </section>
  )
}

function Leitor({ grupos, inicio, aoVer, fechar, apagar, verMais }) {
  const [pos, setPos] = useState(inicio)
  // o progresso e a pausa são de um vídeo: ao passar a outro começam do zero
  const [estado, setEstado] = useState({ id: null, progresso: 0, pausa: false, segurar: false })
  const [som, setSom] = useState(true)
  const video = useRef(null)
  const caixa = useRef(null)
  const premido = useRef(null)
  const g = grupos[pos.g]
  const item = g.itens[pos.i]
  const [obtidos, setObtidos] = useState({}) // id -> endereço (blob:) dos vídeos pedidos com obter()
  const criados = useRef([])
  const src = item.src ?? obtidos[item.id]
  const atual = estado.id === item.id ? estado : { id: item.id, progresso: 0, pausa: false, segurar: false }
  const { progresso, pausa } = atual
  const mudar = (m) => setEstado((e) => ({ ...(e.id === item.id ? e : { id: item.id, progresso: 0, pausa: false, segurar: false }), ...(typeof m === 'function' ? m(e.id === item.id ? e : atual) : m) }))

  const seguinte = useCallback(() => setPos((p) => {
    if (p.i + 1 < grupos[p.g].itens.length) return { g: p.g, i: p.i + 1 }
    if (p.g + 1 < grupos.length) return { g: p.g + 1, i: 0 }
    fechar()
    return p
  }), [grupos, fechar])
  const anterior = useCallback(() => setPos((p) => {
    if (p.i > 0) return { g: p.g, i: p.i - 1 }
    if (p.g > 0) return { g: p.g - 1, i: grupos[p.g - 1].itens.length - 1 }
    return p
  }), [grupos])

  useEffect(() => { aoVer(item) }, [item, aoVer])
  // o vídeo atual e o seguinte, pedidos uma só vez
  useEffect(() => {
    const prox = g.itens[pos.i + 1] ?? grupos[pos.g + 1]?.itens[0]
    for (const x of [item, prox]) {
      if (!x?.obter || criados.current.some((c) => c.id === x.id)) continue
      criados.current.push({ id: x.id, url: null })
      x.obter().then((url) => {
        const c = criados.current.find((y) => y.id === x.id)
        if (c) c.url = url
        setObtidos((m) => ({ ...m, [x.id]: url }))
      }, () => setTimeout(seguinte, 1500))
    }
  }, [item, g, grupos, pos, seguinte])
  useEffect(() => () => { for (const c of criados.current) if (c.url?.startsWith('blob:')) URL.revokeObjectURL(c.url) }, [])
  useEffect(() => {
    const v = video.current
    if (!v) return
    if (pausa) v.pause()
    else v.play().catch(() => { v.muted = true; setSom(false); v.play().catch(() => {}) }) // sem som, se o navegador não deixar
  }, [pausa, item, src])
  useEffect(() => {
    const tecla = (e) => {
      if (e.key === 'Escape') fechar()
      else if (e.key === 'ArrowRight') seguinte()
      else if (e.key === 'ArrowLeft') anterior()
    }
    document.addEventListener('keydown', tecla)
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    caixa.current?.focus()
    return () => { document.removeEventListener('keydown', tecla); document.body.style.overflow = antes }
  }, [fechar, seguinte, anterior])

  // toque curto: à esquerda volta, à direita passa; carregar sem largar: pausa enquanto se segura
  const baixo = (e) => { premido.current = { t: Date.now(), x: e.clientX }; mudar({ pausa: true, segurar: true }) }
  const cima = (e) => {
    const p = premido.current
    premido.current = null
    mudar({ pausa: false, segurar: false })
    if (!p || Date.now() - p.t > 300) return
    const r = e.currentTarget.getBoundingClientRect()
    if (p.x - r.left < r.width / 3) anterior()
    else seguinte()
  }

  return (
    <div className={css.ecra} role="dialog" aria-modal="true" aria-label={g.titulo} ref={caixa} tabIndex={-1} onKeyDown={(e) => { if (e.key === ' ' && e.target === e.currentTarget) { e.preventDefault(); mudar((x) => ({ pausa: !x.pausa })) } }}>
      <div className={css.palco}>
        <div className={css.barras} aria-hidden="true">
          {g.itens.map((x, k) => (
            <span key={x.id} className={css.barra}><span style={{ width: `${k < pos.i ? 100 : k === pos.i ? progresso : 0}%` }} /></span>
          ))}
        </div>
        <div className={css.topo}>
          {(g.capa || item.poster) && <img className={css.avatar} src={g.capa || item.poster} alt="" />}
          <div className={css.quem}>
            <b>{g.titulo}</b>
            <span>{[g.subtitulo, quando(item.data)].filter(Boolean).join(' · ')}</span>
          </div>
          <button type="button" className={css.botao} onClick={() => setSom((s) => !s)} aria-label={som ? tx('Sem som') : tx('Com som')}>{som ? '🔊' : '🔇'}</button>
          {apagar && <button type="button" className={css.botao} onClick={() => { mudar({ pausa: true }); apagar(item) }} aria-label={tx('Apagar')}>🗑</button>}
          <button type="button" className={css.botao} onClick={fechar} aria-label={tx('Fechar')}>✕</button>
        </div>
        {!src && <span className={css.pausa} aria-hidden="true"><span className={css.aCarregar} /></span>}
        <video
          key={item.id}
          ref={video}
          className={css.video}
          src={src}
          poster={item.poster}
          playsInline
          autoPlay
          muted={!som}
          preload="auto"
          onTimeUpdate={(e) => { const v = e.currentTarget; if (v.duration) mudar({ progresso: (v.currentTime / v.duration) * 100 }) }}
          onEnded={seguinte}
          onError={() => setTimeout(seguinte, 1500)}
        />
        <div className={css.toque} onPointerDown={baixo} onPointerUp={cima} onPointerLeave={() => { if (premido.current) { premido.current = null; mudar({ pausa: false, segurar: false }) } }} aria-hidden="true" />
        {pausa && !atual.segurar && <span className={css.pausa} aria-hidden="true">❚❚</span>}
        {(item.legenda || verMais) && (
          <div className={css.legenda}>
            {item.legenda && <p>{item.legenda}</p>}
            {verMais && <button type="button" className={css.verMais} onClick={() => verMais(g)}>{g.textoVerMais || tx('Ver a actividade')} ›</button>}
          </div>
        )}
        <button type="button" className={`${css.lado} ${css.esquerda}`} onClick={anterior} aria-label={tx('Anterior')}>‹</button>
        <button type="button" className={`${css.lado} ${css.direita}`} onClick={seguinte} aria-label={tx('Seguinte')}>›</button>
      </div>
    </div>
  )
}
