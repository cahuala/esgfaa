/*
  Línguas do sistema (site, portal e painel). O português é o original; as outras usam os dicionários
  (interface) e as traduções publicadas (conteúdos do site). O que faltar aparece em português.
  A língua lê-se no arranque; mudar de língua recarrega a página (tudo é desenhado de novo).
*/
export const LINGUAS = [
  { codigo: 'pt', nome: 'Português', curto: 'PT', local: 'pt-PT' },
  { codigo: 'en', nome: 'English', curto: 'EN', local: 'en-GB' },
  { codigo: 'fr', nome: 'Français', curto: 'FR', local: 'fr-FR' },
  { codigo: 'es', nome: 'Español', curto: 'ES', local: 'es-ES' },
]
const CODIGOS = LINGUAS.map((l) => l.codigo)
const CHAVE = 'esgfaa-lingua'

// ?lang=en no endereço ou a escolha anterior; sem isso, português (a língua da Escola)
export function linguaInicial() {
  try {
    const daUrl = new URLSearchParams(window.location.search || window.location.hash.split('?')[1] || '').get('lang')
    if (CODIGOS.includes(daUrl)) return daUrl
    const guardada = localStorage.getItem(CHAVE)
    if (CODIGOS.includes(guardada)) return guardada
  } catch { /* sem armazenamento ou fora do navegador */ }
  return 'pt'
}

let atual = typeof window === 'undefined' ? 'pt' : linguaInicial()
let dicionario = {}

export const linguaAtual = () => atual
export const localAtual = () => LINGUAS.find((l) => l.codigo === atual).local

export function definirLingua(codigo) {
  atual = CODIGOS.includes(codigo) ? codigo : 'pt'
  try { localStorage.setItem(CHAVE, atual) } catch { /* sem armazenamento */ }
  if (typeof document !== 'undefined') document.documentElement.lang = atual
}

// carrega o dicionário da língua atual (antes de desenhar a aplicação)
export async function prepararLingua() {
  definirLingua(atual)
  if (atual === 'pt') { dicionario = {}; return }
  const { dicionarioDe } = await import('./dicionarios')
  dicionario = dicionarioDe(atual)
}

// muda de língua e recarrega (sem o ?lang= do endereço, que mandaria na escolha)
export function mudarLingua(codigo) {
  definirLingua(codigo)
  const url = new URL(window.location.href)
  url.searchParams.delete('lang')
  window.location.replace(url.toString())
}

/*
  Texto da interface na língua atual. A chave é o próprio texto em português;
  {nome} é substituído pelos valores dados: t('Faltam {n} dias', { n: 3 }).
*/
export function t(texto, valores) {
  const r = (atual === 'pt' ? texto : dicionario[texto]) ?? texto
  return valores ? String(r).replace(/\{(\w+)\}/g, (m, k) => (k in valores ? String(valores[k]) : m)) : r
}
