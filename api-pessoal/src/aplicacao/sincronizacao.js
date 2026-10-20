import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { nomeDoPosto } from '../dominio/pessoal/hierarquia.js'
import { exigir } from './sessao.js'

// com as fotografias, os lotes são pequenos (cada uma tem ~100 KB)
const LOTE = 25
const MAX_TENTATIVAS = 10

// assinatura do pedido: HMAC-SHA256 de "<data>.<corpo>" com a chave partilhada (o portal recusa pedidos com mais de 5 min)
export const assinar = (chave, data, corpo) => crypto.createHmac('sha256', chave).update(`${data}.${corpo}`).digest('hex')

/*
  Envio, num só sentido, dos docentes e estudantes para as contas do Portal Académico. Só sai o necessário
  para a conta (nome, e-mail, posto, ramo, NIP, telefone, unidade e a fotografia, só quando muda); o resto da
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
      dados: { posto: p.posto ? nomeDoPosto(p.posto, p.ramo) : '', ramo: p.ramo ?? '', nip: p.nip ?? '', telefone: p.telefone ?? '', departamento: p.unidade?.nome ?? '' },
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
  async enviarPendentes() {
    if (!this.ativa) return { enviados: 0, erros: 0, inativa: true }
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
