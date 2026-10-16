const iso = (d) => (d ? new Date(d).toISOString() : null)
const num = (d) => (d === null || d === undefined ? null : Number(d))
const autor = { select: { id: true, nome: true, tipo: true } }
const ANEXOS = { include: { ficheiro: { select: { id: true, nome: true, tipo: true, tamanho: true } } } }
const paraAnexo = (a) => ({ id: a.ficheiro.id, nome: a.ficheiro.nome, tipo: a.ficheiro.tipo, tamanho: a.ficheiro.tamanho })

// o que o certificado mostra: estudante, cadeira e turma
const INCLUIR_CERTIFICADO = { estudante: { select: { nome: true, numero: true } }, cadeira: { select: { nome: true, codigo: true, horas: true, turma: { select: { nome: true, anoLetivo: true } } } } }

/*
  Recursos de cada cadeira ao estilo do Moodle: fórum, calendário académico,
  conclusão de materiais (progresso) e questionários online.
*/
export class RepositorioRecursosCadeira {
  constructor({ prisma }) {
    this.prisma = prisma
  }

  // ---------- fórum ----------

  async topicos(cadeiraId, { q } = {}) {
    const termo = q ? { contains: q.replace(/[\\%_]/g, (c) => `\\${c}`), mode: 'insensitive' } : null
    const linhas = await this.prisma.forumTopico.findMany({
      where: { cadeiraId, ...(termo ? { OR: [{ titulo: termo }, { texto: termo }, { respostas: { some: { texto: termo } } }] } : {}) },
      orderBy: [{ fixado: 'desc' }, { atividadeEm: 'desc' }],
      include: { autor, _count: { select: { respostas: true, anexos: true } } },
    })
    return linhas.map((t) => ({ ...this.#topico(t), respostas: t._count.respostas, anexos: t._count.anexos }))
  }

  #topico(t) {
    return {
      id: t.id, cadeiraId: t.cadeiraId, titulo: t.titulo, texto: t.texto, fixado: t.fixado, fechado: t.fechado,
      tipo: t.tipo, respostaCertaId: t.respostaCertaId, editadoEm: iso(t.editadoEm),
      autor: t.autor, criadoEm: iso(t.criadoEm), atividadeEm: iso(t.atividadeEm),
    }
  }

  async topico(id) {
    const n = Number(id)
    if (!Number.isSafeInteger(n) || n < 1) return null
    const t = await this.prisma.forumTopico.findUnique({
      where: { id: n },
      include: { autor, anexos: ANEXOS, respostas: { orderBy: { criadoEm: 'asc' }, include: { autor, anexos: ANEXOS } } },
    })
    return t && {
      ...this.#topico(t), anexos: t.anexos.map(paraAnexo),
      respostas: t.respostas.map((r) => ({ id: r.id, texto: r.texto, autor: r.autor, criadoEm: iso(r.criadoEm), editadoEm: iso(r.editadoEm), anexos: r.anexos.map(paraAnexo) })),
    }
  }

  criarTopico(dados, anexos = []) {
    return this.prisma.forumTopico.create({ data: { ...dados, anexos: { create: anexos.map((ficheiroId) => ({ ficheiroId })) } } })
  }

  atualizarTopico(id, dados) {
    return this.prisma.forumTopico.update({ where: { id }, data: dados })
  }

  apagarTopico(id) {
    return this.prisma.forumTopico.delete({ where: { id } })
  }

  async responder({ topicoId, autorId, texto, criadoEm = new Date() }, anexos = []) {
    const [r] = await this.prisma.$transaction([
      this.prisma.forumResposta.create({ data: { topicoId, autorId, texto, criadoEm, anexos: { create: anexos.map((ficheiroId) => ({ ficheiroId })) } } }),
      this.prisma.forumTopico.update({ where: { id: topicoId }, data: { atividadeEm: criadoEm } }),
    ])
    return r
  }

  async resposta(id) {
    const n = Number(id)
    if (!Number.isSafeInteger(n) || n < 1) return null
    return this.prisma.forumResposta.findUnique({ where: { id: n }, include: { topico: { select: { id: true, cadeiraId: true, respostaCertaId: true } } } })
  }

  editarResposta(id, texto) {
    return this.prisma.forumResposta.update({ where: { id }, data: { texto, editadoEm: new Date() } })
  }

  async apagarResposta(id) {
    await this.prisma.$transaction([
      this.prisma.forumTopico.updateMany({ where: { respostaCertaId: id }, data: { respostaCertaId: null } }),
      this.prisma.forumResposta.delete({ where: { id } }),
    ])
  }

  // ---------- subscrições do fórum ----------

  async subscricaoTopico(topicoId, contaId) {
    return (await this.prisma.subscricaoTopico.findUnique({ where: { topicoId_contaId: { topicoId, contaId } } }))?.ativa ?? null
  }

  definirSubscricaoTopico(topicoId, contaId, ativa) {
    return this.prisma.subscricaoTopico.upsert({ where: { topicoId_contaId: { topicoId, contaId } }, create: { topicoId, contaId, ativa }, update: { ativa } })
  }

  async subscricoesDoTopico(topicoId) {
    const l = await this.prisma.subscricaoTopico.findMany({ where: { topicoId } })
    return { ativas: l.filter((x) => x.ativa).map((x) => x.contaId), inativas: l.filter((x) => !x.ativa).map((x) => x.contaId) }
  }

  async subscritoForum(cadeiraId, contaId) {
    return Boolean(await this.prisma.subscricaoForum.findUnique({ where: { cadeiraId_contaId: { cadeiraId, contaId } } }))
  }

  async definirSubscricaoForum(cadeiraId, contaId, ativa) {
    if (ativa) await this.prisma.subscricaoForum.upsert({ where: { cadeiraId_contaId: { cadeiraId, contaId } }, create: { cadeiraId, contaId }, update: {} })
    else await this.prisma.subscricaoForum.deleteMany({ where: { cadeiraId, contaId } })
  }

  async subscritoresDoForum(cadeiraId) {
    return (await this.prisma.subscricaoForum.findMany({ where: { cadeiraId }, select: { contaId: true } })).map((x) => x.contaId)
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

  // ---------- lições (o caminho de cada estudante) ----------

  #progressoLicao(p) {
    return p && { materialId: p.materialId, estudanteId: p.estudanteId, pagina: p.pagina, respostas: p.respostas || {}, visitas: p.visitas, concluida: p.concluida, nota: num(p.nota), melhorNota: num(p.melhorNota), atualizadaEm: iso(p.atualizadaEm), ...(p.estudante ? { estudante: p.estudante } : {}) }
  }

  async progressoLicao(materialId, estudanteId) {
    return this.#progressoLicao(await this.prisma.progressoLicao.findUnique({ where: { materialId_estudanteId: { materialId, estudanteId } } }))
  }

  async guardarProgressoLicao(materialId, estudanteId, dados) {
    return this.#progressoLicao(await this.prisma.progressoLicao.upsert({ where: { materialId_estudanteId: { materialId, estudanteId } }, create: { materialId, estudanteId, ...dados }, update: dados }))
  }

  async progressosLicao(materialId) {
    const linhas = await this.prisma.progressoLicao.findMany({ where: { materialId }, include: { estudante: { select: { id: true, nome: true, numero: true } } }, orderBy: { id: 'asc' } })
    return linhas.map((p) => this.#progressoLicao(p))
  }

  // ---------- questionários ----------

  // a palavra-passe só sai na leitura de um questionário (para o docente e para a verificação); as listas dizem só se pede
  #questionario(q, { comSenha = false } = {}) {
    return q && {
      id: q.id, cadeiraId: q.cadeiraId, titulo: q.titulo, descricao: q.descricao, abre: iso(q.abre), fecha: iso(q.fecha),
      duracao: q.duracao, tentativas: q.tentativas, publicado: q.publicado, mostrarRespostas: q.mostrarRespostas, secaoId: q.secaoId, criadoEm: iso(q.criadoEm),
      baralhar: q.baralhar, perguntasPorTentativa: q.perguntasPorTentativa,
      ...(comSenha ? { senha: q.senha || '' } : {}), pedeSenha: Boolean(q.senha), porPagina: q.porPagina || 0, sequencial: Boolean(q.sequencial), comentarios: q.comentarios || [],
      visivel: q.visivel, disponivelDe: iso(q.disponivelDe), requisitos: q.requisitos || [],
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
    return this.#questionario(await this.prisma.questionario.findUnique({ where: { id: Number(id) }, include: { perguntas: { orderBy: [{ ordem: 'asc' }, { id: 'asc' }] } } }), { comSenha: true })
  }

  async criarQuestionario(dados) {
    return this.#questionario(await this.prisma.questionario.create({ data: dados }), { comSenha: true })
  }

  async atualizarQuestionario(id, dados) {
    return this.#questionario(await this.prisma.questionario.update({ where: { id }, data: dados }), { comSenha: true })
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
      ordem: t.ordem || [], permutacoes: t.permutacoes || {}, manuais: t.manuais || {}, porCorrigir: t.porCorrigir, comentario: t.comentario, pagina: t.pagina || 0,
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

  // navegação sequencial: só avança se ainda estiver na página esperada (duas janelas não saltam páginas)
  async avancarPagina(id, de, para) {
    const r = await this.prisma.tentativa.updateMany({ where: { id, pagina: de, entregueEm: null }, data: { pagina: para } })
    return r.count === 1
  }

  // ---------- exceções de estudantes nos questionários ----------

  #excecao(e) {
    return e && { id: e.id, questionarioId: e.questionarioId, estudanteId: e.estudanteId, fecha: iso(e.fecha), duracao: e.duracao, tentativas: e.tentativas, motivo: e.motivo, ...(e.estudante ? { estudante: e.estudante } : {}) }
  }

  async excecoes(questionarioId) {
    const linhas = await this.prisma.excecaoQuestionario.findMany({ where: { questionarioId }, include: { estudante: { select: { id: true, nome: true, numero: true } } }, orderBy: { id: 'asc' } })
    return linhas.map((e) => this.#excecao(e))
  }

  async excecao(questionarioId, estudanteId) {
    return this.#excecao(await this.prisma.excecaoQuestionario.findUnique({ where: { questionarioId_estudanteId: { questionarioId, estudanteId } } }))
  }

  // { questionarioId: exceção } de um estudante (para a lista e o progresso)
  async excecoesDoEstudante(estudanteId, questionarioIds) {
    const linhas = await this.prisma.excecaoQuestionario.findMany({ where: { estudanteId, questionarioId: { in: questionarioIds } } })
    return Object.fromEntries(linhas.map((e) => [e.questionarioId, this.#excecao(e)]))
  }

  async guardarExcecao(dados) {
    const { questionarioId, estudanteId, ...resto } = dados
    return this.#excecao(await this.prisma.excecaoQuestionario.upsert({ where: { questionarioId_estudanteId: { questionarioId, estudanteId } }, create: dados, update: resto }))
  }

  apagarExcecao(questionarioId, estudanteId) {
    return this.prisma.excecaoQuestionario.deleteMany({ where: { questionarioId, estudanteId } })
  }

  // só fecha se ainda estiver aberta (duas entregas ao mesmo tempo não contam duas vezes)
  async entregarTentativa(id, { respostas, nota, entregueEm, porCorrigir = false }) {
    const r = await this.prisma.tentativa.updateMany({ where: { id, entregueEm: null }, data: { respostas, nota, entregueEm, porCorrigir } })
    return r.count === 1
  }

  // correção manual (dissertações): pontos, nota recalculada e comentário
  async corrigirTentativa(id, { manuais, nota, porCorrigir, comentario }) {
    return this.#tentativa(await this.prisma.tentativa.update({ where: { id }, data: { manuais, nota, porCorrigir, comentario } }))
  }

  // ---------- certificados ----------

  #certificado(c) {
    return c && {
      codigo: c.codigo, emitidoEm: iso(c.emitidoEm),
      ...(c.estudante ? { estudante: c.estudante.nome, numero: c.estudante.numero } : {}),
      ...(c.cadeira ? { cadeira: c.cadeira.nome, codigoCadeira: c.cadeira.codigo, horas: c.cadeira.horas, turma: c.cadeira.turma?.nome, anoLetivo: c.cadeira.turma?.anoLetivo } : {}),
    }
  }

  async certificadoDe(estudanteId, cadeiraId) {
    return this.#certificado(await this.prisma.certificado.findUnique({ where: { estudanteId_cadeiraId: { estudanteId, cadeiraId } }, include: INCLUIR_CERTIFICADO }))
  }

  async emitirCertificado(dados) {
    return this.#certificado(await this.prisma.certificado.upsert({
      where: { estudanteId_cadeiraId: { estudanteId: dados.estudanteId, cadeiraId: dados.cadeiraId } }, create: dados, update: {}, include: INCLUIR_CERTIFICADO,
    }))
  }

  async certificado(codigo) {
    if (!/^[A-Z0-9]{8,16}$/.test(codigo)) return null
    return this.#certificado(await this.prisma.certificado.findUnique({
      where: { codigo },
      include: INCLUIR_CERTIFICADO,
    }))
  }

  // ---------- banco de perguntas do docente ----------

  #doBanco(p) {
    return p && { id: p.id, docenteId: p.docenteId, categoria: p.categoria, tipo: p.tipo, enunciado: p.enunciado, opcoes: p.opcoes, pontos: num(p.pontos), criadaEm: iso(p.criadaEm) }
  }

  async banco(docenteId) {
    const linhas = await this.prisma.perguntaBanco.findMany({ where: { docenteId }, orderBy: [{ categoria: 'asc' }, { id: 'desc' }], take: 2000 })
    return linhas.map((p) => this.#doBanco(p))
  }

  async perguntaDoBanco(id) {
    const n = Number(id)
    return Number.isSafeInteger(n) && n > 0 ? this.#doBanco(await this.prisma.perguntaBanco.findUnique({ where: { id: n } })) : null
  }

  async guardarNoBanco(dados) {
    return this.#doBanco(await this.prisma.perguntaBanco.create({ data: dados }))
  }

  apagarDoBanco(id) {
    return this.prisma.perguntaBanco.delete({ where: { id } })
  }
}
