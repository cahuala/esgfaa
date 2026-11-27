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
const TIPOS = { pessoal: 'Sistema de Gestão de Pessoal', escolar: 'Sistema de Gestão Escolar', site: 'Sistema de Gestão do Site', biblioteca: 'Sistema de Biblioteca', online: 'Servidor online (site público e Portal)', ciberseguranca: 'Sistema de Cibersegurança', completo: 'Sistema completo' }
// os conteúdos do site que se acompanham (notícias, eventos, páginas…)
const COLECOES_SITE = { noticias: 'Notícia', eventos: 'Evento', artigos: 'Artigo', cursos: 'Curso', pessoas: 'Pessoa', revistas: 'Revista', publicidade: 'Publicidade' }

// a lista por omissão: os sistemas da Escola (no mesmo servidor, pelo endereço interno; o online, pelo da internet)
export function sistemasPorOmissao(config) {
  const online = config.replicacao?.url || 'https://portal.esg.emfaa.gov.ao'
  return [
    { id: 'pessoal', nome: TIPOS.pessoal, tipo: 'pessoal', dominio: 'esg.emfaa.gov.ao', endereco: 'http://127.0.0.1:3002' },
    { id: 'escolar', nome: TIPOS.escolar, tipo: 'escolar', dominio: 'escolar.esg.emfaa.gov.ao', endereco: 'http://127.0.0.1:3001' },
    { id: 'site', nome: TIPOS.site, tipo: 'site', dominio: 'gestao-site.esg.emfaa.gov.ao', endereco: 'http://127.0.0.1:3003' },
    { id: 'biblioteca', nome: TIPOS.biblioteca, tipo: 'biblioteca', dominio: 'biblioteca.esg.emfaa.gov.ao', endereco: 'http://127.0.0.1:3004' },
    { id: 'online', nome: TIPOS.online, tipo: 'online', dominio: new URL(online).host, endereco: online },
    { id: 'ciberseguranca', nome: TIPOS.ciberseguranca, tipo: 'ciberseguranca', dominio: 'ciberseguranca.esg.emfaa.gov.ao', endereco: 'http://127.0.0.1:3005' },
  ]
}

export class ServicoMonitorizacao {
  constructor({ config, prisma, seguranca, replicacao = null, paginas, auditoria, fetch: buscar = globalThis.fetch, relogio }) {
    Object.assign(this, { config, prisma, seguranca, replicacao, paginas, auditoria, buscar, relogio })
  }

  // o estado deste sistema (o que os outros pedem, e o que o ecrã mostra deste)
  async estadoLocal() {
    const sistema = this.config.sistema ?? 'completo'
    const comSite = ['site', 'online', 'completo'].includes(sistema)
    const [seg, bd, rep, itens, actividade] = await Promise.all([
      this.seguranca.resumoParaMonitor(),
      this.prisma.$queryRawUnsafe('SELECT pg_database_size(current_database())::bigint AS tamanho, (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database())::int AS ligacoes').then((r) => r[0]).catch(() => null),
      this.replicacao ? this.replicacao.estado() : null,
      // as últimas actualizações do site (notícias, eventos, páginas…)
      comSite ? this.prisma.item.findMany({ where: { colecao: { in: Object.keys(COLECOES_SITE) } }, orderBy: { atualizadoEm: 'desc' }, take: 15, select: { colecao: true, id: true, dados: true, estado: true, atualizadoEm: true } }).catch(() => []) : [],
      // o que se fez aqui nas últimas horas (registo de actividades)
      this.prisma.atividade.findMany({ orderBy: { data: 'desc' }, take: 25, select: { acao: true, colecao: true, alvoTitulo: true, utilizadorNome: true, data: true } }).catch(() => []),
    ])
    return {
      sistema: this.config.sistema ?? 'completo', nome: TIPOS[this.config.sistema ?? 'completo'], dominio: this.config.urlPublico ? new URL(this.config.urlPublico).host : '',
      ...seg, baseDados: { ...seg.saude.baseDados, tamanho: bd ? Number(bd.tamanho) : null, ligacoes: bd?.ligacoes ?? null },
      replicacao: rep ? { url: rep.url, porEnviar: rep.porEnviar, pares: rep.pares, trocas: rep.trocas ?? [], mudancas24h: rep.mudancas24h ?? [] } : null,
      actualizacoes: itens.map((i) => ({ tipo: COLECOES_SITE[i.colecao] ?? i.colecao, titulo: String(i.dados?.titulo ?? i.dados?.nome ?? i.id).slice(0, 160), estado: i.estado, quando: i.atualizadoEm })),
      actividade: actividade.map((a) => ({ acao: a.acao, colecao: a.colecao, alvo: String(a.alvoTitulo ?? '').slice(0, 160), quem: a.utilizadorNome ?? 'sistema', quando: a.data })),
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
    this.#anotarDisponibilidade(sistemas)
    // a comunicação entre os sistemas (as trocas que cada um registou) e as actualizações de todos
    const trocas = sistemas.flatMap((s) => (s.estado?.replicacao?.trocas ?? []).map((t) => ({ ...t, registadoPor: s.nome }))).sort((a, b) => String(b.quando).localeCompare(String(a.quando))).slice(0, 120)
    const mudancas = sistemas.flatMap((s) => (s.estado?.replicacao?.mudancas24h ?? []).map((m) => ({ ...m, sistema: s.nome })))
    const actualizacoes = sistemas.flatMap((s) => (s.estado?.actualizacoes ?? []).map((a) => ({ ...a, sistema: s.nome }))).sort((a, b) => String(b.quando).localeCompare(String(a.quando))).slice(0, 40)
    const actividade = sistemas.flatMap((s) => (s.estado?.actividade ?? []).map((a) => ({ ...a, sistema: s.nome }))).sort((a, b) => String(b.quando).localeCompare(String(a.quando))).slice(0, 60)
    const disponibilidade = Object.fromEntries(sistemas.map((s) => [s.id, this.#disponibilidade(s.id)]))
    return { geradoEm: new Date().toISOString(), sistemas, alertas, trocas, mudancas, actualizacoes, actividade, disponibilidade, vigilancia: Boolean(this.temporizador), podeEditar: ctx.actor.pode('seguranca.gerir') }
  }

  // ---------- vigilância contínua (no Sistema de Cibersegurança): de minuto a minuto, todos os sistemas ----------

  #anotarDisponibilidade(sistemas) {
    if (!this.historia) this.historia = new Map()
    const agora = Date.now()
    for (const s of sistemas) {
      const h = this.historia.get(s.id) ?? []
      const antes = h.at(-1)
      h.push({ t: agora, ok: s.ok, ms: s.ms })
      while (h.length && agora - h[0].t > 86_400_000) h.shift()
      this.historia.set(s.id, h)
      // a mudança de estado fica no registo de actividades (deixou de responder / voltou)
      if (antes && antes.ok !== s.ok) {
        this.auditoria.registar({ actor: null, ip: null, agente: 'monitorizacao' }, { acao: s.ok ? 'sistema_voltou' : 'sistema_sem_resposta', colecao: 'monitorizacao', alvoTitulo: `${s.nome}${s.ok ? '' : ` — ${s.erro || 'sem resposta'}`}`, utilizador: null }).catch(() => {})
      }
    }
  }

  // nas últimas 24 h: a percentagem do tempo em que respondeu, o tempo médio e as últimas 60 verificações
  #disponibilidade(id) {
    const h = this.historia?.get(id) ?? []
    if (!h.length) return null
    const ok = h.filter((x) => x.ok)
    const tempos = ok.map((x) => x.ms).filter((x) => typeof x === 'number')
    return { verificacoes: h.length, percentagem: Math.round((ok.length / h.length) * 1000) / 10, msMedio: tempos.length ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : null, ultimas: h.slice(-60).map((x) => (x.ok ? 1 : 0)), desde: new Date(h[0].t).toISOString() }
  }

  iniciarVigilancia(intervaloS = 60) {
    if (this.temporizador) return
    const ctx = { actor: { id: null, nome: 'Vigilância', pode: () => true, exigir: () => {} } }
    const correr = () => this.painel(ctx).catch((e) => console.error(JSON.stringify({ nivel: 'erro', mensagem: 'Vigilância dos sistemas', erro: e.message })))
    this.temporizador = setInterval(correr, intervaloS * 1000)
    this.temporizador.unref?.()
    setTimeout(correr, 3000).unref?.()
  }

  pararVigilancia() {
    clearInterval(this.temporizador)
    this.temporizador = null
  }
}

// o pedido de outro sistema (assinado com a chave partilhada, a menos de 5 minutos)
export function pedidoDeMonitorValido(chave, sistema, data, assinatura) {
  if (!chave || !sistema || !/^\d{9,12}$/.test(String(data)) || Math.abs(Date.now() / 1000 - Number(data)) > 300) return false
  const esperada = Buffer.from(assinar(chave, sistema, data, ''))
  const dada = Buffer.from(String(assinatura ?? ''))
  return esperada.length === dada.length && crypto.timingSafeEqual(esperada, dada)
}
