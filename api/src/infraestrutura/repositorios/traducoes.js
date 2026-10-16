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

  // resumo para as listas do painel: { "noticias/slug": { en: "publicada", fr: "rascunho" } }
  async estados(colecao) {
    const l = await this.prisma.traducao.findMany({ where: { colecao }, select: { alvoId: true, lingua: true, estado: true } })
    const r = {}
    for (const t of l) (r[t.alvoId] ||= {})[t.lingua] = t.estado
    return r
  }
}
