/*
  Pesquisa na web pela API do Brave Search (https://api.search.brave.com).
  Cada frase é pesquisada entre aspas; devolve os primeiros resultados (título e endereço).
  O plano gratuito aceita 1 pedido por segundo: os pedidos esperam uns pelos outros.
*/
export class PesquisaBrave {
  #ultimo = 0

  constructor({ chave, intervaloMs = 1100, fetch: f = fetch }) {
    this.chave = chave
    this.intervaloMs = intervaloMs
    this.fetch = f
  }

  async pesquisar(frase, { resultados = 5 } = {}) {
    const espera = this.#ultimo + this.intervaloMs - Date.now()
    if (espera > 0) await new Promise((r) => setTimeout(r, espera))
    this.#ultimo = Date.now()
    const url = `https://api.search.brave.com/res/v1/web/search?${new URLSearchParams({ q: `"${frase}"`, count: String(resultados), safesearch: 'off', text_decorations: 'false' })}`
    const r = await this.fetch(url, { headers: { Accept: 'application/json', 'X-Subscription-Token': this.chave }, signal: AbortSignal.timeout(15_000) })
    if (r.status === 429) throw new Error('Limite de pesquisas do Brave Search atingido.')
    if (!r.ok) throw new Error(`Brave Search respondeu ${r.status}.`)
    const d = await r.json()
    return (d.web?.results || []).map((x) => ({ titulo: String(x.title || '').slice(0, 300), url: x.url, descricao: String(x.description || '').slice(0, 500) }))
  }
}
