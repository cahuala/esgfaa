import { useEffect, useState } from 'react'

// Devolve o id da última secção cujo topo já passou o meio do ecrã (para marcar o índice).
export default function useSeccaoAtiva(ids) {
  const [ativa, setAtiva] = useState(ids[0])
  const chave = ids.join('|')

  useEffect(() => {
    const lista = chave.split('|')
    let pedido = null
    function atualizar() {
      pedido = null
      const meio = window.innerHeight / 2
      setAtiva(
        lista.reduce((escolhida, id) => {
          const el = document.getElementById(id)
          return el && el.getBoundingClientRect().top <= meio ? id : escolhida
        }, lista[0]),
      )
    }
    function aoFazerScroll() {
      if (!pedido) pedido = requestAnimationFrame(atualizar)
    }
    atualizar()
    window.addEventListener('scroll', aoFazerScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', aoFazerScroll)
      if (pedido) cancelAnimationFrame(pedido)
    }
  }, [chave])

  return ativa
}
