import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Ao mudar de página volta ao topo; se o link tiver #âncora, desliza até ela.
function GestorScroll() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash) {
      // espera pelo render da nova página antes de procurar a âncora
      const id = setTimeout(() => {
        document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' })
      }, 50)
      return () => clearTimeout(id)
    }
    window.scrollTo(0, 0)
  }, [pathname, hash])

  return null
}

export default GestorScroll
