import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { nomeDoPosto } from '../dominio/pessoal/hierarquia.js'
import { exigir } from './sessao.js'
import { invalido } from '../erros.js'
import { calcularAssinantes } from './assinantes.js'

// com as fotografias, os lotes são pequenos (cada uma tem ~100 KB)
const LOTE = 25
const MAX_TENTATIVAS = 10

// assinatura do pedido: HMAC-SHA256 de "<data>.<corpo>" com a chave partilhada (o portal recusa pedidos com mais de 5 min)
export const assinar = (chave, data, corpo) => crypto.createHmac('sha256', chave).update(`${data}.${corpo}`).digest('hex')

/*
  Envio, num só sentido, dos docentes e estudantes para as contas do Portal Académico. Só sai o necessário
  para a conta (nome, e-mail, posto, ramo, NIP, telefone, unidade — da ESG ou a de origem — e a fotografia, só quando muda); o resto da
  ficha nunca sai daqui.
  Quem deixa de ser docente/estudante ou sai da Escola é enviado como inativo (o portal desativa a conta).
*/
export class ServicoSincronizacao {
  constructor({ bd, auditoria, config, enviar = fetch, agora = () => new Date() }) {
    Object.assign(this, { bd, auditoria, config, enviar, agora })
  }

  get ativa() {
    return Boolean(this.config.portal.url && this.config.portal.chave)
  }

  // a fotografia, em base64, só se o portal ainda não tiver esta; null = foi apagada no Pessoal
  #foto(p, enviada) {
    if (!p.fotoId) return enviada ? null : undefined
    if (p.fotoId === enviada) return undefined
    try {
      return { id: p.fotoId, dados: fs.readFileSync(path.join(this.config.pastaFotos, path.basename(p.fotoId))).toString('base64') }
    } catch {
      return undefined
    }
  }

  #conteudo(p, contaId, fotoEnviada = '') {
    // o militar que é funcionário e também docente ou aluno tem conta no portal (aluno, se estiver num curso)
    const vs = [p.vinculo, ...(p.outrosVinculos ?? [])]
    const ativo = p.ativo && vs.some((v) => ['docente', 'estudante'].includes(v)) && Boolean(p.email)
    const foto = ativo ? this.#foto(p, fotoEnviada) : undefined
    return {
      ref: `pessoal-${p.id}`, contaId: contaId ?? undefined, tipo: p.vinculo === 'docente' ? 'docente' : vs.includes('estudante') ? 'estudante' : 'docente', nome: p.nome, email: p.email, ativo,
      dados: { posto: p.posto ? nomeDoPosto(p.posto, p.ramo) : '', ramo: p.ramo ?? '', nip: p.nip ?? '', telefone: p.telefone ?? '', departamento: p.unidade?.nome || p.unidadeOrigem || '' },
      ...(foto !== undefined ? { foto } : {}),
    }
  }

  async estado(u) {
    exigir(u, 'ver')
    const grupos = await this.bd.sincronizacao.groupBy({ by: ['estado'], _count: true })
    const erros = await this.bd.sincronizacao.findMany({ where: { estado: 'erro' }, include: { pessoa: { select: { nome: true, email: true } } }, take: 50, orderBy: { ultimaTentativa: 'desc' } })
    return { ativa: this.ativa, portal: this.config.portal.url, contagem: Object.fromEntries(grupos.map((g) => [g.estado, g._count])), erros: erros.map((e) => ({ pessoaId: e.pessoaId, nome: e.pessoa.nome, email: e.pessoa.email, erro: e.erro, tentativas: e.tentativas, quando: e.ultimaTentativa })) }
  }

  // volta a pôr na fila todos os docentes e estudantes (ex.: depois de ligar o portal pela primeira vez)
  async reenviarTodos(u) {
    exigir(u, 'administrar')
    const ids = (await this.bd.pessoa.findMany({ where: { OR: [{ vinculo: { in: ['docente', 'estudante'] } }, { outrosVinculos: { hasSome: ['docente', 'estudante'] } }], email: { not: null } }, select: { id: true } })).map((p) => p.id)
    for (const id of ids) await this.bd.sincronizacao.upsert({ where: { pessoaId: id }, create: { pessoaId: id }, update: { estado: 'pendente', tentativas: 0, erro: '' } })
    await this.auditoria.registar(u, 'reenviar_portal', `${ids.length} pessoa(s)`)
    return { emFila: ids.length }
  }

  // depois de uma alteração, envia daí a poucos segundos (junta várias alterações seguidas num só pedido)
  agendar(ms = 3000) {
    if (!this.ativa || this.temporizador) return
    this.temporizador = setTimeout(() => {
      this.temporizador = null
      this.enviarPendentes().catch(() => {})
    }, ms)
    this.temporizador.unref?.()
  }

  // envia o que está pendente (corre de minuto a minuto e também a pedido)
  /*
    Quem assina os diplomas e certificados no portal: quem ocupa hoje os cargos (Comandante, Director de
    Ensino, Chefe da RPQ). Vai com cada envio, só quando muda (uma pessoa nomeada, exonerada ou de licença).
  */
  async enviarAssinaturas() {
    if (!this.ativa) return { enviado: false, inativa: true }
    const d = await this.bd.definicao.findUnique({ where: { chave: 'assinaturas' } })
    const a = await calcularAssinantes(this.bd, d?.valor ?? {}, this.agora())
    const so = ({ cargo, nome, posto, origem }) => ({ cargo, nome, posto, origem })
    const corpo = JSON.stringify({ assinaturas: { comandante: so(a.comandante), directorEnsino: so(a.directorEnsino), chefeRpq: so(a.chefeRpq) } })
    if (corpo === this.ultimasAssinaturas) return { enviado: false, igual: true }
    const data = String(Math.floor(this.agora().getTime() / 1000))
    const r = await this.enviar(`${this.config.portal.url}/api/integracao/pessoal/assinaturas`, {
      method: 'POST', body: corpo, signal: AbortSignal.timeout(20_000),
      headers: { 'Content-Type': 'application/json', 'X-Pessoal-Data': data, 'X-Pessoal-Assinatura': assinar(this.config.portal.chave, data, corpo) },
    })
    if (!r.ok) throw new Error(`O portal respondeu ${r.status} às assinaturas.`)
    this.ultimasAssinaturas = corpo
    return { enviado: true }
  }

  /*
    O estado no portal de cada pessoa (para as tabelas dos estudantes e docentes): o envio (pendente, enviado,
    erro) e, se o portal responder, a conta (número, ativa, último acesso, palavra-passe inicial).
    Sem ligação ao portal, vem só o estado do envio.
  */
  async estadoNoPortal(pessoaIds) {
    const sinc = await this.bd.sincronizacao.findMany({ where: { pessoaId: { in: pessoaIds } } })
    const contas = new Map()
    const ids = sinc.map((x) => x.contaPortalId).filter(Boolean)
    if (this.ativa && ids.length) {
      try {
        const corpo = JSON.stringify({ ids })
        const data = String(Math.floor(this.agora().getTime() / 1000))
        const r = await this.enviar(`${this.config.portal.url}/api/integracao/pessoal/estado-contas`, {
          method: 'POST', body: corpo, signal: AbortSignal.timeout(8_000),
          headers: { 'Content-Type': 'application/json', 'X-Pessoal-Data': data, 'X-Pessoal-Assinatura': assinar(this.config.portal.chave, data, corpo) },
        })
        if (r.ok) for (const c of await r.json()) contas.set(c.id, c)
      } catch { /* sem ligação: fica só o estado do envio */ }
    }
    return new Map(sinc.map((x) => [x.pessoaId, { envio: x.estado, erro: x.erro, conta: x.contaPortalId ? contas.get(x.contaPortalId) ?? { id: x.contaPortalId } : null }]))
  }

  // fichas de acesso de várias pessoas de uma vez (ex.: uma turma nova); as que falham vêm com o motivo
  async fichasAcesso(u, ids) {
    exigir(u, 'editar')
    const fichas = []
    const erros = []
    for (const id of ids.slice(0, 100)) {
      try {
        fichas.push(await this.fichaAcesso(u, id))
      } catch (e) {
        const p = await this.bd.pessoa.findUnique({ where: { id }, select: { nome: true } })
        erros.push({ id, nome: p?.nome ?? `#${id}`, erro: e.message })
      }
    }
    return { fichas, erros }
  }

  /*
    Ficha de acesso ao portal pedida aqui (a Repartição regista e entrega no mesmo sítio): o portal dá uma
    palavra-passe inicial nova, que vem só na resposta para se imprimir (não fica guardada no Pessoal).
  */
  async fichaAcesso(u, pessoaId) {
    exigir(u, 'editar')
    if (!this.ativa) throw invalido('O Pessoal não está ligado ao Portal Académico.')
    const s = await this.bd.sincronizacao.findUnique({ where: { pessoaId }, include: { pessoa: { select: { nome: true } } } })
    if (!s?.contaPortalId) throw invalido('Esta pessoa ainda não tem conta no portal (é docente ou estudante, com e-mail? espere o envio e tente de novo).')
    const corpo = JSON.stringify({ contaId: s.contaPortalId, pedidoPor: u.nome || u.email || '' })
    const data = String(Math.floor(this.agora().getTime() / 1000))
    let r
    try {
      r = await this.enviar(`${this.config.portal.url}/api/integracao/pessoal/ficha-acesso`, {
        method: 'POST', body: corpo, signal: AbortSignal.timeout(15_000),
        headers: { 'Content-Type': 'application/json', 'X-Pessoal-Data': data, 'X-Pessoal-Assinatura': assinar(this.config.portal.chave, data, corpo) },
      })
    } catch (e) {
      throw invalido(`Sem ligação ao portal: ${e.message}`)
    }
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw invalido(j.erro || `O portal respondeu ${r.status}.`)
    await this.auditoria.registar(u, 'ficha_acesso_portal', `${s.pessoa.nome} (${j.numero})`)
    return { nome: j.nome, numero: j.numero, email: j.email, senhaInicial: j.senhaInicial, portal: j.portal || '' }
  }

  async enviarPendentes() {
    if (!this.ativa) return { enviados: 0, erros: 0, inativa: true }
    await this.enviarAssinaturas().catch(() => {})
    const fila = await this.bd.sincronizacao.findMany({ where: { OR: [{ estado: 'pendente' }, { estado: 'erro', tentativas: { lt: MAX_TENTATIVAS } }] }, include: { pessoa: { include: { unidade: { select: { nome: true } } } } }, take: LOTE, orderBy: { pessoaId: 'asc' } })
    if (!fila.length) return { enviados: 0, erros: 0 }
    const corpo = JSON.stringify({ pessoas: fila.map((s) => this.#conteudo(s.pessoa, s.contaPortalId, s.fotoEnviada)) })
    const data = String(Math.floor(this.agora().getTime() / 1000))
    let resultados
    try {
      const r = await this.enviar(`${this.config.portal.url}/api/integracao/pessoal/contas`, {
        method: 'POST', body: corpo, signal: AbortSignal.timeout(20_000),
        headers: { 'Content-Type': 'application/json', 'X-Pessoal-Data': data, 'X-Pessoal-Assinatura': assinar(this.config.portal.chave, data, corpo) },
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.erro || `O portal respondeu ${r.status}.`)
      resultados = new Map((j.resultados || []).map((x) => [x.ref, x]))
    } catch (e) {
      const erro = `Sem ligação ao portal: ${e.message}`.slice(0, 300)
      await this.bd.sincronizacao.updateMany({ where: { pessoaId: { in: fila.map((s) => s.pessoaId) } }, data: { estado: 'erro', erro, tentativas: { increment: 1 }, ultimaTentativa: this.agora() } })
      return { enviados: 0, erros: fila.length, erro }
    }
    let enviados = 0
    for (const s of fila) {
      const x = resultados.get(`pessoal-${s.pessoaId}`)
      const ok = Boolean(x?.ok)
      if (ok) enviados++
      await this.bd.sincronizacao.update({ where: { pessoaId: s.pessoaId }, data: { estado: ok ? 'enviado' : 'erro', erro: ok ? '' : String(x?.erro || 'O portal não respondeu por esta pessoa.').slice(0, 300), tentativas: ok ? 0 : { increment: 1 }, ultimaTentativa: this.agora(), contaPortalId: x?.contaId ?? s.contaPortalId, ...(ok ? { fotoEnviada: s.pessoa.fotoId ?? '' } : {}) } })
    }
    return { enviados, erros: fila.length - enviados }
  }
}
