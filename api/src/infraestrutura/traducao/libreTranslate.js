/*
  Tradutor automático LibreTranslate (código aberto, a correr no servidor da Escola).
  Traduz listas de textos de português para en/fr/es. Os marcadores {nome} e as etiquetas HTML
  são protegidos para não serem traduzidos nem estragados.
*/
const LOTE_TEXTOS = 40
const LOTE_CARACTERES = 6000

// {nome} -> <x0/>…  e volta (o modo "html" do LibreTranslate deixa as etiquetas intactas)
function proteger(texto) {
  const marcas = []
  const t = texto.replace(/\{(\w+)\}/g, (m) => { marcas.push(m); return `<x${marcas.length - 1}></x${marcas.length - 1}>` })
  return { t, marcas, html: marcas.length > 0 || /<[a-z][^>]*>/i.test(texto) }
}
const repor = (texto, marcas) => texto.replace(/<x(\d+)>\s*<\/x\1>|<x(\d+)\s*\/>/g, (m, a, b) => marcas[Number(a ?? b)] ?? m)

export class TradutorLibre {
  constructor({ url, chave = '', fetch: f = fetch }) {
    this.url = url.replace(/\/$/, '')
    this.chave = chave
    this.fetch = f
  }

  async #pedir(q, para, formato) {
    const r = await this.fetch(`${this.url}/translate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(180_000),
      body: JSON.stringify({ q, source: 'pt', target: para, format: formato, ...(this.chave ? { api_key: this.chave } : {}) }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(`Tradutor respondeu ${r.status}: ${d.error || ''}`.trim())
    return Array.isArray(d.translatedText) ? d.translatedText : [d.translatedText]
  }

  // textos: lista de strings em português -> lista traduzida (mesma ordem)
  async traduzir(textos, para) {
    const prep = textos.map(proteger)
    const r = new Array(textos.length)
    for (const formato of ['text', 'html']) {
      const idx = prep.map((p, i) => (p.html === (formato === 'html') ? i : -1)).filter((i) => i >= 0)
      let lote = []
      let tam = 0
      const enviar = async () => {
        if (!lote.length) return
        const out = await this.#pedir(lote.map((i) => prep[i].t), para, formato)
        lote.forEach((i, k) => { r[i] = repor(String(out[k] ?? ''), prep[i].marcas) })
        lote = []
        tam = 0
      }
      for (const i of idx) {
        if (lote.length >= LOTE_TEXTOS || tam + prep[i].t.length > LOTE_CARACTERES) await enviar()
        lote.push(i)
        tam += prep[i].t.length
      }
      await enviar()
    }
    return r
  }

  // mapa "caminho -> texto" -> mapa traduzido
  async traduzirMapa(mapa, para) {
    const chaves = Object.keys(mapa)
    const out = await this.traduzir(chaves.map((k) => mapa[k]), para)
    return Object.fromEntries(chaves.map((k, i) => [k, out[i]]).filter(([, v]) => v))
  }

  async disponivel() {
    try {
      const r = await this.fetch(`${this.url}/languages`, { signal: AbortSignal.timeout(5000) })
      return r.ok
    } catch {
      return false
    }
  }
}
