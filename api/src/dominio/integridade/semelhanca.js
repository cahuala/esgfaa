/*
  Deteção de semelhanças entre textos (anti-plágio):
  - o texto parte-se em palavras normalizadas (sem acentos nem maiúsculas), sem palavras vazias ("de", "the"…);
  - cada sequência de K palavras seguidas é um "pedaço" com um código (hash);
  - para procurar fontes depressa, cada documento guarda só alguns pedaços (winnowing: o menor de cada janela),
    o que garante encontrar qualquer passagem igual com K + JANELA - 1 palavras ou mais;
  - com as fontes candidatas, compara-se tudo e marcam-se as palavras cobertas por pedaços iguais.
  Opcionalmente ignora-se o que está entre aspas (citações) e a lista de referências no fim.
*/
export const K = 5
export const JANELA = 4
export const MINIMO_PALAVRAS = 40

const PARAGENS = new Set(`a o as os um uma uns umas de do da dos das d em no na nos nas num numa por pelo pela pelos pelas para pra com sem sob
sobre entre ate até e ou nem mas que se ao aos à às é era foi ser são sao sua seu suas seus lhe lhes este esta estes estas esse essa esses essas
isto isso aquilo aquele aquela como mais muito muita também tambem já ja não nao sim quando onde qual quais cujo cuja eu tu ele ela nós nos vós eles elas
me te nos vos the of and to in is are was were be been an for on with as by at from that this these those it its or not which`.split(/\s+/).map(sem))

export function sem(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

const REFERENCIAS = /^[ \t]*(\d+[.)]?\s*)?(refer[eê]ncias(\s+bibliogr[aá]ficas)?|bibliografia|references|bibliography|obras citadas)[ \t]*:?[ \t]*$/gim
const CITACOES = /«[^»]{1,3000}»|“[^”]{1,3000}”|"[^"\n]{1,3000}"/g

// palavras com conteúdo: [{ n: normalizada, i: início, f: fim }] (posições no texto original)
export function tokenizar(texto, { excluirCitacoes = false, excluirReferencias = false } = {}) {
  const t = String(texto ?? '')
  let limite = t.length
  if (excluirReferencias) {
    for (const m of t.matchAll(REFERENCIAS)) if (m.index > t.length * 0.4) limite = m.index
  }
  const citacoes = excluirCitacoes ? [...t.matchAll(CITACOES)].map((m) => [m.index, m.index + m[0].length]) : []
  const r = []
  let c = 0
  for (const m of t.slice(0, limite).matchAll(/[\p{L}\p{N}]+/gu)) {
    const n = sem(m[0])
    if (PARAGENS.has(n) || (n.length < 2 && !/\d/.test(n))) continue
    while (c < citacoes.length && citacoes[c][1] <= m.index) c++
    if (c < citacoes.length && citacoes[c][0] <= m.index) continue
    r.push({ n, i: m.index, f: m.index + m[0].length })
  }
  return r
}

// FNV-1a de 32 bits, com sinal (cabe num inteiro do PostgreSQL)
function hash(s) {
  let h = 0x811c9dc5
  for (let k = 0; k < s.length; k++) h = Math.imul(h ^ s.charCodeAt(k), 0x01000193)
  return h | 0
}

export function pedacos(tokens) {
  const r = []
  for (let p = 0; p + K <= tokens.length; p++) r.push({ h: hash(tokens.slice(p, p + K).map((t) => t.n).join(' ')), p })
  return r
}

// winnowing: em cada janela de pedaços seguidos guarda-se o de menor código (sem repetir)
export function impressoes(tokens) {
  const ps = pedacos(tokens)
  if (ps.length <= JANELA) return ps
  const escolhidos = new Map()
  for (let k = 0; k + JANELA <= ps.length; k++) {
    let min = ps[k]
    for (let j = k + 1; j < k + JANELA; j++) if (ps[j].h <= min.h) min = ps[j]
    escolhidos.set(min.p, min)
  }
  return [...escolhidos.values()]
}

const MAX_EXCERTO = 1500

/*
  Compara o texto analisado com as fontes candidatas.
  a: { texto, tokens }; fontes: [{ id, texto, tokens }].
  Devolve a percentagem total, a de cada fonte e os trechos coincidentes (posições no texto analisado
  e o excerto correspondente da fonte).
*/
export function comparar(a, fontes) {
  const total = a.tokens.length
  if (!total) return { percentagem: 0, fontes: [], trechos: [] }
  const ps = pedacos(a.tokens)
  const porFonte = fontes.map((f) => {
    const onde = new Map()
    for (const x of pedacos(f.tokens)) if (!onde.has(x.h)) onde.set(x.h, x.p)
    const coberto = new Uint8Array(total)
    const posFonte = new Int32Array(total).fill(-1) // palavra da fonte que corresponde a cada palavra coberta
    for (const x of ps) {
      const pb = onde.get(x.h)
      if (pb === undefined) continue
      for (let d = 0; d < K; d++) {
        coberto[x.p + d] = 1
        if (posFonte[x.p + d] < 0) posFonte[x.p + d] = pb + d
      }
    }
    let n = 0
    for (const v of coberto) n += v
    return { f, coberto, posFonte, n }
  }).filter((x) => x.n > 0).sort((x, y) => y.n - x.n)

  // cada palavra fica atribuída à fonte que mais cobre o texto
  const dono = new Int32Array(total).fill(-1)
  porFonte.forEach((x, k) => { for (let i = 0; i < total; i++) if (x.coberto[i] && dono[i] < 0) dono[i] = k })

  const trechos = []
  for (let i = 0; i < total;) {
    if (dono[i] < 0) { i++; continue }
    const k = dono[i]
    let j = i
    while (j + 1 < total && dono[j + 1] === k) j++
    const x = porFonte[k]
    const posicoes = []
    for (let q = i; q <= j; q++) if (x.posFonte[q] >= 0) posicoes.push(x.posFonte[q])
    const ft = x.f.tokens
    const fi = Math.min(...posicoes)
    const ff = Math.min(Math.max(...posicoes), ft.length - 1)
    trechos.push({
      inicio: a.tokens[i].i, fim: a.tokens[j].f, palavras: j - i + 1, fonte: x.f.id,
      excerto: x.f.texto.slice(ft[fi].i, ft[ff].f).slice(0, MAX_EXCERTO),
    })
    i = j + 1
  }
  let cobertas = 0
  for (const d of dono) if (d >= 0) cobertas++
  const pct = (n) => Math.round((n / total) * 1000) / 10
  return {
    percentagem: pct(cobertas),
    fontes: porFonte.map((x) => ({ id: x.f.id, percentagem: pct(x.n), palavras: x.n })).filter((x) => x.percentagem >= 0.5 || x.palavras >= 15),
    trechos,
  }
}

// nível de alerta para mostrar ao docente
export const NIVEIS = [
  { ate: 15, nivel: 'baixo', rotulo: 'Semelhança baixa' },
  { ate: 35, nivel: 'medio', rotulo: 'Semelhança a rever' },
  { ate: 101, nivel: 'alto', rotulo: 'Semelhança elevada' },
]
export const nivelDe = (p) => (p === null || p === undefined ? null : NIVEIS.find((n) => p < n.ate))
