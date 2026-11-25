import { useEffect, useState } from 'react'
import { api } from './api'

/*
  O ano lectivo em que a Administração Escolar está a trabalhar: escolhe-se uma vez (no menu) e todas as páginas do
  Ensino seguem esse ano — os cursos e as turmas, a alocação das cadeiras aos docentes, os indicadores, as listas e os
  documentos. Por omissão é o ano lectivo actual. Fica guardado neste navegador (é só uma comodidade de quem
  trabalha: os dados são sempre do servidor).
*/
const CHAVE = 'esg.anoTrabalho'
const EVENTO = 'esg-ano-trabalho'
let pedido = null

const guardado = () => { try { return window.localStorage.getItem(CHAVE) || '' } catch { return '' } }

export function mudarAnoTrabalho(ano) {
  try { window.localStorage.setItem(CHAVE, ano) } catch { /* sem armazenamento: vale só nesta página */ }
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: ano }))
}

// os anos lectivos configurados (um só pedido para todas as páginas; volta a pedir depois de mudarem)
export function anosLetivos({ recarregar = false } = {}) {
  if (!pedido || recarregar) pedido = api('/academico/anos-letivos').catch(() => { pedido = null; return [] })
  return pedido
}

// a página dos anos lectivos avisa quando cria, muda ou apaga um ano (o menu e as páginas abertas actualizam-se)
export function avisarAnosMudaram() {
  anosLetivos({ recarregar: true }).then(() => window.dispatchEvent(new CustomEvent('esg-anos-letivos')))
}

// { ano, anos, mudar }: o ano escolhido (válido entre os configurados) ou o actual
export function useAnoTrabalho() {
  const [anos, setAnos] = useState([])
  const [escolhido, setEscolhido] = useState(guardado)
  useEffect(() => {
    let vivo = true
    anosLetivos().then((l) => { if (vivo) setAnos(l ?? []) })
    const ouvir = (e) => setEscolhido(e.detail ?? guardado())
    const recarregar = () => anosLetivos().then((l) => { if (vivo) setAnos(l ?? []) })
    window.addEventListener(EVENTO, ouvir)
    window.addEventListener('esg-anos-letivos', recarregar)
    return () => { vivo = false; window.removeEventListener(EVENTO, ouvir); window.removeEventListener('esg-anos-letivos', recarregar) }
  }, [])
  const valido = anos.some((a) => a.id === escolhido)
  const ano = valido ? escolhido : anos.find((a) => a.atual)?.id ?? anos[0]?.id ?? ''
  return { ano, anos, mudar: mudarAnoTrabalho, carregado: anos.length > 0 }
}
