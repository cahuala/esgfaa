const iso = (d) => (d ? new Date(d).toISOString() : null)

// sondagens e inquéritos de avaliação do docente
export class RepositorioInqueritos {
  constructor({ prisma }) {
    this.prisma = prisma
  }

  #inquerito(i) {
    if (!i) return null
    return {
      id: i.id, cadeiraId: i.cadeiraId, secaoId: i.secaoId, tipo: i.tipo, titulo: i.titulo, descricao: i.descricao,
      perguntas: i.perguntas, anonimo: i.anonimo, mostrarResultados: i.resultados, fecha: iso(i.fecha),
      docenteId: i.docenteId, docente: i.docente ? i.docente.nome : null,
      visivel: i.visivel, disponivelDe: iso(i.disponivelDe), requisitos: i.requisitos, criadoEm: iso(i.criadoEm),
      ...(i._count ? { respostas: i._count.participacoes } : {}),
    }
  }

  async inqueritos(cadeiraId) {
    const linhas = await this.prisma.inquerito.findMany({
      where: { cadeiraId }, orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }],
      include: { docente: { select: { nome: true } }, _count: { select: { participacoes: true } } },
    })
    return linhas.map((i) => this.#inquerito(i))
  }

  async inquerito(id) {
    const n = Number(id)
    if (!Number.isSafeInteger(n) || n < 1) return null
    return this.#inquerito(await this.prisma.inquerito.findUnique({
      where: { id: n }, include: { docente: { select: { nome: true } }, _count: { select: { participacoes: true } } },
    }))
  }

  async criar(dados) {
    return this.#inquerito(await this.prisma.inquerito.create({ data: dados }))
  }

  async atualizar(id, dados) {
    return this.#inquerito(await this.prisma.inquerito.update({ where: { id }, data: dados }))
  }

  apagar(id) {
    return this.prisma.inquerito.delete({ where: { id } })
  }

  // avaliações já lançadas numa cadeira para um docente
  existeAvaliacao(cadeiraId, docenteId) {
    return this.prisma.inquerito.count({ where: { cadeiraId, docenteId, tipo: 'avaliacao' } }).then((n) => n > 0)
  }

  async avaliacoesDaTurma(turmaId) {
    const linhas = await this.prisma.inquerito.findMany({
      where: { tipo: 'avaliacao', cadeira: { turmaId } }, orderBy: [{ cadeiraId: 'asc' }, { id: 'asc' }],
      include: { docente: { select: { nome: true } }, cadeira: { select: { codigo: true, nome: true } }, _count: { select: { participacoes: true } } },
    })
    return linhas.map((i) => ({ ...this.#inquerito(i), cadeira: i.cadeira }))
  }

  // ids dos inquéritos (de uma lista) a que o estudante já respondeu
  async respondidos(estudanteId, ids) {
    if (!ids.length) return new Set()
    const l = await this.prisma.participacaoInquerito.findMany({ where: { estudanteId, inqueritoId: { in: ids } }, select: { inqueritoId: true } })
    return new Set(l.map((x) => x.inqueritoId))
  }

  // a resposta do próprio estudante (só existe nos inquéritos não anónimos)
  async respostaDe(inqueritoId, estudanteId) {
    const r = await this.prisma.respostaInquerito.findFirst({ where: { inqueritoId, estudanteId } })
    return r ? r.respostas : null
  }

  async respostas(inqueritoId) {
    const l = await this.prisma.respostaInquerito.findMany({ where: { inqueritoId }, select: { respostas: true } })
    return l.map((r) => r.respostas)
  }

  // grava a resposta; anónima = sem ligação ao estudante (a participação fica à parte)
  async responder(inquerito, estudanteId, respostas) {
    return this.prisma.$transaction(async (tx) => {
      if (inquerito.anonimo) {
        // só o dia: a hora permitiria cruzar a participação com a resposta
        const dia = new Date(new Date().toISOString().slice(0, 10))
        await tx.participacaoInquerito.create({ data: { inqueritoId: inquerito.id, estudanteId, em: dia } })
        await tx.respostaInquerito.create({ data: { inqueritoId: inquerito.id, estudanteId: null, respostas, criadaEm: dia } })
        return
      }
      await tx.participacaoInquerito.upsert({ where: { inqueritoId_estudanteId: { inqueritoId: inquerito.id, estudanteId } }, create: { inqueritoId: inquerito.id, estudanteId }, update: {} })
      const atual = await tx.respostaInquerito.findFirst({ where: { inqueritoId: inquerito.id, estudanteId } })
      if (atual) await tx.respostaInquerito.update({ where: { id: atual.id }, data: { respostas, criadaEm: new Date() } })
      else await tx.respostaInquerito.create({ data: { inqueritoId: inquerito.id, estudanteId, respostas } })
    })
  }

  // quem respondeu a uma sondagem não anónima (o docente vê os nomes por opção)
  async respostasComEstudante(inqueritoId) {
    const l = await this.prisma.respostaInquerito.findMany({ where: { inqueritoId, estudanteId: { not: null } } })
    const contas = await this.prisma.contaPortal.findMany({ where: { id: { in: l.map((r) => r.estudanteId) } }, select: { id: true, nome: true } })
    const nomes = Object.fromEntries(contas.map((c) => [c.id, c.nome]))
    return l.map((r) => ({ estudante: nomes[r.estudanteId], respostas: r.respostas }))
  }
}
