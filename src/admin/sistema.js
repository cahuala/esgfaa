import { useEffect, useState } from 'react'
import { API_URL } from '../conteudo/api'

/*
  O nome de cada instalação do painel (sistemas separados): a Gestão Escolar chama-se «Sistema de Gestão Escolar»,
  e assim por diante; a instalação completa (e a demonstração) continua «Painel de gestão».
*/
export const NOMES_SISTEMA = {
  escolar: 'Sistema de Gestão Escolar',
  site: 'Sistema de Gestão do Site',
  biblioteca: 'Sistema de Biblioteca',
  ciberseguranca: 'Sistema de Cibersegurança',
}
export const nomeDoSistema = (sistema) => NOMES_SISTEMA[sistema] ?? 'Painel de gestão'

// antes de entrar ainda não há sessão: pergunta-se ao servidor que sistema é (/api/saude, público)
let pedido = null
export function useSistema(daSessao = '') {
  const [sistema, setSistema] = useState(daSessao)
  useEffect(() => {
    if (daSessao) return undefined
    let vivo = true
    if (!pedido) pedido = fetch(`${API_URL}/api/saude`).then((r) => r.json()).then((j) => j.sistema ?? '').catch(() => { pedido = null; return '' })
    pedido.then((s) => { if (vivo) setSistema(s) })
    return () => { vivo = false }
  }, [daSessao])
  const s = daSessao || sistema
  // o título do separador do navegador acompanha
  useEffect(() => { document.title = `${nomeDoSistema(s)} · ESG` }, [s])
  return s
}
