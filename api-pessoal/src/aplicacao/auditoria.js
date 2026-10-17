import { exigir } from './sessao.js'

// registo de quem fez o quê (alterações, decisões, entradas e exportações)
export class ServicoAuditoria {
  constructor({ bd }) {
    this.bd = bd
  }

  async registar(u, acao, alvo = '', detalhes = {}, ip = '') {
    await this.bd.auditoria.create({ data: { utilizador: u?.email || u?.nome || 'sistema', acao, alvo: String(alvo).slice(0, 300), detalhes: JSON.parse(JSON.stringify(detalhes ?? {})), ip } })
  }

  async listar(u, { de, ate, utilizador, acao } = {}) {
    exigir(u, 'administrar')
    const where = {}
    if (de || ate) where.quando = { ...(de ? { gte: new Date(de) } : {}), ...(ate ? { lte: new Date(`${ate}T23:59:59Z`) } : {}) }
    if (utilizador) where.utilizador = utilizador
    if (acao) where.acao = acao
    return this.bd.auditoria.findMany({ where, orderBy: { quando: 'desc' }, take: 5000 })
  }
}
