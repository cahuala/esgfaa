// memória com tamanho máximo e validade (evita crescer sem fim, como acontecia com as visualizações)
export class CacheLimitada {
  constructor({ maximo = 10_000, validadeMs = 30 * 60_000, relogio = () => Date.now() } = {}) {
    this.maximo = maximo
    this.validadeMs = validadeMs
    this.relogio = relogio
    this.mapa = new Map()
  }

  // true se a chave é nova (ou expirou) — e passa a ficar registada
  marcarSeNova(chave) {
    const agora = this.relogio()
    const anterior = this.mapa.get(chave)
    if (anterior !== undefined && agora - anterior < this.validadeMs) return false
    this.mapa.delete(chave)
    this.mapa.set(chave, agora)
    if (this.mapa.size > this.maximo) this.mapa.delete(this.mapa.keys().next().value)
    return true
  }

  get tamanho() {
    return this.mapa.size
  }
}
