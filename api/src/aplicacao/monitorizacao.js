import crypto from 'node:crypto'
import { ErroValidacao } from '../dominio/comum/erros.js'
import { assinar } from '../infraestrutura/replicacao/motor.js'

/*
  Centro de cibersegurança e monitorização: o estado de todos os sistemas da Escola num só ecrã — cada um com o seu
  domínio, se responde (e em quanto tempo), a saúde do servidor (processador, memória, disco, base de dados), a
  segurança (alerta, eventos das últimas 24 h, IP bloqueados, nível de protecção) e as trocas entre os sistemas.
  Os outros sistemas respondem a /api/monitor/estado com um pedido assinado (REPLICACAO_CHAVE); o Sistema de Pessoal
  só diz se responde (/api/saude). A lista dos sistemas (nome, domínio e o endereço para os contactar) muda-se no ecrã.
*/
const CHAVE_LISTA = 'monitorizacao-sistemas'
const TIPOS = { pessoal: 'Sistema de Gestão de Pessoal', escolar: 'Sistema de Gestão Escolar', site: 'Sistema de Gestão do Site', biblioteca: 'Sistema de Biblioteca', online: 'Servidor online (site público e Portal)', completo: 'Sistema completo' }

// a lista por omissão: os sistemas da Escola (no mesmo servidor, pelo endereço interno; o online, pelo da internet)
export function sistemasPorOmissao(config) {
  const online = config.replicacao?.url || 'https://portal.esg.emfaa.gov.ao'
  return [
    { id: 'pessoal', nome: TIPOS.pessoal, tipo: 'pessoal', dominio: 'esg.emfaa.gov.ao', endereco: 'http://127.0.0.1:3002' },
    { id: 'escolar', nome: TIPOS.escolar, tipo: 'escolar', dominio: 'escolar.esg.emfaa.gov.ao', endereco: 'http://127.0.0.1:3001' },
    { id: 'site', nome: TIPOS.site, tipo: 'site', dominio: 'gestao-site.esg.emfaa.gov.ao', endereco: 'http://127.0.0.1:3003' },
    { id: 'biblioteca', nome: TIPOS.biblioteca, tipo: 'biblioteca', dominio: 'biblioteca.esg.emfaa.gov.ao', endereco: 'http://127.0.0.1:3004' },
    { id: 'online', nome: TIPOS.online, tipo: 'online', dominio: new URL(online).host, endereco: online },
  ]
}

export class ServicoMonitorizacao {
  constructor({ config, prisma, seguranca, replicacao = null, paginas, auditoria, fetch: buscar = globalThis.fetch, relogio }) {
    Object.assign(this, { config, prisma, seguranca, replicacao, paginas, auditoria, buscar, relogio })
  }

  // o estado deste sistema (o que os outros pedem, e o que o ecrã mostra deste)
  async estadoLocal() {
    const [seg, bd, rep] = await Promise.all([
      this.seguranca.resumoParaMonitor(),
      this.prisma.$queryRawUnsafe('SELECT pg_database_size(current_database())::bigint AS tamanho, (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database())::int AS ligacoes').then((r) => r[0]).catch(() => null),
      this.replicacao ? this.replicacao.estado() : null,
    ])
    return {
      sistema: this.config.sistema ?? 'completo', nome: TIPOS[this.config.sistema ?? 'completo'], dominio: this.config.urlPublico ? new URL(this.config.urlPublico).host : '',
      ...seg, baseDados: { ...seg.saude.baseDados, tamanho: bd ? Number(bd.tamanho) : null, ligacoes: bd?.ligacoes ?? null },
      replicacao: rep ? { url: rep.url, porEnviar: rep.porEnviar, pares: rep.pares } : null,
    }
  }

  async lista() {
    const guardada = await this.paginas.ler(CHAVE_LISTA)
    return Array.isArray(guardada?.sistemas) && guardada.sistemas.length ? guardada.sistemas : sistemasPorOmissao(this.config)
  }

  async guardarLista(ctx, sistemas) {
    ctx.actor.exigir('seguranca.gerir')
    if (!Array.isArray(sistemas) || !sistemas.length || sistemas.length > 20) throw new ErroValidacao('Indique de 1 a 20 sistemas.')
    const limpos = sistemas.map((x, i) => {
      const nome = String(x?.nome ?? '').trim().slice(0, 80)
      const dominio = String(x?.dominio ?? '').trim().toLowerCase().slice(0, 120)
      const endereco = String(x?.endereco ?? '').trim().replace(/\/$/, '').slice(0, 200)
      const tipo = Object.keys(TIPOS).includes(x?.tipo) ? x.tipo : 'escolar'
      if (!nome || !/^https?:\/\/[^\s/]+/.test(endereco)) throw new ErroValidacao(`Linha ${i + 1}: falta o nome ou o endereço (http://… ou https://…).`)
      return { id: String(x?.id || `${tipo}-${i}`).slice(0, 40), nome, tipo, dominio, endereco }
    })
    await this.paginas.guardar(CHAVE_LISTA, { sistemas: limpos })
    await this.auditoria.registar(ctx, { acao: 'monitorizacao_sistemas', alvoTitulo: `${limpos.length} sistema(s)` })
    return this.painel(ctx)
  }

  // cada sistema: responde? em quanto tempo? e, se for dos nossos, o estado completo (pedido assinado)
  async #consultar(s) {
    const meu = s.tipo === (this.config.sistema ?? 'completo')
    const inicio = performance.now()
    try {
      if (meu) return { ...s, ok: true, ms: 0, local: true, estado: await this.estadoLocal() }
      if (s.tipo === 'pessoal' || !this.config.replicacao?.chave) {
        const r = await this.buscar(`${s.endereco}/api/saude`, { signal: AbortSignal.timeout(5000) })
        return { ...s, ok: r.ok, ms: Math.round(performance.now() - inicio), estado: null, ...(r.ok ? {} : { erro: `respondeu ${r.status}` }) }
      }
      const data = String(Math.floor(Date.now() / 1000))
      const quem = this.config.sistema ?? 'completo'
      const r = await this.buscar(`${s.endereco}/api/monitor/estado`, { headers: { 'X-Sistema': quem, 'X-Data': data, 'X-Assinatura': assinar(this.config.replicacao.chave, quem, data, '') }, signal: AbortSignal.timeout(5000) })
      const ms = Math.round(performance.now() - inicio)
      if (!r.ok) return { ...s, ok: false, ms, erro: `respondeu ${r.status}` }
      return { ...s, ok: true, ms, estado: await r.json() }
    } catch (e) {
      return { ...s, ok: false, ms: null, erro: e.name === 'TimeoutError' ? 'não respondeu em 5 segundos' : String(e.cause?.code || e.message).slice(0, 160) }
    }
  }

  async painel(ctx) {
    ctx.actor.exigir('seguranca.ver')
    const sistemas = await Promise.all((await this.lista()).map((s) => this.#consultar(s)))
    // os alertas do conjunto: o que não responde, o que tem a segurança em alerta, as trocas paradas
    const alertas = []
    for (const s of sistemas) {
      if (!s.ok) alertas.push({ nivel: 'critico', sistema: s.nome, texto: `não responde (${s.erro || 'sem resposta'})` })
      const e = s.estado
      if (!e) continue
      if (e.alerta?.nivel && e.alerta.nivel !== 'normal') alertas.push({ nivel: e.alerta.nivel === 'ataque' ? 'critico' : 'medio', sistema: s.nome, texto: `segurança: ${e.alerta.nivel === 'ataque' ? 'ataque em curso' : 'atenção'} (${(e.alerta.motivos ?? []).map((m) => `${m.tipo} ${m.n}`).join(', ')})` })
      const d = e.saude?.disco
      if (d && d.total && d.livre / d.total < 0.1) alertas.push({ nivel: 'alto', sistema: s.nome, texto: `disco quase cheio (${Math.round((d.livre / d.total) * 100)} % livre)` })
      if (e.saude?.processador?.carga > 90) alertas.push({ nivel: 'medio', sistema: s.nome, texto: `processador a ${e.saude.processador.carga} %` })
      for (const p of e.replicacao?.pares ?? []) {
        if (p.ultimoErro) alertas.push({ nivel: 'medio', sistema: s.nome, texto: `troca com ${p.par}: ${p.ultimoErro.slice(0, 160)}` })
        else if (p.ultimaTroca && Date.now() - new Date(p.ultimaTroca).getTime() > 10 * 60_000) alertas.push({ nivel: 'medio', sistema: s.nome, texto: `sem trocar com ${p.par} há ${Math.round((Date.now() - new Date(p.ultimaTroca).getTime()) / 60_000)} min` })
      }
    }
    return { geradoEm: new Date().toISOString(), sistemas, alertas, podeEditar: ctx.actor.pode('seguranca.gerir') }
  }
}

// o pedido de outro sistema (assinado com a chave partilhada, a menos de 5 minutos)
export function pedidoDeMonitorValido(chave, sistema, data, assinatura) {
  if (!chave || !sistema || !/^\d{9,12}$/.test(String(data)) || Math.abs(Date.now() / 1000 - Number(data)) > 300) return false
  const esperada = Buffer.from(assinar(chave, sistema, data, ''))
  const dada = Buffer.from(String(assinatura ?? ''))
  return esperada.length === dada.length && crypto.timingSafeEqual(esperada, dada)
}
