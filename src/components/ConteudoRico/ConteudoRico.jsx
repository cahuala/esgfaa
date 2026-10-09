import { useEffect, useState } from 'react'
import { FaChevronLeft, FaChevronRight, FaTimes } from 'react-icons/fa'
import { ancora } from '../../utils/texto'
import styles from './ConteudoRico.module.css'

/*
  Mostra o corpo de uma notícia, evento ou artigo a partir de uma lista de blocos.
  Os tipos de bloco estão descritos em data/noticias.js.
  Todas as imagens do conteúdo podem ser abertas em ecrã inteiro.
  `centrado`: coluna de texto centrada; as figuras "largas" saem da coluna.
  `capitular`: primeira letra do texto em grande, como numa publicação impressa.

  Imagens soltas aceitam `posicao`, como no Word:
    'esquerda' / 'direita' — a imagem fica de lado e o texto contorna-a
    'centro' (predefinição) — a imagem ocupa a coluna de texto
    'larga'  — a imagem sai da coluna (só com `centrado`)
  As legendas das imagens soltas são numeradas: "Figura 1", "Figura 2"…
*/
function ConteudoRico({ blocos = [], centrado = false, capitular = false }) {
  // todas as imagens (soltas e de galerias) numa só sequência para o visualizador
  const imagens = blocos.flatMap((b) => {
    if (b.tipo === 'imagem') return [{ src: b.src, legenda: b.legenda }]
    if (b.tipo === 'galeria') return b.imagens
    return []
  })
  // posição, na sequência acima, da primeira imagem de cada bloco
  const inicioImagens = blocos.reduce((acc, b, i) => {
    const anteriores = i === 0 ? 0 : acc[i - 1] + contarImagens(blocos[i - 1])
    return [...acc, anteriores]
  }, [])
  // número de figura de cada imagem solta
  const numeroFigura = blocos.reduce((acc, b, i) => {
    const anterior = i === 0 ? 0 : Math.max(0, ...acc.slice(0, i).filter(Boolean))
    return [...acc, b.tipo === 'imagem' ? anterior + 1 : null]
  }, [])
  const [aberta, setAberta] = useState(null)

  return (
    <div className={`${styles.corpo} ${centrado ? styles.centrado : ''} ${capitular ? styles.capitular : ''}`}>
      {blocos.map((bloco, i) => {
        switch (bloco.tipo) {
          case 'paragrafo':
            return <p key={i}>{bloco.texto}</p>

          case 'subtitulo':
            return <h2 key={i} id={ancora(bloco.texto)}>{bloco.texto}</h2>

          case 'imagem': {
            const indice = inicioImagens[i]
            const posicao = bloco.posicao || (bloco.larga ? 'larga' : 'centro')
            return (
              <figure key={i} className={`${styles.figura} ${styles[posicao] || ''}`}>
                <button className={styles.ampliar} onClick={() => setAberta(indice)} aria-label="Ampliar imagem">
                  <img src={bloco.src} alt={bloco.legenda || ''} loading="lazy" />
                </button>
                {bloco.legenda && (
                  <figcaption className={styles.legendaNumerada}>
                    <span>Figura {numeroFigura[i]}</span>{bloco.legenda}
                  </figcaption>
                )}
              </figure>
            )
          }

          case 'galeria':
            return (
              <figure key={i} className={`${styles.figura} ${styles.larga}`}>
                <div
                  className={`${styles.galeria} ${bloco.imagens.length === 2 ? styles.galeriaDupla : ''}`}
                  style={{ '--colunas': colunasGaleria(bloco.imagens.length) }}
                >
                  {bloco.imagens.map((img, j) => {
                    const indice = inicioImagens[i] + j
                    return (
                      <button key={indice} className={styles.ampliar} onClick={() => setAberta(indice)} aria-label="Ampliar imagem">
                        <img src={img.src} alt={img.legenda || ''} loading="lazy" />
                      </button>
                    )
                  })}
                </div>
                {bloco.legenda && <figcaption>{bloco.legenda}</figcaption>}
              </figure>
            )

          case 'video':
            return (
              <figure key={i} className={`${styles.figura} ${styles.larga}`}>
                <div className={styles.video}>
                  {bloco.youtube ? (
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${bloco.youtube}`}
                      title={bloco.legenda || 'Vídeo'}
                      loading="lazy"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <video src={bloco.src} poster={bloco.poster} controls preload="metadata" playsInline />
                  )}
                </div>
                {bloco.legenda && <figcaption>{bloco.legenda}</figcaption>}
              </figure>
            )

          case 'citacao':
            return (
              <blockquote key={i} className={styles.citacao}>
                <p>{bloco.texto}</p>
                {bloco.autor && <cite>— {bloco.autor}</cite>}
              </blockquote>
            )

          case 'lista': {
            const Lista = bloco.ordenada ? 'ol' : 'ul'
            return (
              <Lista key={i} className={styles.lista}>
                {bloco.itens.map((item) => <li key={item}>{item}</li>)}
              </Lista>
            )
          }

          case 'destaque':
            return (
              <aside key={i} className={styles.destaque}>
                {bloco.titulo && <strong>{bloco.titulo}</strong>}
                <p>{bloco.texto}</p>
              </aside>
            )

          case 'referencias':
            return (
              <section key={i} id="referencias" className={styles.referencias}>
                <h3>Referências</h3>
                <ol>
                  {bloco.itens.map((item) => <li key={item}>{item}</li>)}
                </ol>
              </section>
            )

          default:
            return null
        }
      })}

      {aberta !== null && (
        <Visualizador imagens={imagens} indice={aberta} onMudar={setAberta} onFechar={() => setAberta(null)} />
      )}
    </div>
  )
}

// a 1.ª imagem ocupa a linha toda; as restantes repartem-se sem deixar buracos
function colunasGaleria(total) {
  if (total <= 2) return 2
  return (total - 1) % 3 === 0 ? 3 : 2
}

function contarImagens(bloco) {
  if (bloco.tipo === 'imagem') return 1
  if (bloco.tipo === 'galeria') return bloco.imagens.length
  return 0
}

function Visualizador({ imagens, indice, onMudar, onFechar }) {
  const total = imagens.length
  const anterior = () => onMudar((indice - 1 + total) % total)
  const seguinte = () => onMudar((indice + 1) % total)

  useEffect(() => {
    function teclado(e) {
      if (e.key === 'Escape') onFechar()
      if (e.key === 'ArrowLeft') onMudar((indice - 1 + total) % total)
      if (e.key === 'ArrowRight') onMudar((indice + 1) % total)
    }
    document.addEventListener('keydown', teclado)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', teclado)
      document.body.style.overflow = ''
    }
  }, [indice, total, onMudar, onFechar])

  const img = imagens[indice]

  return (
    <div className={styles.visualizador} role="dialog" aria-modal="true" aria-label="Visualizador de imagens" onClick={onFechar}>
      <button className={`${styles.controlo} ${styles.fechar}`} onClick={onFechar} aria-label="Fechar">
        <FaTimes />
      </button>

      {total > 1 && (
        <button
          className={`${styles.controlo} ${styles.anterior}`}
          onClick={(e) => { e.stopPropagation(); anterior() }}
          aria-label="Imagem anterior"
        >
          <FaChevronLeft />
        </button>
      )}

      <figure className={styles.visualizadorFigura} onClick={(e) => e.stopPropagation()}>
        <img src={img.src} alt={img.legenda || ''} />
        <figcaption>
          {img.legenda}
          {total > 1 && <span>{indice + 1} / {total}</span>}
        </figcaption>
      </figure>

      {total > 1 && (
        <button
          className={`${styles.controlo} ${styles.seguinte}`}
          onClick={(e) => { e.stopPropagation(); seguinte() }}
          aria-label="Imagem seguinte"
        >
          <FaChevronRight />
        </button>
      )}
    </div>
  )
}

export default ConteudoRico
