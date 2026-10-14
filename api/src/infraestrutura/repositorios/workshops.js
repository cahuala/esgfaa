const iso = (d) => (d ? new Date(d).toISOString() : null)
const num = (d) => (d === null || d === undefined ? null : Number(d))
const ficheiro = { select: { id: true, nome: true, tipo: true, tamanho: true } }
const conta = { select: { id: true, nome: true, numero: true } }

const paraWorkshop = (w) => w && {
  id: w.id, cadeiraId: w.cadeiraId, secaoId: w.secaoId, titulo: w.titulo, enunciado: w.enunciado, grelha: w.grelha,
  fimSubmissao: iso(w.fimSubmissao), fimAvaliacao: iso(w.fimAvaliacao), avaliacoesPorPar: w.avaliacoesPorPar, anonimo: w.anonimo,
  distribuidoEm: iso(w.distribuidoEm), visivel: w.visivel, disponivelDe: iso(w.disponivelDe), requisitos: w.requisitos, criadoEm: iso(w.criadoEm),
  ...(w._count ? { submissoes: w._count.submissoes } : {}),
}
const paraAvaliacao = (a) => ({
  id: a.id, submissaoId: a.submissaoId, avaliadorId: a.avaliadorId, pontos: a.pontos, comentario: a.comentario,
  nota: num(a.nota), feitaEm: iso(a.feitaEm), ...(a.avaliador ? { avaliador: a.avaliador } : {}),
})
const paraSubmissao = (s) => s && {
  id: s.id, workshopId: s.workshopId, estudanteId: s.estudanteId, texto: s.texto, ficheiro: s.ficheiro || null,
  entregueEm: iso(s.entregueEm), notaFinal: num(s.notaFinal), comentario: s.comentario,
  ...(s.estudante ? { estudante: s.estudante } : {}),
  ...(s.avaliacoes ? { avaliacoes: s.avaliacoes.map(paraAvaliacao) } : {}),
}

// avaliação por pares: workshops, submissões e avaliações
export class RepositorioWorkshops {
  constructor({ prisma }) {
    this.prisma = prisma
  }

  async workshops(cadeiraId) {
    const l = await this.prisma.workshop.findMany({ where: { cadeiraId }, orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }], include: { _count: { select: { submissoes: true } } } })
    return l.map(paraWorkshop)
  }

  async workshop(id) {
    const n = Number(id)
    if (!Number.isSafeInteger(n) || n < 1) return null
    return paraWorkshop(await this.prisma.workshop.findUnique({ where: { id: n }, include: { _count: { select: { submissoes: true } } } }))
  }

  async criar(dados) {
    return paraWorkshop(await this.prisma.workshop.create({ data: dados }))
  }

  async atualizar(id, dados) {
    return paraWorkshop(await this.prisma.workshop.update({ where: { id }, data: dados }))
  }

  apagar(id) {
    return this.prisma.workshop.delete({ where: { id } })
  }

  // todas as submissões com as avaliações (docente, notas)
  async submissoes(workshopId) {
    const l = await this.prisma.submissaoWorkshop.findMany({
      where: { workshopId }, orderBy: { entregueEm: 'asc' },
      include: { estudante: conta, ficheiro, avaliacoes: { include: { avaliador: conta }, orderBy: { id: 'asc' } } },
    })
    return l.map(paraSubmissao)
  }

  async submissao(id) {
    const n = Number(id)
    if (!Number.isSafeInteger(n) || n < 1) return null
    return paraSubmissao(await this.prisma.submissaoWorkshop.findUnique({ where: { id: n }, include: { ficheiro, avaliacoes: true } }))
  }

  async submissaoDe(workshopId, estudanteId) {
    return paraSubmissao(await this.prisma.submissaoWorkshop.findUnique({ where: { workshopId_estudanteId: { workshopId, estudanteId } }, include: { ficheiro, avaliacoes: true } }))
  }

  async submeter({ workshopId, estudanteId, texto, ficheiroId, entregueEm }) {
    const manterFicheiro = ficheiroId === undefined
    return paraSubmissao(await this.prisma.submissaoWorkshop.upsert({
      where: { workshopId_estudanteId: { workshopId, estudanteId } },
      create: { workshopId, estudanteId, texto, ficheiroId: ficheiroId ?? null, entregueEm },
      update: { texto, entregueEm, ...(manterFicheiro ? {} : { ficheiroId }) },
      include: { ficheiro },
    }))
  }

  avaliarSubmissao(id, dados) {
    return this.prisma.submissaoWorkshop.update({ where: { id }, data: dados })
  }

  // cria as avaliações por fazer e marca o workshop como distribuído (uma só vez)
  async distribuir(workshopId, pares, quando) {
    return this.prisma.$transaction(async (tx) => {
      const w = await tx.workshop.updateMany({ where: { id: workshopId, distribuidoEm: null }, data: { distribuidoEm: quando } })
      if (!w.count) return false
      if (pares.length) await tx.avaliacaoPar.createMany({ data: pares, skipDuplicates: true })
      return true
    })
  }

  // avaliações atribuídas a um estudante, com o trabalho a avaliar
  async avaliacoesDe(workshopId, avaliadorId) {
    const l = await this.prisma.avaliacaoPar.findMany({
      where: { avaliadorId, submissao: { workshopId } }, orderBy: { id: 'asc' },
      include: { submissao: { include: { ficheiro, estudante: conta } } },
    })
    return l.map((a) => ({ ...paraAvaliacao(a), submissao: paraSubmissao(a.submissao) }))
  }

  async avaliacao(id) {
    const n = Number(id)
    if (!Number.isSafeInteger(n) || n < 1) return null
    const a = await this.prisma.avaliacaoPar.findUnique({ where: { id: n }, include: { submissao: { select: { workshopId: true, estudanteId: true } } } })
    return a && { ...paraAvaliacao(a), workshopId: a.submissao.workshopId, autorId: a.submissao.estudanteId }
  }

  async gravarAvaliacao(id, dados) {
    return paraAvaliacao(await this.prisma.avaliacaoPar.update({ where: { id }, data: dados }))
  }

  // estudantes que entregaram, e quem pode ver o ficheiro de uma submissão
  async ficheiroDeSubmissao(ficheiroId) {
    const s = await this.prisma.submissaoWorkshop.findFirst({ where: { ficheiroId }, include: { workshop: { select: { cadeiraId: true } }, avaliacoes: { select: { avaliadorId: true } } } })
    return s && { cadeiraId: s.workshop.cadeiraId, estudantes: [s.estudanteId, ...s.avaliacoes.map((a) => a.avaliadorId)] }
  }

  // ids das submissões de um estudante em vários workshops: { workshopId: { feita, nota } }
  async estadoDoEstudante(estudanteId, workshopIds) {
    if (!workshopIds.length) return {}
    const l = await this.prisma.submissaoWorkshop.findMany({ where: { estudanteId, workshopId: { in: workshopIds } }, include: { avaliacoes: true } })
    return Object.fromEntries(l.map((s) => [s.workshopId, s]))
  }
}
