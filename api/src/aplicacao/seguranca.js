import fs from 'node:fs'
import os from 'node:os'
import v8 from 'node:v8'
import { ErroValidacao } from '../dominio/comum/erros.js'
import { BLOQUEIO_AUTOMATICO, TIPOS_EVENTO, classificarPedido, deveBloquear, ipLocal, ipValido, nivelDeAlerta } from '../dominio/seguranca/eventos.js'

const DIA = 86_400_000
const GUARDAR_DIAS = 90
const INTERVALO_ALERTA = 30 * 60_000

/*
  Centro de segurança: estado do servidor (está ligado, memória, processador, disco, base de dados),
  tráfego e eventos de segurança ao vivo, endereços suspeitos e bloqueios. Cada pedido é classificado
  à saída; os robôs que procuram falhas ficam bloqueados 24 horas, sozinhos; quando o nível chega a
  "ataque", quem está de serviço recebe um e-mail (SEGURANCA_EMAIL).
*/
export class ServicoSeguranca {
  constructor({ monitor, seguranca, correio, emailAlerta = '', auditoria, pastaDados, registar, versao = '' }) {
    Object.assign(this, { monitor, seguranca, correio, emailAlerta, auditoria, pastaDados, registar, versao })
    this.bloqueados = new Map() // ip -> data de fim
    this.aBloquear = new Set()
    this.ultimoAlerta = 0
    this.temporizadores = []
  }

  iniciar() {
    const repetir = (ms, f) => { const t = setInterval(() => f().catch((e) => this.registar?.({ nivel: 'erro', mensagem: 'Centro de segurança', erro: e.message })), ms); t.unref?.(); this.temporizadores.push(t) }
    repetir(10_000, () => this.#gravar())
    repetir(30_000, () => this.#carregarBloqueios())
    repetir(3_600_000, () => this.seguranca.apagarAntigos(new Date(Date.now() - GUARDAR_DIAS * DIA)))
    this.#carregarBloqueios().catch(() => {})
  }

  async parar() {
    for (const t of this.temporizadores) clearInterval(t)
    this.temporizadores = []
    this.monitor.parar()
    await this.#gravar().catch(() => {})
  }

  async #carregarBloqueios() {
    this.bloqueados = new Map((await this.seguranca.bloqueios()).map((b) => [b.ip, new Date(b.ate).getTime()]))
  }

  estaBloqueado(ip) {
    const ate = this.bloqueados.get(ip)
    return Boolean(ate && ate > Date.now())
  }

  async #gravar() {
    await this.seguranca.gravarEventos(this.monitor.retirarPendentes())
    const { nivel, motivos } = nivelDeAlerta(this.monitor.contagens(5))
    if (nivel === 'ataque' && Date.now() - this.ultimoAlerta > INTERVALO_ALERTA) {
      this.ultimoAlerta = Date.now()
      if (this.emailAlerta && this.correio?.real) {
        await this.correio.enviar({
          para: this.emailAlerta, assunto: '[ESGFAA] Alerta de segurança: o sistema pode estar a ser atacado',
          texto: `Nos últimos 5 minutos:\n${motivos.map((m) => `- ${TIPOS_EVENTO[m.tipo].nome}: ${m.n}`).join('\n')}\n\nVeja o Centro de segurança no painel de gestão.`,
        })
      }
    }
  }

  // chamado à saída de cada pedido
  registarPedido({ ip, metodo, url, estado, ms }) {
    this.monitor.pedido({ ip, estado, ms })
    const tipo = classificarPedido({ metodo, url, estado })
    if (!tipo) return
    this.monitor.evento({ tipo, ip, exemplo: `${metodo} ${String(url).split('?')[0]}` })
    if ((tipo === 'sondagem' || tipo === 'injecao') && !ipLocal(ip) && !this.estaBloqueado(ip) && !this.aBloquear.has(ip) && deveBloquear(this.monitor.contagens(5, ip))) {
      this.aBloquear.add(ip)
      const ate = new Date(Date.now() + BLOQUEIO_AUTOMATICO.horas * 3_600_000)
      this.bloqueados.set(ip, ate.getTime())
      this.seguranca.bloquear({ ip, ate, motivo: 'Automático: procura de falhas ou tentativas de injeção', automatico: true, criadoPor: 'Centro de segurança' })
        .catch(() => {}).finally(() => this.aBloquear.delete(ip))
    }
  }

  registarBloqueado(ip, url) {
    this.monitor.evento({ tipo: 'ip_bloqueado', ip, exemplo: String(url).split('?')[0] })
  }

  #saude() {
    const m = process.memoryUsage()
    let disco = null
    try { const s = fs.statfsSync(this.pastaDados); disco = { total: s.blocks * s.bsize, livre: s.bavail * s.bsize } } catch { /* sem informação do disco */ }
    const nucleos = os.cpus().length || 1
    return {
      ligadoDesde: new Date(this.monitor.arranque).toISOString(), versaoNode: process.version, versao: this.versao,
      processador: { carga: Math.round((os.loadavg()[0] / nucleos) * 100), nucleos },
      // memória da API (e o máximo que pode usar) e a livre no computador
      memoria: { processo: m.rss, heap: m.heapUsed, limite: v8.getHeapStatistics().heap_size_limit, total: os.totalmem(), livre: os.freemem() },
      disco, atrasoMs: this.monitor.atrasoMs(),
    }
  }

  async painel(ctx) {
    ctx.actor.exigir('seguranca.ver')
    const agora = Date.now()
    let baseDados
    try { baseDados = { ligada: true, ms: Math.round((await this.seguranca.pingMs()) * 10) / 10 } } catch { baseDados = { ligada: false, ms: null } }
    const ultimos5 = this.monitor.contagens(5)
    const [dia, semana, porHora, suspeitos, bloqueios] = await Promise.all([
      this.seguranca.resumo(new Date(agora - DIA)), this.seguranca.resumo(new Date(agora - 7 * DIA)), this.seguranca.porHora(new Date(agora - DIA)),
      this.seguranca.ipsSuspeitos(new Date(agora - DIA)), this.seguranca.bloqueios(),
    ])
    // o que ainda não foi gravado também conta
    for (const p of this.monitor.pendentes.values()) {
      dia[p.tipo] = (dia[p.tipo] || 0) + p.contagem
      semana[p.tipo] = (semana[p.tipo] || 0) + p.contagem
      const h = new Date(p.minuto)
      h.setUTCMinutes(0, 0, 0)
      const x = porHora.find((y) => y.hora === h.toISOString() && y.tipo === p.tipo)
      if (x) x.n += p.contagem
      else porHora.push({ hora: h.toISOString(), tipo: p.tipo, n: p.contagem })
    }
    return {
      geradoEm: new Date(agora).toISOString(), tipos: Object.fromEntries(Object.entries(TIPOS_EVENTO).map(([k, v]) => [k, v.nome])),
      alerta: { ...nivelDeAlerta(ultimos5), ultimoAlerta: this.ultimoAlerta ? new Date(this.ultimoAlerta).toISOString() : null, emailConfigurado: Boolean(this.emailAlerta && this.correio?.real) },
      saude: { ...this.#saude(), baseDados },
      trafego: this.monitor.trafego(5), serie: this.monitor.serie(60), ultimos5, dia, semana, porHora,
      recentes: this.monitor.recentes.slice(0, 50), ipsAtivos: this.monitor.ipsAtivos(15), suspeitos,
      bloqueios: bloqueios.map((b) => ({ ...b, ate: b.ate.toISOString(), criadoEm: b.criadoEm.toISOString() })),
      regras: { bloqueioAutomatico: BLOQUEIO_AUTOMATICO },
    }
  }

  async bloquear(ctx, { ip, horas = 24, motivo = '' }, ipDoPedido) {
    ctx.actor.exigir('seguranca.gerir')
    const x = String(ip || '').trim()
    if (!ipValido(x)) throw new ErroValidacao('Endereço IP inválido.', { campo: 'ip' })
    if (x === ipDoPedido) throw new ErroValidacao('Não pode bloquear o seu próprio endereço.', { campo: 'ip' })
    const h = Number(horas)
    if (!Number.isFinite(h) || h < 1 || h > 24 * 365) throw new ErroValidacao('Bloqueio de 1 hora a 1 ano.', { campo: 'horas' })
    const ate = new Date(Date.now() + h * 3_600_000)
    await this.seguranca.bloquear({ ip: x, ate, motivo: String(motivo).slice(0, 300), automatico: false, criadoPor: ctx.actor.nome || '' })
    this.bloqueados.set(x, ate.getTime())
    await this.auditoria.registar(ctx, { acao: 'bloquear_ip', colecao: 'seguranca', alvoId: x, alvoTitulo: `Bloqueou ${x}`, detalhes: { horas: h, motivo } })
    return { ip: x, ate: ate.toISOString() }
  }

  async desbloquear(ctx, ip) {
    ctx.actor.exigir('seguranca.gerir')
    await this.seguranca.desbloquear(String(ip))
    this.bloqueados.delete(String(ip))
    await this.auditoria.registar(ctx, { acao: 'desbloquear_ip', colecao: 'seguranca', alvoId: String(ip), alvoTitulo: `Desbloqueou ${ip}` })
  }
}
