import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useConteudo } from '../../conteudo/contexto'
import { API_URL, pedido } from '../../conteudo/api'
import styles from './Publicidade.module.css'

const contar = (id, tipo) => {
  if (API_URL) pedido(`/api/publico/publicidade/${id}/${tipo}`, { method: 'POST', keepalive: true }).catch(() => {})
}

/*
  Mostra o banner ativo para uma posição do site:
  home-topo, home-meio, noticias-lateral, noticia-fim, rodape.
  Conta uma impressão quando o banner aparece no ecrã e um clique quando é usado.
*/
function Publicidade({ posicao, variante }) {
  const { publicidade = [] } = useConteudo()
  const banner = publicidade.find((b) => b.posicao === posicao)
  const ref = useRef(null)

  useEffect(() => {
    if (!banner || !ref.current) return
    const observador = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        contar(banner.id, 'impressao')
        observador.disconnect()
      }
    }, { threshold: 0.5 })
    observador.observe(ref.current)
    return () => observador.disconnect()
  }, [banner])

  if (!banner) return null

  const externa = /^https?:\/\//.test(banner.ligacao || '')
  const conteudo = banner.tipo === 'imagem' ? (
    <img src={banner.imagem} alt={banner.titulo} className={styles.soImagem} loading="lazy" />
  ) : (
    <span className={styles.composto} style={banner.imagem ? { '--fundo': `url("${banner.imagem}")` } : undefined}>
      <span className={styles.texto}>
        {banner.anunciante && <span className={styles.anunciante}>{banner.anunciante}</span>}
        <strong>{banner.titulo}</strong>
        {banner.texto && <span className={styles.descricao}>{banner.texto}</span>}
      </span>
      {banner.botao && <span className={styles.botao}>{banner.botao} →</span>}
    </span>
  )

  const props = { className: styles.ligacao, onClick: () => contar(banner.id, 'clique') }

  return (
    <aside ref={ref} className={`${styles.banner} ${styles[variante] || ''}`} aria-label="Publicidade">
      <span className={styles.rotulo}>Publicidade</span>
      {!banner.ligacao ? <div className={styles.ligacao}>{conteudo}</div>
        : externa ? <a href={banner.ligacao} target="_blank" rel="noopener sponsored" {...props}>{conteudo}</a>
          : <Link to={banner.ligacao} {...props}>{conteudo}</Link>}
    </aside>
  )
}

export default Publicidade
