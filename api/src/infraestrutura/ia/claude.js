/*
  Cliente mínimo da API de mensagens da Anthropic (Claude).
  Usado para avaliar a probabilidade de um texto ter sido gerado por IA e para traduzir conteúdos.
*/
export class ClienteClaude {
  constructor({ chave, modelo, fetch: f = fetch }) {
    this.chave = chave
    this.modelo = modelo
    this.fetch = f
  }

  async mensagem({ sistema, conteudo, maxTokens = 2000, temperatura = 0 }) {
    const r = await this.fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': this.chave, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: this.modelo, max_tokens: maxTokens, temperature: temperatura, system: sistema, messages: [{ role: 'user', content: conteudo }] }),
      signal: AbortSignal.timeout(120_000),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(`API do Claude respondeu ${r.status}: ${d.error?.message || ''}`.trim())
    return (d.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('')
  }

  // pede uma resposta em JSON e lê-a (tolera texto à volta do objeto)
  async json(pedido) {
    const t = await this.mensagem(pedido)
    const i = t.indexOf('{')
    const f = t.lastIndexOf('}')
    if (i < 0 || f < i) throw new Error('O Claude não devolveu JSON.')
    return JSON.parse(t.slice(i, f + 1))
  }
}
