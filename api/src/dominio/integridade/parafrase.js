import { sem } from './semelhanca.js'

/*
  Paráfrase e tradução (o que a comparação exacta não apanha):
  - cada palavra fica reduzida ao radical ("operações", "operacional" -> "operac"), em português, inglês,
    francês e espanhol, para que mudar a forma da palavra não esconda a cópia;
  - o texto parte-se em frases; uma frase é paráfrase de uma frase da fonte quando partilham a maior parte
    dos radicais e pelo menos dois pares de radicais seguidos (a ordem das ideias mantém-se);
  - para encontrar as fontes candidatas guardam-se também impressões "aproximadas" (grupos de 3 radicais
    seguidos), que sobrevivem à troca de uma palavra aqui e ali;
  - a tradução: o trabalho é traduzido frase a frase e comparado assim com as fontes noutra língua.
*/
export const KA = 2
export const JANELA_A = 3
export const MIN_RAIZES = 6 // frases com menos radicais diferentes não contam (títulos, frases muito curtas)

// sufixos do mais comprido para o mais curto; o radical fica com 4 letras ou mais
const SUFIXOS = [
  'amentos', 'imentos', 'idades', 'amento', 'imento', 'mentes', 'idade', 'mente', 'acoes', 'icoes', 'ismos', 'istas', 'aveis', 'iveis', 'ments', 'ation', 'ement', 'tions',
  'ancia', 'encia', 'acao', 'icao', 'ismo', 'ista', 'avel', 'ivel', 'ment', 'tion', 'ores', 'ador', 'eurs', 'ence', 'ance', 'ings', 'ados', 'adas', 'idos', 'idas',
  'oes', 'aes', 'ais', 'eis', 'ing', 'ies', 'ado', 'ada', 'ido', 'ida', 'eur', 'ico', 'ica', 'ivo', 'iva', 'al', 'ar', 'er', 'ir', 'es', 'ed', 'os', 'as', 'ly', 's', 'o', 'a', 'e', 'y',
]
export function raiz(palavra) {
  const p = sem(palavra)
  if (p.length <= 4 || /\d/.test(p)) return p
  for (const s of SUFIXOS) if (p.endsWith(s) && p.length - s.length >= 4) return p.slice(0, -s.length)
  return p
}

// palavras vazias das quatro línguas (as da comparação exacta são só pt e en)
const VAZIAS = new Set(`a o as os um uma uns umas de do da dos das em no na nos nas num numa por pelo pela pelos pelas para com sem sob sobre entre ate e ou nem mas que se ao aos
e era foi ser sao sua seu suas seus lhe lhes este esta estes estas esse essa esses essas isto isso aquele aquela como mais muito muita tambem ja nao sim quando onde qual quais
cujo cuja ele ela eles elas seja sido ter tem tinha ha sendo pode podem deve devem assim ainda the of and to in is are was were be been an for on with as by at from that
this these those it its or not which has have had their they them there also can could would should will may such into than other le la les un une des du de et en au aux
est sont pour par sur dans avec qui ce cette ces son sa ses leur leurs ne pas plus ou il elle ils elles nous vous se lo los las el del al y es son para por con una unos
unas su sus que como mas pero esta este estos estas fue han sido`.split(/\s+/).map(sem))

const hash = (s) => {
  let h = 0x9e3779b9
  for (let k = 0; k < s.length; k++) h = Math.imul(h ^ s.charCodeAt(k), 0x01000193)
  return h | 0
}

// radicais com conteúdo de um troço de texto: [{ r, i, f }] (posições relativas ao início do troço)
export function raizes(texto) {
  const out = []
  for (const m of String(texto ?? '').matchAll(/[\p{L}\p{N}]+/gu)) {
    const n = sem(m[0])
    if (VAZIAS.has(n) || (n.length < 3 && !/\d/.test(n))) continue
    out.push({ r: raiz(n), i: m.index, f: m.index + m[0].length })
  }
  return out
}

/*
  Frases de um texto a partir das palavras que contam (tokens da comparação exacta: já sem capa, índice,
  citações e referências, se for o caso). Cada frase: { inicio, fim, palavras, texto, conjunto, pares }.
*/
export function frases(texto, tokens) {
  const t = String(texto ?? '')
  const r = []
  let atual = []
  const fechar = () => {
    if (atual.length) {
      const inicio = atual[0].i
      const fim = atual.at(-1).f
      r.push(frase(t.slice(inicio, fim), inicio, fim, atual.length))
    }
    atual = []
  }
  for (let k = 0; k < tokens.length; k++) {
    if (atual.length && /[.!?;…]\s|\n/.test(t.slice(atual.at(-1).f, tokens[k].i))) fechar()
    atual.push(tokens[k])
  }
  fechar()
  return r
}

export function frase(texto, inicio = 0, fim = inicio + String(texto).length, palavras = null) {
  const rs = raizes(texto).map((x) => x.r)
  const pares = new Set()
  for (let k = 0; k + 1 < rs.length; k++) pares.add(`${rs[k]} ${rs[k + 1]}`)
  return { inicio, fim, palavras: palavras ?? rs.length, texto: String(texto), conjunto: new Set(rs), pares }
}

// impressões aproximadas (grupos de KA radicais seguidos, winnowing): para encontrar fontes candidatas.
// Recebe o texto, ou as palavras da comparação exacta (tokens: já sem capa, índice e, se for o caso, citações)
export function impressoesAproximadas(entrada) {
  const rs = Array.isArray(entrada) ? entrada.map((t) => t.n).filter((n) => !VAZIAS.has(n) && (n.length >= 3 || /\d/.test(n))).map(raiz) : raizes(entrada).map((x) => x.r)
  const ps = []
  for (let p = 0; p + KA <= rs.length; p++) ps.push({ h: hash(rs.slice(p, p + KA).join(' ')), p })
  if (ps.length <= JANELA_A) return ps
  const escolhidos = new Map()
  for (let k = 0; k + JANELA_A <= ps.length; k++) {
    let min = ps[k]
    for (let j = k + 1; j < k + JANELA_A; j++) if (ps[j].h <= min.h) min = ps[j]
    escolhidos.set(min.p, min)
  }
  return [...escolhidos.values()]
}

/*
  Semelhança de uma frase do trabalho (a) com uma da fonte (b): radicais partilhados sobre os de a (e de b,
  para uma frase curta da fonte não "cobrir" uma longa do trabalho) e pares seguidos partilhados.
*/
export const LIMIAR = { partilhados: 6, deA: 0.5, deB: 0.55, pares: 1 }
export function semelhancaFrases(a, b) {
  let comuns = 0
  for (const x of a.conjunto) if (b.conjunto.has(x)) comuns++
  let pares = 0
  for (const x of a.pares) if (b.pares.has(x)) pares++
  const deA = comuns / (a.conjunto.size || 1)
  const deB = comuns / (b.conjunto.size || 1)
  const ok = comuns >= LIMIAR.partilhados && deA >= LIMIAR.deA && deB >= LIMIAR.deB && pares >= LIMIAR.pares
  return { comuns, pares, deA, deB, ok, valor: ok ? Math.round(((deA + deB) / 2) * 100) : 0 }
}

/*
  Frases parafraseadas: para cada frase do trabalho (com MIN_RAIZES ou mais radicais), a frase mais parecida
  de cada fonte. frasesA: frases do trabalho (as posições são as do trabalho, mesmo quando o texto da frase
  é a tradução); fontes: [{ id, frases }]. Devolve [{ k, fonte, b, valor }] (k = índice em frasesA).
*/
export function paraFrases(frasesA, fontes) {
  const indices = fontes.map((f) => {
    const onde = new Map()
    f.frases.forEach((b, j) => { for (const x of b.conjunto) { if (!onde.has(x)) onde.set(x, []); onde.get(x).push(j) } })
    return onde
  })
  const r = []
  frasesA.forEach((a, k) => {
    if (a.conjunto.size < MIN_RAIZES) return
    let melhor = null
    fontes.forEach((f, q) => {
      // só as frases da fonte que partilham radicais (o índice evita comparar tudo com tudo)
      const conta = new Map()
      for (const x of a.conjunto) for (const j of indices[q].get(x) ?? []) conta.set(j, (conta.get(j) ?? 0) + 1)
      for (const [j, n] of conta) {
        if (n < LIMIAR.partilhados) continue
        const s = semelhancaFrases(a, f.frases[j])
        if (s.ok && (!melhor || s.valor > melhor.valor)) melhor = { k, fonte: f.id, b: f.frases[j], valor: s.valor }
      }
    })
    if (melhor) r.push(melhor)
  })
  return r
}

// língua de um texto, pelas palavras vazias mais frequentes (pt, en, fr, es)
const MARCAS = {
  pt: ['de', 'que', 'nao', 'para', 'com', 'uma', 'os', 'do', 'da', 'em', 'sao', 'dos', 'das', 'tambem', 'pela'],
  en: ['the', 'of', 'and', 'to', 'is', 'that', 'for', 'with', 'are', 'this', 'by', 'from', 'which', 'have'],
  fr: ['le', 'les', 'des', 'et', 'est', 'une', 'du', 'pour', 'dans', 'qui', 'sur', 'pas', 'avec', 'sont'],
  es: ['el', 'los', 'las', 'del', 'que', 'una', 'por', 'con', 'para', 'es', 'como', 'pero', 'sus', 'fue'],
}
export function linguaDe(texto) {
  const palavras = sem(String(texto ?? '').slice(0, 20_000)).match(/\p{L}+/gu) ?? []
  const conta = Object.fromEntries(Object.keys(MARCAS).map((l) => [l, 0]))
  const sets = Object.fromEntries(Object.entries(MARCAS).map(([l, m]) => [l, new Set(m)]))
  for (const w of palavras) for (const l in sets) if (sets[l].has(w)) conta[l]++
  const [l, n] = Object.entries(conta).sort((x, y) => y[1] - x[1])[0]
  return n >= 3 ? l : null
}
