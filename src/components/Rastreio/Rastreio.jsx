import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { API_URL, idVisitante, pedido } from '../../conteudo/api'

// Regista cada página vista nas estatísticas do painel (sem cookies e sem guardar o IP)
function Rastreio() {
  const { pathname } = useLocation()

  useEffect(() => {
    if (!API_URL) return
    pedido('/api/publico/visita', {
      method: 'POST',
      body: JSON.stringify({ visitante: idVisitante(), caminho: pathname, origem: document.referrer || null }),
      keepalive: true,
    }).catch(() => {})
  }, [pathname])

  return null
}

export default Rastreio
