import { monitorEventLoopDelay } from 'node:perf_hooks'

const MIN = 60_000
const HORAS_EM_MEMORIA = 24
const AMOSTRAS = 600 // tempos de resposta guardados por minuto (para a percentil 95)

/*
  Monitor em memória: pedidos, tempos de resposta e eventos de segurança por minuto (últimas 24 horas),
  os endereços mais ativos dos últimos 15 minutos e o fluxo dos eventos mais recentes. Os eventos
  também se juntam por minuto/tipo/endereço e vão para a base de dados de 10 em 10 segundos.
*/
export class Monitor {
  constructor({ agora = () => Date.now() } = {}) {
    this.agora = agora
    this.minutos = new Map() // minuto -> { pedidos, erros, somaMs, tempos[], eventos: {tipo: n} }
    this.porIp = new Map() // ip -> [{ minuto, pedidos, eventos: {tipo: n} }]
    this.recentes = [] // últimos eventos, para o fluxo ao vivo
    this.pendentes = new Map() // "minuto|tipo|ip" -> { minuto, tipo, ip, contagem, exemplo }
    this.arranque = agora()
    this.atraso = monitorEventLoopDelay({ resolution: 20 })
    this.atraso.enable()
  }

  #minuto(t = this.agora()) { return Math.floor(t / MIN) * MIN }

  #balde(m) {
    let b = this.minutos.get(m)
    if (!b) {
      b = { pedidos: 0, erros: 0, somaMs: 0, tempos: [], eventos: {} }
      this.minutos.set(m, b)
      const limite = m - HORAS_EM_MEMORIA * 60 * MIN
      for (const k of this.minutos.keys()) if (k < limite) this.minutos.delete(k)
    }
    return b
  }

  #ip(ip, m) {
    let l = this.porIp.get(ip)
    if (!l) { l = []; this.porIp.set(ip, l) }
    let x = l[l.length - 1]
    if (!x || x.minuto !== m) { x = { minuto: m, pedidos: 0, eventos: {} }; l.push(x) }
    while (l.length && l[0].minuto < m - 15 * MIN) l.shift()
    if (this.porIp.size > 5000) for (const [k, v] of this.porIp) if (!v.length || v[v.length - 1].minuto < m - 15 * MIN) this.porIp.delete(k)
    return x
  }

  pedido({ ip, estado, ms }) {
    const m = this.#minuto()
    const b = this.#balde(m)
    b.pedidos += 1
    b.somaMs += ms
    if (estado >= 500) b.erros += 1
    if (b.tempos.length < AMOSTRAS) b.tempos.push(ms)
    else b.tempos[Math.floor(Math.random() * AMOSTRAS)] = ms
    this.#ip(ip, m).pedidos += 1
  }

  evento({ tipo, ip, exemplo = '' }) {
    const t = this.agora()
    const m = this.#minuto(t)
    const b = this.#balde(m)
    b.eventos[tipo] = (b.eventos[tipo] || 0) + 1
    const x = this.#ip(ip, m)
    x.eventos[tipo] = (x.eventos[tipo] || 0) + 1
    const chave = `${m}|${tipo}|${ip}`
    const p = this.pendentes.get(chave)
    if (p) p.contagem += 1
    else this.pendentes.set(chave, { minuto: new Date(m), tipo, ip, contagem: 1, exemplo: String(exemplo).slice(0, 300) })
    this.recentes.unshift({ quando: new Date(t).toISOString(), tipo, ip, exemplo: String(exemplo).slice(0, 200) })
    if (this.recentes.length > 200) this.recentes.length = 200
  }

  // eventos juntados desde a última vez (para gravar)
  retirarPendentes() {
    const l = [...this.pendentes.values()]
    this.pendentes.clear()
    return l
  }

  // contagem de cada tipo de evento nos últimos n minutos (de todos ou de um endereço)
  contagens(minutos = 5, ip = null) {
    const desde = this.#minuto() - (minutos - 1) * MIN
    const r = {}
    const somar = (ev) => { for (const [k, v] of Object.entries(ev)) r[k] = (r[k] || 0) + v }
    if (ip) for (const x of this.porIp.get(ip) || []) { if (x.minuto >= desde) somar(x.eventos) }
    else for (const [m, b] of this.minutos) if (m >= desde) somar(b.eventos)
    return r
  }

  // série por minuto dos últimos n minutos (pedidos, tempo médio, eventos)
  serie(minutos = 60) {
    const agora = this.#minuto()
    const r = []
    for (let m = agora - (minutos - 1) * MIN; m <= agora; m += MIN) {
      const b = this.minutos.get(m)
      r.push({ minuto: new Date(m).toISOString(), pedidos: b?.pedidos || 0, erros: b?.erros || 0, mediaMs: b?.pedidos ? Math.round(b.somaMs / b.pedidos) : 0, eventos: b ? Object.values(b.eventos).reduce((a, n) => a + n, 0) : 0 })
    }
    return r
  }

  // tráfego dos últimos n minutos: pedidos por minuto, tempo médio e percentil 95
  trafego(minutos = 5) {
    const desde = this.#minuto() - (minutos - 1) * MIN
    let pedidos = 0
    let erros = 0
    let soma = 0
    const tempos = []
    for (const [m, b] of this.minutos) if (m >= desde) { pedidos += b.pedidos; erros += b.erros; soma += b.somaMs; tempos.push(...b.tempos) }
    tempos.sort((a, b) => a - b)
    return {
      porMinuto: Math.round(pedidos / minutos), mediaMs: pedidos ? Math.round(soma / pedidos) : 0,
      p95Ms: tempos.length ? tempos[Math.min(tempos.length - 1, Math.floor(tempos.length * 0.95))] : 0, erros,
    }
  }

  // endereços com mais atividade nos últimos 15 minutos
  ipsAtivos(limite = 15) {
    return [...this.porIp].map(([ip, l]) => {
      const eventos = {}
      let pedidos = 0
      for (const x of l) { pedidos += x.pedidos; for (const [k, v] of Object.entries(x.eventos)) eventos[k] = (eventos[k] || 0) + v }
      return { ip, pedidos, eventos, suspeitos: Object.values(eventos).reduce((a, n) => a + n, 0) }
    }).filter((x) => x.pedidos || x.suspeitos).sort((a, b) => b.suspeitos - a.suspeitos || b.pedidos - a.pedidos).slice(0, limite)
  }

  atrasoMs() {
    const p99 = this.atraso.percentile(99) / 1e6
    this.atraso.reset()
    return Math.round(p99 * 10) / 10
  }

  parar() { this.atraso.disable() }
}
