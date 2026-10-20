const iso = (d) => (d ? d.toISOString() : null)

const paraDocumento = (d) => d && {
  id: d.id, origem: d.origem, origemId: d.origemId, titulo: d.titulo, autor: d.autor, contexto: d.contexto, palavras: d.palavras,
  fonte: d.fonte, contaId: d.contaId, pedidoPor: d.pedidoPor, criadoEm: iso(d.criadoEm),
  ...(d.texto !== undefined ? { texto: d.texto } : {}),
}

const paraAnalise = (a) => a && {
  id: a.id, documentoId: a.documentoId, estado: a.estado, percentagem: a.percentagem === null ? null : Number(a.percentagem),
  fontes: a.fontes, trechos: a.trechos, opcoes: a.opcoes, erro: a.erro, internet: a.internet, ia: a.ia, normas: a.normas, verificacoes: a.verificacoes ?? {}, criadaEm: iso(a.criadaEm), concluidaEm: iso(a.concluidaEm),
  ...(a.documento ? { documento: paraDocumento(a.documento) } : {}),
}

const semTexto = { id: true, origem: true, origemId: true, titulo: true, autor: true, contexto: true, palavras: true, fonte: true, contaId: true, pedidoPor: true, criadoEm: true }

// documentos (texto e impressões) e análises de originalidade
export class RepositorioIntegridade {
  constructor({ prisma }) {
    this.prisma = prisma
  }

  async documento(id, { comTexto = false } = {}) {
    const n = Number(id)
    if (!Number.isSafeInteger(n) || n < 1) return null
    return paraDocumento(await this.prisma.documentoIntegridade.findUnique({ where: { id: n }, ...(comTexto ? {} : { select: semTexto }) }))
  }

  async documentoDe(origem, origemId) {
    return paraDocumento(await this.prisma.documentoIntegridade.findUnique({ where: { origem_origemId: { origem, origemId: String(origemId) } }, select: semTexto }))
  }

  async documentosComTexto(ids) {
    return (await this.prisma.documentoIntegridade.findMany({ where: { id: { in: ids } } })).map(paraDocumento)
  }

  // grava (ou substitui, para a mesma origem) o texto e as impressões (exactas e aproximadas) de um documento
  async gravarDocumento({ origem, origemId = null, impressoes, aproximadas = [], ...dados }) {
    return this.prisma.$transaction(async (tx) => {
      let d
      if (origemId !== null) {
        d = await tx.documentoIntegridade.upsert({ where: { origem_origemId: { origem, origemId: String(origemId) } }, create: { origem, origemId: String(origemId), ...dados }, update: dados })
        await tx.impressaoIntegridade.deleteMany({ where: { documentoId: d.id } })
      } else {
        d = await tx.documentoIntegridade.create({ data: { origem, ...dados } })
      }
      if (dados.fonte !== false && (impressoes.length || aproximadas.length)) {
        await tx.impressaoIntegridade.createMany({
          data: [...impressoes.map((x) => ({ documentoId: d.id, tipo: 0, posicao: x.p, hash: x.h })), ...aproximadas.map((x) => ({ documentoId: d.id, tipo: 1, posicao: x.p, hash: x.h }))],
          skipDuplicates: true,
        })
      }
      return paraDocumento({ ...d, texto: undefined })
    }, { timeout: 60_000 })
  }

  async apagarDocumento(id) {
    await this.prisma.documentoIntegridade.deleteMany({ where: { id } })
  }

  async apagarDocumentoDe(origem, origemId) {
    await this.prisma.documentoIntegridade.deleteMany({ where: { origem, origemId: String(origemId) } })
  }

  // documentos (fontes) que partilham mais impressões com estas (tipo 0 exactas, 1 aproximadas), sem contar o próprio
  async candidatos(hashes, excepto, { tipo = 0, limite = 12 } = {}) {
    if (!hashes.length) return []
    const l = await this.prisma.impressaoIntegridade.groupBy({
      by: ['documentoId'], where: { tipo, hash: { in: [...new Set(hashes)] }, documentoId: { not: excepto } },
      _count: { _all: true }, orderBy: { _count: { documentoId: 'desc' } }, take: limite,
    })
    return l.filter((x) => x._count._all >= 2).map((x) => x.documentoId)
  }

  async listarDocumentos({ origens, contaId } = {}) {
    return (await this.prisma.documentoIntegridade.findMany({
      where: { ...(origens ? { origem: { in: origens } } : {}), ...(contaId ? { contaId } : {}) }, orderBy: { criadoEm: 'desc' }, take: 1000, select: semTexto,
    })).map(paraDocumento)
  }

  async contarPorOrigem() {
    const l = await this.prisma.documentoIntegridade.groupBy({ by: ['origem'], where: { fonte: true }, _count: { _all: true } })
    return Object.fromEntries(l.map((x) => [x.origem, x._count._all]))
  }

  // ---------- análises ----------

  async criarAnalise(documentoId, opcoes) {
    return paraAnalise(await this.prisma.analiseIntegridade.create({ data: { documentoId, opcoes } }))
  }

  async analise(id) {
    const n = Number(id)
    if (!Number.isSafeInteger(n) || n < 1) return null
    return paraAnalise(await this.prisma.analiseIntegridade.findUnique({ where: { id: n }, include: { documento: true } }))
  }

  async concluirAnalise(id, dados) {
    await this.prisma.analiseIntegridade.update({ where: { id }, data: dados })
  }

  async pendentes() {
    return (await this.prisma.analiseIntegridade.findMany({ where: { estado: 'pendente' }, select: { id: true } })).map((a) => a.id)
  }

  // a análise mais recente de cada documento destas origens
  async ultimasAnalises(origem, origemIds) {
    const docs = await this.prisma.documentoIntegridade.findMany({
      where: { origem, origemId: { in: origemIds.map(String) } }, select: { origemId: true, analises: { orderBy: { criadaEm: 'desc' }, take: 1 } },
    })
    return Object.fromEntries(docs.filter((d) => d.analises[0]).map((d) => [d.origemId, paraAnalise(d.analises[0])]))
  }

  async listarAnalises({ origens, contaId, limite = 200 } = {}) {
    const l = await this.prisma.analiseIntegridade.findMany({
      where: { documento: { ...(origens ? { origem: { in: origens } } : {}), ...(contaId ? { contaId } : {}) } },
      orderBy: { criadaEm: 'desc' }, take: limite, include: { documento: { select: semTexto } },
    })
    return l.map((a) => ({ ...paraAnalise(a), trechos: undefined }))
  }

  // entregas que ainda não foram indexadas (feitas antes de haver anti-plágio)
  async entregasPorIndexar() {
    const [entregas, feitas] = await Promise.all([
      this.prisma.entrega.findMany({ select: { id: true } }),
      this.prisma.documentoIntegridade.findMany({ where: { origem: 'entrega' }, select: { origemId: true } }),
    ])
    const ja = new Set(feitas.map((d) => d.origemId))
    return entregas.map((e) => e.id).filter((id) => !ja.has(String(id)))
  }

  // fontes indexadas antes das impressões aproximadas (para as reindexar)
  async semAproximadas(limite = 500) {
    const l = await this.prisma.documentoIntegridade.findMany({ where: { fonte: true, impressoes: { none: { tipo: 1 } } }, select: { id: true }, take: limite })
    return l.map((d) => d.id)
  }

  async gravarAproximadas(documentoId, aproximadas) {
    await this.prisma.impressaoIntegridade.createMany({ data: aproximadas.map((x) => ({ documentoId, tipo: 1, posicao: x.p, hash: x.h })), skipDuplicates: true })
  }

  async resumo() {
    const [analises, altas, pendentes] = await Promise.all([
      this.prisma.analiseIntegridade.count({ where: { estado: 'concluida' } }),
      this.prisma.analiseIntegridade.count({ where: { estado: 'concluida', percentagem: { gte: 35 } } }),
      this.prisma.analiseIntegridade.count({ where: { estado: 'pendente' } }),
    ])
    return { analises, altas, pendentes, fontes: await this.contarPorOrigem() }
  }
}
