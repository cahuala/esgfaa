import { useState } from 'react'
import { FaFacebookF, FaLinkedinIn, FaWhatsapp, FaLink, FaCheck } from 'react-icons/fa'
import styles from './Partilhar.module.css'

function Partilhar({ titulo }) {
  const [copiado, setCopiado] = useState(false)
  const url = typeof window !== 'undefined' ? window.location.href : ''
  const u = encodeURIComponent(url)
  const t = encodeURIComponent(titulo)

  const redes = [
    { nome: 'Facebook', icone: <FaFacebookF />, href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { nome: 'WhatsApp', icone: <FaWhatsapp />, href: `https://wa.me/?text=${t}%20${u}` },
    { nome: 'LinkedIn', icone: <FaLinkedinIn />, href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
  ]

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // sem acesso à área de transferência (ex.: página sem HTTPS) — não faz nada
    }
  }

  return (
    <div className={styles.partilhar}>
      <span className={styles.rotulo}>Partilhar</span>
      <div className={styles.botoes}>
        {redes.map((r) => (
          <a key={r.nome} href={r.href} target="_blank" rel="noopener noreferrer" aria-label={`Partilhar no ${r.nome}`} className={styles.botao}>
            {r.icone}
          </a>
        ))}
        <button onClick={copiar} className={`${styles.botao} ${copiado ? styles.copiado : ''}`} aria-label="Copiar ligação">
          {copiado ? <FaCheck /> : <FaLink />}
        </button>
        <span className={styles.aviso} aria-live="polite">{copiado ? 'Ligação copiada' : ''}</span>
      </div>
    </div>
  )
}

export default Partilhar
