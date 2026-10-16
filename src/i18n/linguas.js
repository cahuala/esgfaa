/*
  Línguas do site. O português é o original; as outras usam o dicionário (interface)
  e as traduções publicadas pela redação (conteúdos). O que faltar aparece em português.
*/
import { DICIONARIOS } from './dicionarios'

export const LINGUAS = [
  { codigo: 'pt', nome: 'Português', curto: 'PT', local: 'pt-PT' },
  { codigo: 'en', nome: 'English', curto: 'EN', local: 'en-GB' },
  { codigo: 'fr', nome: 'Français', curto: 'FR', local: 'fr-FR' },
  { codigo: 'es', nome: 'Español', curto: 'ES', local: 'es-ES' },
]
const CODIGOS = LINGUAS.map((l) => l.codigo)
const CHAVE = 'esgfaa-lingua'

let atual = 'pt'

export const linguaAtual = () => atual
export const localAtual = () => LINGUAS.find((l) => l.codigo === atual).local

export function definirLingua(codigo) {
  atual = CODIGOS.includes(codigo) ? codigo : 'pt'
  try { localStorage.setItem(CHAVE, atual) } catch { /* sem armazenamento */ }
  if (typeof document !== 'undefined') document.documentElement.lang = atual
}

// ?lang=en no endereço ou a escolha anterior; sem isso, português (o site abre sempre na língua da Escola)
export function linguaInicial() {
  try {
    const daUrl = new URLSearchParams(window.location.search).get('lang')
    if (CODIGOS.includes(daUrl)) return daUrl
    const guardada = localStorage.getItem(CHAVE)
    if (CODIGOS.includes(guardada)) return guardada
  } catch { /* sem armazenamento */ }
  return 'pt'
}

/*
  Texto da interface na língua atual. A chave é o próprio texto em português;
  {nome} é substituído pelos valores dados: t('Faltam {n} dias', { n: 3 }).
*/
export function t(texto, valores) {
  const r = (atual === 'pt' ? texto : DICIONARIOS[atual]?.[texto]) ?? texto
  return valores ? r.replace(/\{(\w+)\}/g, (m, k) => (k in valores ? String(valores[k]) : m)) : r
}
