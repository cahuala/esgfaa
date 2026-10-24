const paraTraducao = (t) => t && {
  colecao: t.colecao, alvoId: t.alvoId, lingua: t.lingua, textos: t.textos, originais: t.originais, estado: t.estado,
  automatica: t.automatica, atualizadoEm: t.atualizadoEm.toISOString(), atualizadoPor: t.atualizadoPor,
}

export class RepositorioTraducoes {
  constructor({ prisma }) {
    this.prisma = prisma
  }

  async doAlvo(colecao, alvoId) {
    return (await this.prisma.traducao.findMany({ where: { colecao, alvoId: String(alvoId) } })).map(paraTraducao)
  }

  async ler(colecao, alvoId, lingua) {
    return paraTraducao(await this.prisma.traducao.findUnique({ where: { colecao_alvoId_lingua: { colecao, alvoId: String(alvoId), lingua } } }))
  }

  async guardar({ colecao, alvoId, lingua, ...dados }) {
    const chave = { colecao, alvoId: String(alvoId), lingua }
    return paraTraducao(await this.prisma.traducao.upsert({ where: { colecao_alvoId_lingua: chave }, create: { ...chave, ...dados }, update: dados }))
  }

  async apagar(colecao, alvoId, lingua) {
    await this.prisma.traducao.deleteMany({ where: { colecao, alvoId: String(alvoId), ...(lingua ? { lingua } : {}) } })
  }

  async publicadas() {
    return (await this.prisma.traducao.findMany({ where: { estado: 'publicada' }, select: { colecao: true, alvoId: true, lingua: true, textos: true, automatica: true } }))
  }

  // memória dos textos soltos dos painéis: { chave: texto } das chaves já traduzidas
  async textosGuardados(lingua, chaves) {
    const l = await this.prisma.textoTraduzido.findMany({ where: { lingua, chave: { in: chaves } }, select: { chave: true, texto: true } })
    return Object.fromEntries(l.map((x) => [x.chave, x.texto]))
  }

  async guardarTextos(lingua, linhas) {
    if (linhas.length) await this.prisma.textoTraduzido.createMany({ data: linhas.map((x) => ({ lingua, ...x })), skipDuplicates: true })
  }

  // para rever no painel: as mais recentes primeiro (e as revistas à mão por último)
  async listarTextos({ lingua, q = '', revisto, limite = 500 }) {
    const where = { lingua, ...(revisto === undefined ? {} : { revisto }), ...(q ? { OR: [{ original: { contains: q, mode: 'insensitive' } }, { texto: { contains: q, mode: 'insensitive' } }] } : {}) }
    const [itens, total] = await Promise.all([
      this.prisma.textoTraduzido.findMany({ where, orderBy: [{ revisto: 'asc' }, { criadoEm: 'desc' }], take: limite }),
      this.prisma.textoTraduzido.count({ where }),
    ])
    return { total, itens: itens.map((x) => ({ chave: x.chave, original: x.original, texto: x.texto, revisto: x.revisto, revistoPor: x.revistoPor, criadoEm: x.criadoEm.toISOString() })) }
  }

  async lerTexto(lingua, chave) {
    return this.prisma.textoTraduzido.findUnique({ where: { lingua_chave: { lingua, chave } } })
  }

  async corrigirTexto(lingua, chave, texto, quem) {
    return this.prisma.textoTraduzido.update({ where: { lingua_chave: { lingua, chave } }, data: { texto, revisto: true, revistoPor: quem } })
  }

  async apagarTexto(lingua, chave) {
    await this.prisma.textoTraduzido.deleteMany({ where: { lingua, chave } })
  }

  // resumo para as listas do painel: { "noticias/slug": { en: "publicada", fr: "rascunho" } }
  async estados(colecao) {
    const l = await this.prisma.traducao.findMany({ where: { colecao }, select: { alvoId: true, lingua: true, estado: true } })
    const r = {}
    for (const t of l) (r[t.alvoId] ||= {})[t.lingua] = t.estado
    return r
  }
}
