const iso = (d) => (d ? new Date(d).toISOString() : null)
const num = (d) => (d === null || d === undefined ? null : Number(d))
const autor = { select: { id: true, nome: true, tipo: true } }

/*
  Recursos de cada cadeira ao estilo do Moodle: fórum, calendário académico,
  conclusão de materiais (progresso) e questionários online.
*/
export class RepositorioRecursosCadeira {
  constructor({ prisma }) {
    this.prisma = prisma
  }

  // ---------- fórum ----------

  async topicos(cadeiraId) {
    const linhas = await this.prisma.forumTopico.findMany({
      where: { cadeiraId },
      orderBy: [{ fixado: 'desc' }, { atividadeEm: 'desc' }],
      include: { autor, _count: { select: { respostas: true } } },
    })
    return linhas.map((t) => ({ ...this.#topico(t), respostas: t._count.respostas }))
  }

  #topico(t) {
    return {
      id: t.id, cadeiraId: t.cadeiraId, titulo: t.titulo, texto: t.texto, fixado: t.fixado, fechado: t.fechado,
      autor: t.autor, criadoEm: iso(t.criadoEm), atividadeEm: iso(t.atividadeEm),
    }
  }

  async topico(id) {
    const t = await this.prisma.forumTopico.findUnique({
      where: { id: Number(id) },
      include: { autor, respostas: { orderBy: { criadoEm: 'asc' }, include: { autor } } },
    })
    return t && { ...this.#topico(t), respostas: t.respostas.map((r) => ({ id: r.id, texto: r.texto, autor: r.autor, criadoEm: iso(r.criadoEm) })) }
  }

  criarTopico(dados) {
    return this.prisma.forumTopico.create({ data: dados })
  }

  atualizarTopico(id, dados) {
    return this.prisma.forumTopico.update({ where: { id }, data: dados })
  }

  apagarTopico(id) {
    return this.prisma.forumTopico.delete({ where: { id } })
  }

  async responder({ topicoId, autorId, texto }) {
    const [r] = await this.prisma.$transaction([
      this.prisma.forumResposta.create({ data: { topicoId, autorId, texto } }),
      this.prisma.forumTopico.update({ where: { id: topicoId }, data: { atividadeEm: new Date() } }),
    ])
    return r
  }

  resposta(id) {
    return this.prisma.forumResposta.findUnique({ where: { id: Number(id) }, include: { topico: { select: { cadeiraId: true } } } })
  }

  apagarResposta(id) {
    return this.prisma.forumResposta.delete({ where: { id } })
  }

  // ---------- calendário ----------

  // eventos das cadeiras e das turmas indicadas, e os gerais (sem turma nem cadeira)
  eventos({ cadeiraIds = [], turmaIds = [], de, ate, gerais = true }) {
    return this.prisma.eventoAcademico.findMany({
      where: {
        data: { gte: de, lte: ate },
        OR: [
          { cadeiraId: { in: cadeiraIds } },
          { turmaId: { in: turmaIds }, cadeiraId: null },
          ...(gerais ? [{ turmaId: null, cadeiraId: null }] : []),
        ],
      },
      include: { cadeira: { select: { nome: true, codigo: true } }, turma: { select: { nome: true } } },
      orderBy: [{ data: 'asc' }, { inicio: 'asc' }],
    })
  }

  eventosDaCadeira(cadeiraId) {
    return this.prisma.eventoAcademico.findMany({ where: { cadeiraId }, orderBy: [{ data: 'asc' }, { inicio: 'asc' }] })
  }

  todosEventosGerais() {
    return this.prisma.eventoAcademico.findMany({ where: { cadeiraId: null }, include: { turma: { select: { nome: true } } }, orderBy: [{ data: 'desc' }], take: 300 })
  }

  evento(id) {
    return this.prisma.eventoAcademico.findUnique({ where: { id: Number(id) } })
  }

  criarEvento(dados) {
    return this.prisma.eventoAcademico.create({ data: dados })
  }

  apagarEvento(id) {
    return this.prisma.eventoAcademico.delete({ where: { id } })
  }

  // ---------- progresso (conclusão de materiais) ----------

  async conclusoesDoEstudante(estudanteId, materialIds) {
    const linhas = await this.prisma.conclusao.findMany({ where: { estudanteId, materialId: { in: materialIds } }, select: { materialId: true } })
    return new Set(linhas.map((l) => l.materialId))
  }

  // { estudanteId: Set(materialId) } para o relatório do docente
  async conclusoesDaCadeira(cadeiraId) {
    const linhas = await this.prisma.conclusao.findMany({ where: { material: { cadeiraId } }, select: { materialId: true, estudanteId: true } })
    const mapa = {}
    for (const l of linhas) (mapa[l.estudanteId] ||= new Set()).add(l.materialId)
    return mapa
  }

  async marcarConclusao(materialId, estudanteId, concluido) {
    if (concluido) {
      await this.prisma.conclusao.upsert({ where: { materialId_estudanteId: { materialId, estudanteId } }, create: { materialId, estudanteId }, update: {} })
    } else {
      await this.prisma.conclusao.deleteMany({ where: { materialId, estudanteId } })
    }
  }

  // ---------- questionários ----------

  #questionario(q) {
    return q && {
      id: q.id, cadeiraId: q.cadeiraId, titulo: q.titulo, descricao: q.descricao, abre: iso(q.abre), fecha: iso(q.fecha),
      duracao: q.duracao, tentativas: q.tentativas, publicado: q.publicado, mostrarRespostas: q.mostrarRespostas, secaoId: q.secaoId, criadoEm: iso(q.criadoEm),
      ...(q.perguntas ? { perguntas: q.perguntas.map((p) => ({ id: p.id, ordem: p.ordem, enunciado: p.enunciado, tipo: p.tipo, opcoes: p.opcoes, pontos: num(p.pontos) })) } : {}),
      ...(q._count ? { numeroPerguntas: q._count.perguntas } : {}),
    }
  }

  async questionarios(cadeiraId, { soPublicados = false } = {}) {
    const linhas = await this.prisma.questionario.findMany({
      where: { cadeiraId, ...(soPublicados ? { publicado: true } : {}) },
      orderBy: [{ fecha: 'asc' }, { id: 'asc' }],
      include: { _count: { select: { perguntas: true } } },
    })
    return linhas.map((q) => this.#questionario(q))
  }

  async questionario(id) {
    return this.#questionario(await this.prisma.questionario.findUnique({ where: { id: Number(id) }, include: { perguntas: { orderBy: [{ ordem: 'asc' }, { id: 'asc' }] } } }))
  }

  async criarQuestionario(dados) {
    return this.#questionario(await this.prisma.questionario.create({ data: dados }))
  }

  async atualizarQuestionario(id, dados) {
    return this.#questionario(await this.prisma.questionario.update({ where: { id }, data: dados }))
  }

  apagarQuestionario(id) {
    return this.prisma.questionario.delete({ where: { id } })
  }

  async criarPergunta(questionarioId, dados) {
    const ultima = await this.prisma.pergunta.aggregate({ where: { questionarioId }, _max: { ordem: true } })
    return this.prisma.pergunta.create({ data: { questionarioId, ordem: (ultima._max.ordem ?? 0) + 1, ...dados } })
  }

  pergunta(id) {
    return this.prisma.pergunta.findUnique({ where: { id: Number(id) } })
  }

  atualizarPergunta(id, dados) {
    return this.prisma.pergunta.update({ where: { id }, data: dados })
  }

  apagarPergunta(id) {
    return this.prisma.pergunta.delete({ where: { id } })
  }

  #tentativa(t) {
    return t && {
      id: t.id, questionarioId: t.questionarioId, estudanteId: t.estudanteId, numero: t.numero,
      iniciadaEm: iso(t.iniciadaEm), limite: iso(t.limite), entregueEm: iso(t.entregueEm), respostas: t.respostas || {}, nota: num(t.nota),
      ...(t.estudante ? { estudante: t.estudante } : {}),
    }
  }

  async tentativas(questionarioId, estudanteId) {
    const linhas = await this.prisma.tentativa.findMany({ where: { questionarioId, ...(estudanteId ? { estudanteId } : {}) }, orderBy: [{ estudanteId: 'asc' }, { numero: 'asc' }], include: estudanteId ? undefined : { estudante: { select: { id: true, nome: true, numero: true } } } })
    return linhas.map((t) => this.#tentativa(t))
  }

  // tentativas de um estudante em vários questionários (para o progresso)
  async tentativasDoEstudante(estudanteId, questionarioIds) {
    const linhas = await this.prisma.tentativa.findMany({ where: { estudanteId, questionarioId: { in: questionarioIds } } })
    return linhas.map((t) => this.#tentativa(t))
  }

  async tentativa(id) {
    return this.#tentativa(await this.prisma.tentativa.findUnique({ where: { id: Number(id) } }))
  }

  async iniciarTentativa(dados) {
    return this.#tentativa(await this.prisma.tentativa.create({ data: dados }))
  }

  async guardarRespostas(id, respostas) {
    return this.#tentativa(await this.prisma.tentativa.update({ where: { id }, data: { respostas } }))
  }

  // só fecha se ainda estiver aberta (duas entregas ao mesmo tempo não contam duas vezes)
  async entregarTentativa(id, { respostas, nota, entregueEm }) {
    const r = await this.prisma.tentativa.updateMany({ where: { id, entregueEm: null }, data: { respostas, nota, entregueEm } })
    return r.count === 1
  }
}
