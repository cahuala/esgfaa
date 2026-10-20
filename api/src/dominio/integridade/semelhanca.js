/*
  Deteção de semelhanças entre textos (anti-plágio):
  - o texto parte-se em palavras normalizadas (sem acentos nem maiúsculas), sem palavras vazias ("de", "the"…);
  - cada sequência de K palavras seguidas é um "pedaço" com um código (hash);
  - para procurar fontes depressa, cada documento guarda só alguns pedaços (winnowing: o menor de cada janela),
    o que garante encontrar qualquer passagem igual com K + JANELA - 1 palavras ou mais;
  - com as fontes candidatas, compara-se tudo e marcam-se as palavras cobertas por pedaços iguais.
  Opcionalmente ignoram-se as citações (entre aspas, em bloco e as referências "(Autor, ano)", normas APA)
  e a lista de referências no fim. Nunca conta o que é do modelo da Escola e igual em todos os trabalhos:
  a capa (antes do Resumo/Índice/Introdução), o índice e as tabelas ou listas de linhas curtas (cronograma,
  assinaturas).
*/
export const K = 5
export const JANELA = 4
export const MINIMO_PALAVRAS = 40

/*
  Letras de outros alfabetos iguais às latinas (cirílico, grego): trocá-las é um truque para enganar o
  anti-plágio ("AKЕELA" com um "Е" cirílico). Na comparação contam como a letra latina e o relatório avisa.
*/
const DISFARCES = { а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', у: 'y', х: 'x', і: 'i', ј: 'j', ѕ: 's', ԁ: 'd', ӏ: 'l', һ: 'h', ԛ: 'q', ԝ: 'w', А: 'A', В: 'B', Е: 'E', К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P', С: 'C', Т: 'T', У: 'Y', Х: 'X', І: 'I', Ј: 'J', Ѕ: 'S', ο: 'o', α: 'a', ε: 'e', ι: 'i', κ: 'k', ν: 'v', ρ: 'p', τ: 't', υ: 'u', χ: 'x', Α: 'A', Β: 'B', Ε: 'E', Ζ: 'Z', Η: 'H', Ι: 'I', Κ: 'K', Μ: 'M', Ν: 'N', Ο: 'O', Ρ: 'P', Τ: 'T', Υ: 'Y', Χ: 'X' }
const RE_DISFARCE = new RegExp(`[${Object.keys(DISFARCES).join('')}]`, 'gu')
// caracteres invisíveis metidos no meio das palavras (espaço de largura zero, hífen invisível…)
const INVISIVEIS = /[\u200b-\u200d\u2060\u00ad\ufeff]/g

export function sem(s) {
  return String(s).replace(INVISIVEIS, '').replace(RE_DISFARCE, (c) => DISFARCES[c]).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// palavras latinas com letras de outros alfabetos ou caracteres invisíveis: [{ palavra, inicio, fim }]
export function caracteresDisfarcados(texto) {
  const r = []
  for (const m of String(texto ?? '').matchAll(/[\p{L}\u200b-\u200d\u2060\u00ad\ufeff]+/gu)) {
    const w = m[0]
    const latinas = (w.match(/\p{Script=Latin}/gu) ?? []).length
    const estranhas = (w.match(RE_DISFARCE) ?? []).length
    const invisiveis = (w.match(INVISIVEIS) ?? []).length
    // invisível no meio da palavra, ou letra estrangeira numa palavra sobretudo latina
    const hifenOk = invisiveis && /^[^\u200b-\u200d\u2060\ufeff]+$/.test(w) && w.split('\u00ad').every((x) => x.length > 1)
    if ((estranhas && latinas >= estranhas) || (invisiveis && !hifenOk && latinas >= 2)) r.push({ palavra: w.replace(INVISIVEIS, '·'), inicio: m.index, fim: m.index + w.length })
  }
  return r
}

const PARAGENS = new Set(`a o as os um uma uns umas de do da dos das d em no na nos nas num numa por pelo pela pelos pelas para pra com sem sob
sobre entre ate até e ou nem mas que se ao aos à às é era foi ser são sao sua seu suas seus lhe lhes este esta estes estas esse essa esses essas
isto isso aquilo aquele aquela como mais muito muita também tambem já ja não nao sim quando onde qual quais cujo cuja eu tu ele ela nós nos vós eles elas
me te nos vos the of and to in is are was were be been an for on with as by at from that this these those it its or not which`.split(/\s+/).map(sem))

export const REFERENCIAS = /^[ \t]*(\d+[.)]?\s*)?(refer[eê]ncias(\s+bi\p{L}{0,3}liogr[aá]ficas)?|bibliografia(\s+consultada)?|references|bibliography|obras citadas)[ \t]*:?[ \t]*$/gimu
const CITACOES = /«[^»]{1,3000}»|“[^”]{1,3000}”|"[^"\n]{1,3000}"/g
// "(Gil, 2019)", "(Bardin, 2011; Gil, 2019, p. 27)"
const REFERENCIA_APA = /\((?=[^()\n]*\p{Lu})[^()\n]{2,400}?\b(?:1[5-9]|20)\d\d[a-z]?\b[^()\n]{0,60}\)/gu
// citação em bloco (APA: 40 palavras ou mais, sem aspas): parágrafo que acaba com "(Autor, ano, p. 12)"
const BLOCO = /(^|\n)([^\n]{200,})\((?=[^()\n]*\d{4})[^()\n]*\bp{1,2}\.\s*\d+[^()\n]*\)\.?[ \t]*(?=\n|$)/gu

// índice/sumário: 3 ou mais linhas seguidas "Título ... 12"
function indice(t) {
  const r = []
  const linhas = [...t.matchAll(/[^\n]+/g)]
  let k = 0
  while (k < linhas.length) {
    let j = k
    while (j < linhas.length && /^.{2,160}?[\s.…]\d{1,3}$/.test(linhas[j][0].trim())) j++
    if (j - k >= 3) r.push([linhas[k].index, linhas[j - 1].index + linhas[j - 1][0].length])
    k = Math.max(j, k + 1)
  }
  return r
}

// tabelas e listas: 5 ou mais linhas seguidas curtas — até 4 palavras, ou até 8 sem pontuação final
// (células do cronograma, assinaturas…); as frases de texto corrido acabam em ponto
const curta = (l) => {
  const n = l.split(/\s+/).length
  return n <= 4 || (n <= 8 && !/[.;:!?]$/.test(l))
}
function linhasCurtas(t) {
  const r = []
  const linhas = [...t.matchAll(/[^\n]+/g)]
  let k = 0
  while (k < linhas.length) {
    let j = k
    while (j < linhas.length && curta(linhas[j][0].trim())) j++
    if (j - k >= 5) r.push([linhas[k].index, linhas[j - 1].index + linhas[j - 1][0].length])
    k = Math.max(j, k + 1)
  }
  return r
}

// capa: o que vem antes do primeiro "Resumo", "Índice", "Sumário" ou "Introdução" (no primeiro terço)
function capa(t) {
  const m = /^[ \t]*(\d+[.)]?\s*)?(resumo|abstract|[íi]ndice|sum[áa]rio|introdu[çc][ãa]o|agradecimentos|dedicat[óo]ria|ep[íi]grafe)[ \t]*:?[ \t]*$/imu.exec(t)
  return m && m.index < t.length / 3 ? [[0, m.index]] : []
}

const intervalos = (t, re) => [...t.matchAll(re)].map((m) => [m.index, m.index + m[0].length])

// palavras com conteúdo: [{ n: normalizada, i: início, f: fim }] (posições no texto original)
export function tokenizar(texto, { excluirCitacoes = false, excluirReferencias = false } = {}) {
  const t = String(texto ?? '')
  let limite = t.length
  if (excluirReferencias) {
    // a primeira lista depois de 40 % do texto (pode haver «Referências» e depois «Bibliografia»)
    for (const m of t.matchAll(REFERENCIAS)) {
      if (m.index > t.length * 0.4) {
        limite = m.index
        break
      }
    }
  }
  const citacoes = [...capa(t), ...indice(t), ...linhasCurtas(t), ...(excluirCitacoes ? [...intervalos(t, CITACOES), ...intervalos(t, REFERENCIA_APA), ...intervalos(t, BLOCO)] : [])].sort((x, y) => x[0] - y[0])
  const r = []
  let c = 0
  for (const m of t.slice(0, limite).matchAll(/[\p{L}\p{N}\u200b-\u200d\u2060\u00ad\ufeff]+/gu)) {
    const n = sem(m[0])
    if (PARAGENS.has(n) || (n.length < 2 && !/\d/.test(n))) continue
    while (c < citacoes.length && citacoes[c][1] <= m.index) c++
    let dentro = false
    for (let q = c; q < citacoes.length && citacoes[q][0] <= m.index; q++) if (m.index < citacoes[q][1]) dentro = true
    if (dentro) continue
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
  parecidas: frases parafraseadas ou traduzidas já encontradas ([{ inicio, fim, fonte, excerto, tipo, valor }],
  posições no texto analisado); só contam nas palavras que a comparação exacta não cobriu.
  Devolve a percentagem total (e a exacta, a de paráfrase e a de tradução), a de cada fonte e os trechos
  coincidentes (posições no texto analisado, o excerto da fonte e o tipo: exacto, parafrase ou traducao).
*/
export function comparar(a, fontes, { parecidas = [] } = {}) {
  const total = a.tokens.length
  if (!total) return { percentagem: 0, percentagemExacta: 0, percentagemParafrase: 0, percentagemTraducao: 0, fontes: [], trechos: [] }
  const ps = pedacos(a.tokens)
  const ids = [...new Set([...fontes.map((f) => f.id), ...parecidas.map((x) => x.fonte)])]
  const porId = new Map(fontes.map((f) => [f.id, f]))
  const porFonte = ids.map((id) => {
    const f = porId.get(id) ?? { id, tokens: [], texto: '' }
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
    // frases parecidas desta fonte: as palavras do trabalho dentro de cada uma (2 = paráfrase, 3 = tradução)
    const parecida = new Int32Array(total).fill(-1)
    const minhas = parecidas.filter((x) => x.fonte === id)
    let np = 0
    minhas.forEach((x, q) => {
      // frase já quase toda copiada à letra desta fonte: fica como cópia exacta
      let dentro = 0
      let iguais = 0
      for (let i = 0; i < total; i++) if (a.tokens[i].i >= x.inicio && a.tokens[i].f <= x.fim) { dentro++; iguais += coberto[i] }
      if (dentro && iguais / dentro >= 0.5) return
      for (let i = 0; i < total; i++) {
        // a frase inteira (também as palavras que ficaram iguais), para se ver como um só trecho
        if (a.tokens[i].i >= x.inicio && a.tokens[i].f <= x.fim && parecida[i] < 0) { parecida[i] = q; if (!coberto[i]) np++ }
      }
    })
    return { f, coberto, posFonte, n, parecida, minhas, np }
  }).filter((x) => x.n + x.np > 0).sort((x, y) => (y.n + y.np) - (x.n + x.np))

  // cada palavra fica atribuída à fonte que mais cobre o texto: primeiro a cópia exacta, depois as frases parecidas
  const dono = new Int32Array(total).fill(-1)
  const tipo = new Uint8Array(total) // 1 exacto, 2 paráfrase, 3 tradução
  porFonte.forEach((x, k) => { for (let i = 0; i < total; i++) if (x.coberto[i] && dono[i] < 0) { dono[i] = k; tipo[i] = 1 } })
  // nas frases parecidas, também as palavras iguais à mesma fonte passam a ser da frase parafraseada (ou traduzida)
  porFonte.forEach((x, k) => { for (let i = 0; i < total; i++) if (x.parecida[i] >= 0 && (dono[i] < 0 || dono[i] === k)) { dono[i] = k; tipo[i] = x.minhas[x.parecida[i]].tipo === 'traducao' ? 3 : 2 } })

  const NOMES = { 1: 'exacto', 2: 'parafrase', 3: 'traducao' }
  const trechos = []
  for (let i = 0; i < total;) {
    if (dono[i] < 0) { i++; continue }
    const k = dono[i]
    const x = porFonte[k]
    let j = i
    // a mesma fonte e o mesmo tipo; nas parecidas, a mesma frase
    while (j + 1 < total && dono[j + 1] === k && tipo[j + 1] === tipo[i] && (tipo[i] === 1 || x.parecida[j + 1] === x.parecida[i])) j++
    let excerto
    let valor
    if (tipo[i] === 1) {
      const posicoes = []
      for (let q = i; q <= j; q++) if (x.posFonte[q] >= 0) posicoes.push(x.posFonte[q])
      const ft = x.f.tokens
      const fi = Math.min(...posicoes)
      const ff = Math.min(Math.max(...posicoes), ft.length - 1)
      excerto = x.f.texto.slice(ft[fi].i, ft[ff].f)
    } else {
      const p = x.minhas[x.parecida[i]]
      excerto = p.excerto
      valor = p.valor
    }
    trechos.push({ inicio: a.tokens[i].i, fim: a.tokens[j].f, palavras: j - i + 1, fonte: x.f.id, tipo: NOMES[tipo[i]], excerto: excerto.slice(0, MAX_EXCERTO), ...(valor !== undefined ? { semelhanca: valor } : {}) })
    i = j + 1
  }
  const contar = (t) => { let n = 0; for (let i = 0; i < total; i++) if (dono[i] >= 0 && (t === 0 || tipo[i] === t)) n++; return n }
  const pct = (n) => Math.round((n / total) * 1000) / 10
  // cada fonte com tudo o que tem em comum com o trabalho (mesmo o que outra fonte também tem)
  const porFonteFinal = porFonte.map((x) => ({ id: x.f.id, percentagem: pct(x.n + x.np), palavras: x.n + x.np }))
  return {
    percentagem: pct(contar(0)), percentagemExacta: pct(contar(1)), percentagemParafrase: pct(contar(2)), percentagemTraducao: pct(contar(3)),
    fontes: porFonteFinal.filter((x) => x.percentagem >= 0.5 || x.palavras >= 15),
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
