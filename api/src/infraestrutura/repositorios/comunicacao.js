const iso = (d) => (d ? new Date(d).toISOString() : null)
const pessoa = { select: { id: true, nome: true, tipo: true, numero: true } }

// Notificações do portal e mensagens privadas entre contas
export class RepositorioComunicacao {
  constructor({ prisma }) {
    this.prisma = prisma
  }

  // ---------- notificações ----------

  async notificar(contaIds, dados) {
    if (!contaIds.length) return 0
    const r = await this.prisma.notificacao.createMany({ data: contaIds.map((contaId) => ({ contaId, ...dados })) })
    return r.count
  }

  // contas ativas que querem receber por e-mail
  destinatariosEmail(contaIds) {
    if (!contaIds.length) return []
    return this.prisma.contaPortal.findMany({ where: { id: { in: contaIds }, ativo: true, notificarEmail: true }, select: { id: true, nome: true, email: true } })
  }

  async notificacoes(contaId, { limite = 30, antesDe } = {}) {
    const [linhas, naoLidas] = await Promise.all([
      this.prisma.notificacao.findMany({
        where: { contaId, ...(antesDe ? { id: { lt: antesDe } } : {}) },
        orderBy: { id: 'desc' },
        take: limite,
      }),
      this.prisma.notificacao.count({ where: { contaId, lida: false } }),
    ])
    return { lista: linhas.map((n) => ({ ...n, criadaEm: iso(n.criadaEm) })), naoLidas }
  }

  marcarLidas(contaId, ids) {
    return this.prisma.notificacao.updateMany({ where: { contaId, lida: false, ...(ids ? { id: { in: ids } } : {}) }, data: { lida: true } })
  }

  // apaga as notificações lidas com mais de 90 dias (manutenção)
  limparAntigas(antes) {
    return this.prisma.notificacao.deleteMany({ where: { lida: true, criadaEm: { lt: antes } } })
  }

  definirNotificarEmail(contaId, valor) {
    return this.prisma.contaPortal.update({ where: { id: contaId }, data: { notificarEmail: valor } })
  }

  // ---------- avisos no telemóvel (subscrições Web Push) ----------

  async guardarSubscricao(contaId, { endpoint, p256dh, auth, aparelho = '' }) {
    // o mesmo aparelho pode mudar de conta (ex.: telemóvel partilhado): fica com a última
    return this.prisma.subscricaoPush.upsert({ where: { endpoint }, create: { contaId, endpoint, p256dh, auth, aparelho }, update: { contaId, p256dh, auth, aparelho } })
  }

  apagarSubscricao(endpoint, contaId) {
    return this.prisma.subscricaoPush.deleteMany({ where: { endpoint, ...(contaId ? { contaId } : {}) } })
  }

  // subscrições das contas ativas
  subscricoesDe(contaIds) {
    if (!contaIds.length) return []
    return this.prisma.subscricaoPush.findMany({ where: { contaId: { in: contaIds }, conta: { ativo: true } } })
  }

  contarSubscricoes(contaId) {
    return this.prisma.subscricaoPush.count({ where: { contaId } })
  }

  async notificarEmail(contaId) {
    return (await this.prisma.contaPortal.findUnique({ where: { id: contaId }, select: { notificarEmail: true } }))?.notificarEmail ?? true
  }

  // ---------- mensagens ----------

  async enviarMensagem({ deId, paraId, texto }) {
    const m = await this.prisma.mensagem.create({ data: { deId, paraId, texto } })
    return { ...m, criadaEm: iso(m.criadaEm), lidaEm: null }
  }

  // última mensagem de cada conversa e quantas estão por ler
  async conversas(contaId) {
    const linhas = await this.prisma.mensagem.findMany({
      where: { OR: [{ deId: contaId }, { paraId: contaId }] },
      orderBy: { id: 'desc' },
      take: 1000,
      include: { de: pessoa, para: pessoa },
    })
    const porPessoa = new Map()
    for (const m of linhas) {
      const outro = m.deId === contaId ? m.para : m.de
      const c = porPessoa.get(outro.id) || { pessoa: outro, ultima: null, naoLidas: 0 }
      if (!c.ultima) c.ultima = { texto: m.texto, criadaEm: iso(m.criadaEm), minha: m.deId === contaId }
      if (m.paraId === contaId && !m.lidaEm) c.naoLidas += 1
      porPessoa.set(outro.id, c)
    }
    return [...porPessoa.values()]
  }

  async conversa(contaId, outroId, { limite = 200 } = {}) {
    const linhas = await this.prisma.mensagem.findMany({
      where: { OR: [{ deId: contaId, paraId: outroId }, { deId: outroId, paraId: contaId }] },
      orderBy: { id: 'desc' },
      take: limite,
    })
    return linhas.reverse().map((m) => ({ id: m.id, texto: m.texto, minha: m.deId === contaId, criadaEm: iso(m.criadaEm), lidaEm: iso(m.lidaEm) }))
  }

  marcarConversaLida(contaId, outroId, quando) {
    return this.prisma.mensagem.updateMany({ where: { deId: outroId, paraId: contaId, lidaEm: null }, data: { lidaEm: quando } })
  }

  mensagensPorLer(contaId) {
    return this.prisma.mensagem.count({ where: { paraId: contaId, lidaEm: null } })
  }

  // ---------- lembretes de prazo ----------

  // trabalhos com prazo nas próximas horas que ainda não foram lembrados
  trabalhosALembrar(agora, ate) {
    return this.prisma.trabalho.findMany({
      where: { lembreteEm: null, prazo: { gt: agora, lte: ate }, OR: [{ secaoId: null }, { secao: { visivel: true } }] },
      include: { cadeira: { select: { id: true, nome: true, turmaId: true } }, entregas: { select: { estudanteId: true, grupo: { select: { membros: { select: { estudanteId: true } } } } } }, prorrogacoes: { select: { estudanteId: true } } },
    })
  }

  // marca como lembrado; devolve falso se outro processo já o fez (evita lembretes a dobrar)
  async marcarLembrado(trabalhoId, quando) {
    const r = await this.prisma.trabalho.updateMany({ where: { id: trabalhoId, lembreteEm: null }, data: { lembreteEm: quando } })
    return r.count === 1
  }
}
