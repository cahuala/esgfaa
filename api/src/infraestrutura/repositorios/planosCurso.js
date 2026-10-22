const iso = (d) => (d ? new Date(d).toISOString() : null)
const num = (v) => (v === null || v === undefined ? null : Number(v))

const paraPlano = (p) => p && {
  id: p.id, curso: p.curso, anoLetivo: p.anoLetivo, nome: p.nome, termo: p.termo, formula: p.formula, blocos: p.blocos ?? [],
  ajusteMaximo: Number(p.ajusteMaximo ?? 0), exigirBlocos: p.exigirBlocos, exigirTesteEscrito: p.exigirTesteEscrito, faltasMaximas: p.faltasMaximas, exigirUcs: p.exigirUcs, exigirTii: p.exigirTii, recuperacaoAutomatica: p.recuperacaoAutomatica, duracaoMeses: p.duracaoMeses, factoresJuizo: p.factoresJuizo ?? [],
  criadoEm: iso(p.criadoEm), atualizadoEm: iso(p.atualizadoEm),
}
const paraNota = (n) => ({
  nota: num(n.nota), recuperacao: num(n.recuperacao), recuperacaoPedidaEm: iso(n.recuperacaoPedidaEm),
  revisao: n.revisaoPedidaEm ? { pedidaEm: iso(n.revisaoPedidaEm), motivo: n.revisaoMotivo ?? '', decididaEm: iso(n.revisaoDecididaEm), decisao: n.revisaoDecisao ?? null, notaAnterior: num(n.revisaoNotaAnterior), decisor: n.revisaoDecisor ?? '', fundamento: n.revisaoFundamento ?? '' } : null,
})
const paraAvaliacao = (a) => a && { id: a.id, cadeiraId: a.cadeiraId, tipo: a.tipo, forma: a.forma, peso: num(a.peso), titulo: a.titulo, data: a.data, ordem: a.ordem, publicadaEm: iso(a.publicadaEm) }

// planos de curso da ESG, provas (TAI/TAG) das UC e as notas de cada estudante
export class RepositorioPlanosCurso {
  constructor({ prisma }) {
    this.prisma = prisma
  }

  async planos() {
    return (await this.prisma.planoCurso.findMany({ orderBy: [{ anoLetivo: 'desc' }, { nome: 'asc' }] })).map(paraPlano)
  }

  async plano(id) {
    const n = Number(id)
    if (!Number.isSafeInteger(n) || n < 1) return null
    return paraPlano(await this.prisma.planoCurso.findUnique({ where: { id: n } }))
  }

  // o plano que se aplica a uma turma (pelo curso e o ano lectivo)
  async daTurma(turma) {
    if (!turma?.curso || !turma?.anoLetivo) return null
    return paraPlano(await this.prisma.planoCurso.findUnique({ where: { curso_anoLetivo: { curso: turma.curso, anoLetivo: turma.anoLetivo } } }))
  }

  async guardarPlano(id, dados) {
    const p = id ? await this.prisma.planoCurso.update({ where: { id }, data: dados }) : await this.prisma.planoCurso.create({ data: dados })
    return paraPlano(p)
  }

  apagarPlano(id) {
    return this.prisma.planoCurso.delete({ where: { id } })
  }

  // ---------- provas ----------

  async avaliacoes(cadeiraId) {
    return (await this.prisma.avaliacaoUc.findMany({ where: { cadeiraId }, orderBy: [{ ordem: 'asc' }, { id: 'asc' }] })).map(paraAvaliacao)
  }

  async avaliacoesDasCadeiras(ids) {
    if (!ids.length) return []
    return (await this.prisma.avaliacaoUc.findMany({ where: { cadeiraId: { in: ids } }, orderBy: [{ ordem: 'asc' }, { id: 'asc' }] })).map(paraAvaliacao)
  }

  async avaliacao(id) {
    const n = Number(id)
    if (!Number.isSafeInteger(n) || n < 1) return null
    return paraAvaliacao(await this.prisma.avaliacaoUc.findUnique({ where: { id: n } }))
  }

  async criarAvaliacao(dados) {
    const ordem = await this.prisma.avaliacaoUc.count({ where: { cadeiraId: dados.cadeiraId } })
    return paraAvaliacao(await this.prisma.avaliacaoUc.create({ data: { ordem, ...dados } }))
  }

  async atualizarAvaliacao(id, dados) {
    return paraAvaliacao(await this.prisma.avaliacaoUc.update({ where: { id }, data: dados }))
  }

  apagarAvaliacao(id) {
    return this.prisma.avaliacaoUc.delete({ where: { id } })
  }

  // ---------- notas ----------

  // { avaliacaoId: { estudanteId: { nota, recuperacao, recuperacaoPedidaEm } } }
  async notas(avaliacaoIds) {
    if (!avaliacaoIds.length) return {}
    const l = await this.prisma.notaAvaliacaoUc.findMany({ where: { avaliacaoId: { in: avaliacaoIds } } })
    const r = {}
    for (const n of l) (r[n.avaliacaoId] ??= {})[n.estudanteId] = paraNota(n)
    return r
  }

  // as notas de um estudante: { avaliacaoId: { nota, recuperacao, recuperacaoPedidaEm } }
  async notasDoEstudante(estudanteId, avaliacaoIds) {
    if (!avaliacaoIds.length) return {}
    const l = await this.prisma.notaAvaliacaoUc.findMany({ where: { estudanteId, avaliacaoId: { in: avaliacaoIds } } })
    return Object.fromEntries(l.map((n) => [n.avaliacaoId, paraNota(n)]))
  }

  // linhas: [{ estudanteId, nota, recuperacao }] (null apaga)
  async gravarNotas(avaliacaoId, linhas) {
    await this.prisma.$transaction(linhas.map((l) => this.prisma.notaAvaliacaoUc.upsert({
      where: { avaliacaoId_estudanteId: { avaliacaoId, estudanteId: l.estudanteId } },
      create: { avaliacaoId, estudanteId: l.estudanteId, nota: l.nota, recuperacao: l.recuperacao },
      update: { nota: l.nota, recuperacao: l.recuperacao },
    })))
  }

  async pedirRecuperacao(avaliacaoId, estudanteId, quando) {
    await this.prisma.notaAvaliacaoUc.update({ where: { avaliacaoId_estudanteId: { avaliacaoId, estudanteId } }, data: { recuperacaoPedidaEm: quando } })
  }

  async pedirRevisao(avaliacaoId, estudanteId, motivo, quando) {
    await this.prisma.notaAvaliacaoUc.update({ where: { avaliacaoId_estudanteId: { avaliacaoId, estudanteId } }, data: { revisaoPedidaEm: quando, revisaoMotivo: motivo } })
  }

  async decidirRevisao(avaliacaoId, estudanteId, { nota, notaAnterior, decisao, decisor, fundamento, quando }) {
    await this.prisma.notaAvaliacaoUc.update({ where: { avaliacaoId_estudanteId: { avaliacaoId, estudanteId } }, data: { nota, revisaoNotaAnterior: notaAnterior, revisaoDecisao: decisao, revisaoDecisor: decisor, revisaoFundamento: fundamento, revisaoDecididaEm: quando } })
  }

  // os pedidos de revisão das provas de umas UC (para o Director de Ensino)
  async revisoes(cadeiraIds) {
    if (!cadeiraIds.length) return []
    const l = await this.prisma.notaAvaliacaoUc.findMany({ where: { revisaoPedidaEm: { not: null }, avaliacao: { cadeiraId: { in: cadeiraIds } } }, include: { avaliacao: true, estudante: { select: { id: true, nome: true, numero: true } } }, orderBy: { revisaoPedidaEm: 'asc' } })
    return l.map((n) => ({ avaliacao: paraAvaliacao(n.avaliacao), estudante: n.estudante, ...paraNota(n) }))
  }

  // quem pediu recuperação nesta prova (para o docente)
  async pedidosRecuperacao(avaliacaoId) {
    return (await this.prisma.notaAvaliacaoUc.findMany({ where: { avaliacaoId, recuperacaoPedidaEm: { not: null } }, select: { estudanteId: true, recuperacaoPedidaEm: true } }))
      .map((x) => ({ estudanteId: x.estudanteId, pedidaEm: iso(x.recuperacaoPedidaEm) }))
  }

  // ---------- Conselho de Curso e classificação final ----------

  async conselho(turmaId) {
    const c = await this.prisma.conselhoCurso.findUnique({ where: { turmaId } })
    if (!c) return { turmaId, estado: 'aberto', acta: '', dataConselho: null, propostaPor: '', propostaEm: null, confirmadaPor: '', confirmadaEm: null, homologadaPor: '', homologadaEm: null, observacoes: '' }
    return { ...c, propostaEm: iso(c.propostaEm), confirmadaEm: iso(c.confirmadaEm), homologadaEm: iso(c.homologadaEm) }
  }

  async guardarConselho(turmaId, dados) {
    await this.prisma.conselhoCurso.upsert({ where: { turmaId }, create: { turmaId, ...dados }, update: dados })
    return this.conselho(turmaId)
  }

  // { estudanteId: { juizo, ajuste, distinto, fixado } }
  async classificacoes(turmaId) {
    const l = await this.prisma.classificacaoCurso.findMany({ where: { turmaId } })
    return Object.fromEntries(l.map((c) => [c.estudanteId, { juizo: c.juizo ?? {}, ajuste: Number(c.ajuste ?? 0), distinto: c.distinto, fixado: c.fixado ?? null }]))
  }

  async guardarClassificacao(turmaId, estudanteId, dados) {
    await this.prisma.classificacaoCurso.upsert({ where: { turmaId_estudanteId: { turmaId, estudanteId } }, create: { turmaId, estudanteId, ...dados }, update: dados })
  }
}

