import { useEffect, useState } from 'react'
import styles from './BarraLeitura.module.css'

// Barra fina no topo do ecrã que mostra quanto do texto já foi lido
function BarraLeitura() {
  const [progresso, setProgresso] = useState(0)

  useEffect(() => {
    function atualizar() {
      const max = document.documentElement.scrollHeight - window.innerHeight
      setProgresso(max > 0 ? Math.min(1, window.scrollY / max) : 0)
    }
    atualizar()
    window.addEventListener('scroll', atualizar, { passive: true })
    window.addEventListener('resize', atualizar)
    return () => {
      window.removeEventListener('scroll', atualizar)
      window.removeEventListener('resize', atualizar)
    }
  }, [])

  return <div className={styles.barra} style={{ transform: `scaleX(${progresso})` }} aria-hidden="true" />
}

export default BarraLeitura
