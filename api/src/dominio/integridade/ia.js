import { sem, tokenizar } from './semelhanca.js'

/*
  Indicadores locais de texto gerado por IA (sem serviço externo). São sinais, não provas:
  - pouca variação no tamanho das frases (a escrita humana alterna frases curtas e longas);
  - parágrafos todos do mesmo tamanho;
  - expressões de ligação e fórmulas típicas dos assistentes de IA;
  - vocabulário "polido" e repetitivo (pouca diversidade de palavras).
  O resultado é uma pontuação de 0 a 100 e os parágrafos que mais acumulam sinais.
*/
const FORMULAS = [
  'e importante notar', 'e importante salientar', 'vale ressaltar', 'vale a pena destacar', 'convem destacar', 'em suma', 'em ultima analise',
  'em conclusao', 'desempenha um papel crucial', 'desempenha um papel fundamental', 'papel crucial', 'no cenario atual', 'no mundo atual',
  'num mundo cada vez mais', 'nesse sentido', 'neste contexto', 'alem disso', 'por outro lado', 'de forma abrangente', 'multifacetado',
  'abordagem holistica', 'mergulhar', 'explorar a fundo', 'e crucial', 'e fundamental', 'promover', 'fomentar', 'potencializar',
  'it is important to note', 'in conclusion', 'furthermore', 'moreover', 'delve', 'plays a crucial role', 'in today s world', 'tapestry',
  'il est important de noter', 'en conclusion', 'par ailleurs', 'es importante destacar', 'en conclusion', 'ademas',
]

export function paragrafos(texto) {
  const r = []
  const re = /[^\n]+(?:\n(?!\n)[^\n]+)*/g
  for (const m of String(texto).matchAll(re)) {
    const t = m[0].trim()
    if (t.split(/\s+/).length >= 12) r.push({ inicio: m.index, fim: m.index + m[0].length, texto: t })
  }
  return r
}

const frasesDe = (t) => t.split(/(?<=[.!?…])\s+/).map((f) => f.trim()).filter((f) => f.split(/\s+/).length >= 3)
const media = (l) => l.reduce((a, b) => a + b, 0) / (l.length || 1)
const desvio = (l) => { const m = media(l); return Math.sqrt(media(l.map((x) => (x - m) ** 2))) }
const limitar = (x) => Math.max(0, Math.min(100, Math.round(x)))

function formulasEm(t) {
  const n = ` ${sem(t).replace(/[^\p{L}\p{N}]+/gu, ' ')} `
  return FORMULAS.filter((f) => n.includes(` ${f} `))
}

export function indicadoresIA(texto) {
  const ps = paragrafos(texto)
  const frases = frasesDe(String(texto))
  const palavras = tokenizar(texto)
  if (palavras.length < 80 || frases.length < 5) return { pontuacao: null, sinais: [{ sinal: 'Texto curto demais para os indicadores locais.', peso: 0 }], paragrafos: [] }

  const tamanhos = frases.map((f) => f.split(/\s+/).length)
  const variacao = desvio(tamanhos) / media(tamanhos) // coeficiente de variação: humanos ~0,5-0,8; IA ~0,25-0,4
  const tamPar = ps.map((p) => p.texto.split(/\s+/).length)
  const variacaoPar = ps.length >= 3 ? desvio(tamPar) / media(tamPar) : 0.5
  const formulas = formulasEm(texto)
  const porMil = (formulas.length / palavras.length) * 1000
  // diversidade em janelas de 100 palavras (não depende do tamanho do texto)
  const janelas = []
  for (let k = 0; k + 100 <= palavras.length; k += 50) janelas.push(new Set(palavras.slice(k, k + 100).map((p) => p.n)).size / 100)
  const diversidade = janelas.length ? media(janelas) : 0.75

  const sinais = []
  let p = 20
  if (variacao < 0.35) { p += 25; sinais.push({ sinal: 'Frases com tamanho muito regular', peso: 25 }) } else if (variacao < 0.45) { p += 12; sinais.push({ sinal: 'Frases com tamanho pouco variado', peso: 12 }) } else p -= 8
  if (ps.length >= 3 && variacaoPar < 0.25) { p += 15; sinais.push({ sinal: 'Parágrafos quase todos do mesmo tamanho', peso: 15 }) }
  if (porMil >= 4) { p += 25; sinais.push({ sinal: `Muitas fórmulas típicas de assistentes de IA (${formulas.slice(0, 5).join(', ')})`, peso: 25 }) } else if (porMil >= 1.5) { p += 12; sinais.push({ sinal: `Algumas fórmulas típicas de IA (${formulas.slice(0, 4).join(', ')})`, peso: 12 }) }
  if (diversidade < 0.68) { p += 10; sinais.push({ sinal: 'Vocabulário repetitivo', peso: 10 }) }
  if (!sinais.length) sinais.push({ sinal: 'Sem sinais fortes: escrita com ritmo variado', peso: 0 })

  const porParagrafo = ps.map((x) => {
    const tf = frasesDe(x.texto).map((f) => f.split(/\s+/).length)
    const v = tf.length >= 3 ? desvio(tf) / media(tf) : 0.5
    const fp = formulasEm(x.texto)
    const pont = limitar(20 + (v < 0.3 ? 30 : v < 0.4 ? 15 : 0) + fp.length * 18)
    return { inicio: x.inicio, fim: x.fim, pontuacao: pont, motivo: [v < 0.4 && 'frases regulares', fp.length && `expressões: ${fp.join(', ')}`].filter(Boolean).join('; ') }
  }).filter((x) => x.pontuacao >= 50)

  return { pontuacao: limitar(p), sinais, paragrafos: porParagrafo, medidas: { variacaoFrases: Math.round(variacao * 100) / 100, formulasPorMil: Math.round(porMil * 10) / 10, diversidade: Math.round(diversidade * 100) / 100 } }
}

// frases a pesquisar na internet: as mais longas e com mais conteúdo, espalhadas pelo texto
export function frasesParaPesquisa(texto, n) {
  const fs = []
  for (const m of String(texto).matchAll(/[^.!?\n]{40,400}[.!?]?/g)) {
    const f = m[0].trim().replace(/\s+/g, ' ')
    const conteudo = tokenizar(f).length
    if (conteudo >= 8) fs.push({ f, conteudo, i: m.index })
  }
  if (fs.length <= n) return fs.map((x) => x.f)
  // divide o texto em n partes e escolhe a frase com mais conteúdo de cada parte
  const total = String(texto).length
  const escolhidas = []
  for (let k = 0; k < n; k++) {
    const de = (total * k) / n
    const ate = (total * (k + 1)) / n
    const daParte = fs.filter((x) => x.i >= de && x.i < ate).sort((a, b) => b.conteudo - a.conteudo)
    if (daParte[0]) escolhidas.push(daParte[0].f)
  }
  return escolhidas
}
