import { eTextoDaInterface, linguaAtual } from './linguas'

/*
  Tradução dos dados nos painéis (portal e painel de gestão). A interface vem dos dicionários; os dados
  (nomes das cadeiras, capítulos, avisos, notificações, títulos das obras…) estão em português na base de
  dados. Fora do português, os textos que aparecem no ecrã vão ao tradutor automático do servidor e são
  trocados no lugar, sem mexer no que o React desenhou (só o conteúdo do nó de texto muda).
  Não se traduz: campos de escrita, editores, código e o que estiver marcado com translate="no"
  (documentos oficiais, nomes de pessoas).
*/
const FORA = 'script,style,noscript,textarea,input,code,pre,svg,[contenteditable],[contenteditable] *,[translate="no"],[translate="no"] *,.notranslate,.notranslate *'
const ESPERA = 120
const LOTE = 250

export function ligarTraducaoDosDados(pedir) {
  const lingua = linguaAtual()
  if (lingua === 'pt' || typeof MutationObserver === 'undefined') return () => {}
  const CHAVE = `esgfaa-traducoes-${lingua}`
  // original -> tradução ('' quando fica igual)
  const memoria = new Map()
  try { for (const [o, t] of Object.entries(JSON.parse(sessionStorage.getItem(CHAVE) || '{}'))) memoria.set(o, t) } catch { /* sem armazenamento */ }
  const guardar = () => { try { sessionStorage.setItem(CHAVE, JSON.stringify(Object.fromEntries(memoria))) } catch { /* cheio ou indisponível */ } }

  const nos = new WeakMap() // nó -> { original, traduzido }
  const espera = new Map() // original -> Set de nós
  const aPedir = new Set()
  let relogio = null
  let aPedirAgora = false

  const candidato = (s) => s.length > 1 && /\p{L}{2}/u.test(s) && !eTextoDaInterface(s)

  function aplicar(no, original) {
    const t = memoria.get(original)
    if (!t) return
    const v = no.nodeValue
    const traduzido = v.replace(original, t)
    nos.set(no, { original, traduzido })
    if (v !== traduzido) no.nodeValue = traduzido
  }

  function ver(no) {
    const v = no.nodeValue
    const ja = nos.get(no)
    if (ja && v === ja.traduzido) return
    const s = v.trim()
    if (!candidato(s) || no.parentElement?.closest(FORA)) return
    if (memoria.has(s)) { aplicar(no, s); return }
    if (!espera.has(s)) espera.set(s, new Set())
    espera.get(s).add(no)
    aPedir.add(s)
    agendar()
  }

  function agendar(ms = ESPERA) {
    if (!relogio && !aPedirAgora) relogio = setTimeout(enviar, ms)
  }

  async function enviar() {
    relogio = null
    const textos = [...aPedir].slice(0, LOTE)
    if (!textos.length) return
    textos.forEach((s) => aPedir.delete(s))
    aPedirAgora = true
    let pendentes = []
    try {
      const r = await pedir({ lingua, textos })
      pendentes = r.pendentes || []
      const ficam = new Set(pendentes)
      for (const s of textos) if (!ficam.has(s)) memoria.set(s, r.traducoes?.[s] || '')
      guardar()
    } catch {
      // sem servidor ou sem tradutor: fica em português, e não se volta a pedir nesta página
      textos.forEach((s) => memoria.set(s, ''))
    }
    aPedirAgora = false
    for (const s of textos) {
      if (pendentes.includes(s)) { aPedir.add(s); continue }
      for (const no of espera.get(s) || []) if (no.isConnected && no.nodeValue.trim() === s) aplicar(no, s)
      espera.delete(s)
    }
    if (aPedir.size) agendar(pendentes.length ? 800 : ESPERA)
  }

  function percorrer(raiz) {
    if (raiz.nodeType === Node.TEXT_NODE) { ver(raiz); return }
    if (raiz.nodeType !== Node.ELEMENT_NODE || raiz.matches(FORA)) return
    const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT)
    while (w.nextNode()) ver(w.currentNode)
  }

  const observador = new MutationObserver((mudancas) => {
    for (const m of mudancas) {
      if (m.type === 'characterData') ver(m.target)
      else m.addedNodes.forEach(percorrer)
    }
  })
  observador.observe(document.body, { childList: true, subtree: true, characterData: true })
  percorrer(document.body)
  return () => { observador.disconnect(); clearTimeout(relogio) }
}
