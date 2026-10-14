import { Conflito } from '../../dominio/comum/erros.js'
import { eDuplicado } from '../bd/prisma.js'

const iso = (d) => (d ? new Date(d).toISOString() : null)
const num = (d) => (d === null || d === undefined ? null : Number(d))
const contaResumo = { select: { id: true, nome: true, numero: true, email: true } }

const ordemPapel = { regente: 0, assistente: 1 }

// cadeira com a turma e os docentes alocados (regente primeiro); "docente" é o regente
const cadeiraLinha = (c) => {
  if (!c) return c
  const docentes = (c.docentes || [])
    .map((d) => ({ id: d.docente.id, nome: d.docente.nome, email: d.docente.email, numero: d.docente.numero, papel: d.papel, horas: d.horas }))
    .sort((a, b) => ordemPapel[a.papel] - ordemPapel[b.papel] || a.nome.localeCompare(b.nome))
  const regente = docentes.find((d) => d.papel === 'regente') || null
  return {
    id: c.id, turmaId: c.turmaId, codigo: c.codigo, nome: c.nome, periodo: c.periodo, horas: c.horas, descricao: c.descricao,
    programa: c.programa ?? '', programaFicheiroId: c.programaFicheiroId ?? null,
    notasPublicadas: c.notasPublicadas ?? [],
    docentes, docente: regente,
    turma: c.turma ? { id: c.turma.id, nome: c.turma.nome, curso: c.turma.curso, anoLetivo: c.turma.anoLetivo, anoCurricular: c.turma.anoCurricular } : undefined,
  }
}
const comDocentes = { docentes: { include: { docente: contaResumo } }, turma: true }

const duplicado = (mensagem) => (erro) => {
  if (eDuplicado(erro)) throw new Conflito(mensagem)
  throw erro
}

// Acesso aos dados do portal académico (turmas, cadeiras, materiais, notas, trabalhos, …)
export class RepositorioAcademico {
  constructor({ prisma }) {
    this.prisma = prisma
  }

  // ---------- turmas e matrículas ----------

  async listarTurmas() {
    const linhas = await this.prisma.turma.findMany({
      orderBy: [{ anoLetivo: 'desc' }, { nome: 'asc' }],
      include: { _count: { select: { matriculas: { where: { estado: 'ativa' } }, cadeiras: true } } },
    })
    return linhas.map((t) => ({ id: t.id, curso: t.curso, anoLetivo: t.anoLetivo, anoCurricular: t.anoCurricular, nome: t.nome, ativa: t.ativa, estudantes: t._count.matriculas, cadeiras: t._count.cadeiras }))
  }

  turma(id) {
    return this.prisma.turma.findUnique({ where: { id: Number(id) } })
  }

  criarTurma(dados) {
    return this.prisma.turma.create({ data: dados }).catch(duplicado('Já existe uma turma com este nome neste curso e ano letivo.'))
  }

  atualizarTurma(id, dados) {
    return this.prisma.turma.update({ where: { id }, data: dados }).catch(duplicado('Já existe uma turma com este nome neste curso e ano letivo.'))
  }

  async matriculasDaTurma(turmaId) {
    const linhas = await this.prisma.matricula.findMany({ where: { turmaId }, include: { estudante: contaResumo }, orderBy: { estudante: { nome: 'asc' } } })
    return linhas.map((m) => ({ id: m.id, estado: m.estado, criadaEm: iso(m.criadaEm), estudante: m.estudante }))
  }

  async matriculasDoEstudante(estudanteId) {
    const linhas = await this.prisma.matricula.findMany({ where: { estudanteId }, include: { turma: true }, orderBy: { criadaEm: 'desc' } })
    return linhas.map((m) => ({ id: m.id, estado: m.estado, criadaEm: iso(m.criadaEm), turma: { id: m.turma.id, nome: m.turma.nome, curso: m.turma.curso, anoLetivo: m.turma.anoLetivo } }))
  }

  matricular(estudanteId, turmaId) {
    return this.prisma.matricula.create({ data: { estudanteId, turmaId } }).catch(duplicado('O estudante já está matriculado nesta turma.'))
  }

  matricula(id) {
    return this.prisma.matricula.findUnique({ where: { id: Number(id) } })
  }

  alterarMatricula(id, estado) {
    return this.prisma.matricula.update({ where: { id }, data: { estado } })
  }

  // turmas em que o estudante tem matrícula ativa
  async turmasAtivas(estudanteId) {
    const linhas = await this.prisma.matricula.findMany({ where: { estudanteId, estado: 'ativa' }, select: { turmaId: true } })
    return linhas.map((l) => l.turmaId)
  }

  // estudantes que entram na pauta: matrícula ativa ou já concluída (notas de anos anteriores)
  async estudantesDaPauta(turmaId) {
    const linhas = await this.prisma.matricula.findMany({
      where: { turmaId, estado: { in: ['ativa', 'concluida'] } },
      include: { estudante: contaResumo },
      orderBy: { estudante: { nome: 'asc' } },
    })
    return linhas.map((m) => m.estudante)
  }

  // matrículas de um estudante em todos os anos (percurso académico), da mais antiga para a mais recente
  async percursoDoEstudante(estudanteId) {
    const linhas = await this.prisma.matricula.findMany({
      where: { estudanteId, estado: { not: 'anulada' } },
      include: { turma: true },
      orderBy: [{ turma: { anoLetivo: 'asc' } }, { turma: { anoCurricular: 'asc' } }],
    })
    return linhas.map((m) => ({ id: m.id, estado: m.estado, turma: { id: m.turma.id, nome: m.turma.nome, curso: m.turma.curso, anoLetivo: m.turma.anoLetivo, anoCurricular: m.turma.anoCurricular } }))
  }

  async estudantesAtivosDaTurma(turmaId) {
    const linhas = await this.prisma.matricula.findMany({
      where: { turmaId, estado: 'ativa', estudante: { ativo: true } },
      include: { estudante: contaResumo },
      orderBy: { estudante: { nome: 'asc' } },
    })
    return linhas.map((m) => m.estudante)
  }

  // ---------- cadeiras ----------

  async cadeira(id) {
    const n = Number(id)
    if (!Number.isSafeInteger(n) || n < 1) return null
    return cadeiraLinha(await this.prisma.unidadeCurricular.findUnique({ where: { id: n }, include: comDocentes }))
  }

  async cadeirasDasTurmas(turmaIds) {
    const linhas = await this.prisma.unidadeCurricular.findMany({
      where: { turmaId: { in: turmaIds } }, include: comDocentes, orderBy: [{ periodo: 'asc' }, { nome: 'asc' }],
    })
    return linhas.map(cadeiraLinha)
  }

  // cadeiras onde o docente está alocado (regente ou assistente)
  async cadeirasDoDocente(docenteId) {
    const linhas = await this.prisma.unidadeCurricular.findMany({
      where: { docentes: { some: { docenteId } } }, include: comDocentes, orderBy: [{ turma: { anoLetivo: 'desc' } }, { nome: 'asc' }],
    })
    return linhas.map(cadeiraLinha)
  }

  // todas as cadeiras (para a alocação de docentes), das turmas ativas primeiro
  async todasCadeiras({ soAtivas = false } = {}) {
    const linhas = await this.prisma.unidadeCurricular.findMany({
      where: soAtivas ? { turma: { ativa: true } } : {}, include: comDocentes,
      orderBy: [{ turma: { anoLetivo: 'desc' } }, { turma: { nome: 'asc' } }, { periodo: 'asc' }, { nome: 'asc' }],
    })
    return linhas.map(cadeiraLinha)
  }

  // substitui a alocação de docentes de uma cadeira
  async definirDocentes(cadeiraId, docentes) {
    const p = this.prisma
    await p.$transaction([
      p.docencia.deleteMany({ where: { cadeiraId } }),
      p.docencia.createMany({ data: docentes.map((d) => ({ cadeiraId, ...d })) }),
    ])
  }

  criarCadeira(dados) {
    return this.prisma.unidadeCurricular.create({ data: dados }).catch(duplicado('Já existe uma cadeira com este código nesta turma.'))
  }

  atualizarCadeira(id, dados) {
    return this.prisma.unidadeCurricular.update({ where: { id }, data: dados }).catch(duplicado('Já existe uma cadeira com este código nesta turma.'))
  }

  apagarCadeira(id) {
    return this.prisma.unidadeCurricular.delete({ where: { id } })
  }

  // ---------- capítulos (secções) ----------

  secoes(cadeiraId) {
    return this.prisma.secaoCadeira.findMany({ where: { cadeiraId }, orderBy: [{ ordem: 'asc' }, { id: 'asc' }] })
  }

  secao(id) {
    const n = Number(id)
    return Number.isSafeInteger(n) && n > 0 ? this.prisma.secaoCadeira.findUnique({ where: { id: n } }) : null
  }

  async criarSecao(dados) {
    const ultima = await this.prisma.secaoCadeira.aggregate({ where: { cadeiraId: dados.cadeiraId }, _max: { ordem: true } })
    return this.prisma.secaoCadeira.create({ data: { ...dados, ordem: (ultima._max.ordem ?? 0) + 1 } })
  }

  atualizarSecao(id, dados) {
    return this.prisma.secaoCadeira.update({ where: { id }, data: dados })
  }

  // as atividades do capítulo apagado passam para a secção geral (onDelete: SetNull)
  apagarSecao(id) {
    return this.prisma.secaoCadeira.delete({ where: { id } })
  }

  async ordenarSecoes(cadeiraId, ids) {
    const p = this.prisma
    await p.$transaction(ids.map((id, i) => p.secaoCadeira.updateMany({ where: { id, cadeiraId }, data: { ordem: i + 1 } })))
  }

  // muda uma atividade (material, trabalho, questionário) de capítulo
  moverAtividade(tipo, id, secaoId) {
    const modelo = { material: this.prisma.material, trabalho: this.prisma.trabalho, questionario: this.prisma.questionario }[tipo]
    return modelo.update({ where: { id }, data: { secaoId } })
  }

  // ---------- materiais e avisos ----------

  async materiais(cadeiraId) {
    const linhas = await this.prisma.material.findMany({ where: { cadeiraId }, orderBy: [{ publicadoEm: 'asc' }, { id: 'asc' }] })
    return linhas.map((m) => ({ ...m, publicadoEm: iso(m.publicadoEm) }))
  }

  criarMaterial(dados) {
    return this.prisma.material.create({ data: dados })
  }

  material(id) {
    return this.prisma.material.findUnique({ where: { id: Number(id) } })
  }

  apagarMaterial(id) {
    return this.prisma.material.delete({ where: { id } })
  }

  async avisosDaCadeira(cadeiraId) {
    const linhas = await this.prisma.avisoCadeira.findMany({ where: { cadeiraId }, orderBy: { criadoEm: 'desc' } })
    return linhas.map((a) => ({ ...a, criadoEm: iso(a.criadoEm) }))
  }

  criarAvisoCadeira(dados) {
    return this.prisma.avisoCadeira.create({ data: dados })
  }

  avisoCadeira(id) {
    return this.prisma.avisoCadeira.findUnique({ where: { id: Number(id) } })
  }

  apagarAvisoCadeira(id) {
    return this.prisma.avisoCadeira.delete({ where: { id } })
  }

  // avisos recentes das cadeiras indicadas (página inicial do portal)
  async avisosRecentes(cadeiraIds, limite = 6) {
    const linhas = await this.prisma.avisoCadeira.findMany({
      where: { cadeiraId: { in: cadeiraIds } }, orderBy: { criadoEm: 'desc' }, take: limite, include: { cadeira: { select: { nome: true } } },
    })
    return linhas.map((a) => ({ id: a.id, cadeiraId: a.cadeiraId, cadeira: a.cadeira.nome, titulo: a.titulo, texto: a.texto, criadoEm: iso(a.criadoEm) }))
  }

  async avisosGerais(turmaIds) {
    const linhas = await this.prisma.avisoGeral.findMany({
      where: { OR: [{ turmaId: null }, ...(turmaIds ? [{ turmaId: { in: turmaIds } }] : [])] },
      orderBy: { criadoEm: 'desc' }, take: 50, include: { turma: { select: { nome: true } } },
    })
    return linhas.map((a) => ({ id: a.id, turmaId: a.turmaId, turma: a.turma?.nome || null, titulo: a.titulo, texto: a.texto, criadoEm: iso(a.criadoEm) }))
  }

  async todosAvisosGerais() {
    const linhas = await this.prisma.avisoGeral.findMany({ orderBy: { criadoEm: 'desc' }, take: 200, include: { turma: { select: { nome: true } } } })
    return linhas.map((a) => ({ id: a.id, turmaId: a.turmaId, turma: a.turma?.nome || null, titulo: a.titulo, texto: a.texto, criadoEm: iso(a.criadoEm) }))
  }

  criarAvisoGeral(dados) {
    return this.prisma.avisoGeral.create({ data: dados })
  }

  apagarAvisoGeral(id) {
    return this.prisma.avisoGeral.deleteMany({ where: { id: Number(id) } })
  }

  // ---------- pautas ----------

  #linhaPauta(n) {
    return { estudanteId: n.estudanteId, cadeiraId: n.cadeiraId, p1: num(n.p1), p2: num(n.p2), exame: num(n.exame), recurso: num(n.recurso), observacao: n.observacao }
  }

  // notas de uma cadeira: { [estudanteId]: { p1, p2, exame, recurso, observacao } }
  async pautaDaCadeira(cadeiraId) {
    const linhas = await this.prisma.notaPauta.findMany({ where: { cadeiraId } })
    return Object.fromEntries(linhas.map((n) => [n.estudanteId, this.#linhaPauta(n)]))
  }

  // notas de um estudante: { [cadeiraId]: { p1, p2, exame, recurso, observacao } }
  async notasDoEstudante(estudanteId, cadeiraIds) {
    const linhas = await this.prisma.notaPauta.findMany({ where: { estudanteId, cadeiraId: { in: cadeiraIds } } })
    return Object.fromEntries(linhas.map((n) => [n.cadeiraId, this.#linhaPauta(n)]))
  }

  // grava a pauta de uma cadeira de uma só vez (linha sem notas nem observação é apagada)
  async gravarPauta(cadeiraId, linhas) {
    const p = this.prisma
    await p.$transaction(linhas.map(({ estudanteId, ...notas }) => {
      const vazia = ['p1', 'p2', 'exame', 'recurso'].every((k) => notas[k] === null) && !notas.observacao
      return vazia
        ? p.notaPauta.deleteMany({ where: { cadeiraId, estudanteId } })
        : p.notaPauta.upsert({ where: { cadeiraId_estudanteId: { cadeiraId, estudanteId } }, create: { cadeiraId, estudanteId, ...notas }, update: notas })
    }))
  }

  publicarNotas(cadeiraId, componentes) {
    return this.prisma.unidadeCurricular.update({ where: { id: cadeiraId }, data: { notasPublicadas: componentes } })
  }

  // ---------- trabalhos e entregas ----------

  async trabalhos(cadeiraId) {
    const linhas = await this.prisma.trabalho.findMany({ where: { cadeiraId }, orderBy: { prazo: 'asc' } })
    return linhas.map((t) => ({ ...t, prazo: iso(t.prazo), criadoEm: iso(t.criadoEm) }))
  }

  async trabalho(id) {
    const n = Number(id)
    if (!Number.isSafeInteger(n) || n < 1) return null
    const t = await this.prisma.trabalho.findUnique({ where: { id: n } })
    return t && { ...t, prazo: iso(t.prazo), criadoEm: iso(t.criadoEm) }
  }

  criarTrabalho(dados) {
    return this.prisma.trabalho.create({ data: dados })
  }

  atualizarTrabalho(id, dados) {
    return this.prisma.trabalho.update({ where: { id }, data: dados })
  }

  apagarTrabalho(id) {
    return this.prisma.trabalho.delete({ where: { id } })
  }

  // próximos prazos de trabalhos nas cadeiras indicadas
  async proximosPrazos(cadeiraIds, desde, limite = 8) {
    const linhas = await this.prisma.trabalho.findMany({
      where: { cadeiraId: { in: cadeiraIds }, prazo: { gte: desde } }, orderBy: { prazo: 'asc' }, take: limite, include: { cadeira: { select: { nome: true } } },
    })
    return linhas.map((t) => ({ id: t.id, cadeiraId: t.cadeiraId, cadeira: t.cadeira.nome, titulo: t.titulo, prazo: iso(t.prazo) }))
  }

  paraEntrega = (e) => e && ({
    id: e.id, trabalhoId: e.trabalhoId, estudanteId: e.estudanteId, ficheiroId: e.ficheiroId, comentario: e.comentario,
    entregueEm: iso(e.entregueEm), nota: num(e.nota), correcao: e.correcao, corrigidaEm: iso(e.corrigidaEm),
    ...(e.estudante ? { estudante: e.estudante } : {}), ...(e.ficheiro ? { ficheiro: e.ficheiro } : {}),
  })

  async entregaDoEstudante(trabalhoId, estudanteId) {
    return this.paraEntrega(await this.prisma.entrega.findUnique({ where: { trabalhoId_estudanteId: { trabalhoId, estudanteId } } }))
  }

  async entregasDoEstudante(estudanteId, trabalhoIds) {
    const linhas = await this.prisma.entrega.findMany({ where: { estudanteId, trabalhoId: { in: trabalhoIds } } })
    return Object.fromEntries(linhas.map((e) => [e.trabalhoId, this.paraEntrega(e)]))
  }

  async entregasDoTrabalho(trabalhoId) {
    const linhas = await this.prisma.entrega.findMany({ where: { trabalhoId }, include: { estudante: contaResumo }, orderBy: { entregueEm: 'asc' } })
    return linhas.map((e) => this.paraEntrega(e))
  }

  async entrega(id) {
    const n = Number(id)
    if (!Number.isSafeInteger(n) || n < 1) return null
    return this.paraEntrega(await this.prisma.entrega.findUnique({ where: { id: n } }))
  }

  // entrega (ou substitui a anterior, enquanto o prazo permitir)
  async gravarEntrega({ trabalhoId, estudanteId, ficheiroId, comentario }) {
    return this.paraEntrega(await this.prisma.entrega.upsert({
      where: { trabalhoId_estudanteId: { trabalhoId, estudanteId } },
      create: { trabalhoId, estudanteId, ficheiroId, comentario },
      update: { ficheiroId, comentario, entregueEm: new Date(), nota: null, correcao: '', corrigidaEm: null },
    }))
  }

  async corrigirEntrega(id, { nota, correcao }) {
    return this.paraEntrega(await this.prisma.entrega.update({ where: { id }, data: { nota, correcao, corrigidaEm: new Date() } }))
  }

  // ---------- horário ----------

  async horariosDasCadeiras(cadeiraIds) {
    const linhas = await this.prisma.horario.findMany({
      where: { cadeiraId: { in: cadeiraIds } }, orderBy: [{ diaSemana: 'asc' }, { inicio: 'asc' }], include: { cadeira: { select: { nome: true, codigo: true } } },
    })
    return linhas.map((h) => ({ id: h.id, cadeiraId: h.cadeiraId, cadeira: h.cadeira.nome, codigo: h.cadeira.codigo, diaSemana: h.diaSemana, inicio: h.inicio, fim: h.fim, sala: h.sala }))
  }

  criarHorario(dados) {
    return this.prisma.horario.create({ data: dados })
  }

  apagarHorario(id) {
    return this.prisma.horario.deleteMany({ where: { id: Number(id) } })
  }

  // ---------- aulas e presenças ----------

  async aulas(cadeiraId) {
    const linhas = await this.prisma.aula.findMany({ where: { cadeiraId }, orderBy: { data: 'desc' }, include: { presencas: true } })
    return linhas.map((a) => ({ id: a.id, data: a.data, sumario: a.sumario, presencas: Object.fromEntries(a.presencas.map((p) => [p.estudanteId, p.estado])) }))
  }

  aula(id) {
    return this.prisma.aula.findUnique({ where: { id: Number(id) } })
  }

  async registarAula({ cadeiraId, data, sumario, presencas }) {
    const p = this.prisma
    return p.$transaction(async (tx) => {
      const aula = await tx.aula.create({ data: { cadeiraId, data, sumario } })
      if (presencas.length) await tx.presenca.createMany({ data: presencas.map((x) => ({ aulaId: aula.id, estudanteId: x.estudanteId, estado: x.estado })) })
      return aula
    })
  }

  async atualizarAula(id, { sumario, presencas }) {
    const p = this.prisma
    await p.$transaction([
      p.aula.update({ where: { id }, data: { sumario } }),
      p.presenca.deleteMany({ where: { aulaId: id } }),
      p.presenca.createMany({ data: presencas.map((x) => ({ aulaId: id, estudanteId: x.estudanteId, estado: x.estado })) }),
    ])
  }

  apagarAula(id) {
    return this.prisma.aula.delete({ where: { id } })
  }

  async presencasDoEstudante(estudanteId, cadeiraIds) {
    const linhas = await this.prisma.presenca.findMany({
      where: { estudanteId, aula: { cadeiraId: { in: cadeiraIds } } }, include: { aula: { select: { cadeiraId: true, data: true, sumario: true } } },
    })
    return linhas.map((p) => ({ cadeiraId: p.aula.cadeiraId, data: p.aula.data, sumario: p.aula.sumario, estado: p.estado }))
  }

  // ---------- pedidos ----------

  async pedidos({ estudanteId, estado } = {}) {
    const linhas = await this.prisma.pedido.findMany({
      where: { ...(estudanteId ? { estudanteId } : {}), ...(estado ? { estado } : {}) },
      orderBy: { criadoEm: 'desc' }, take: 1000, include: { estudante: contaResumo },
    })
    return linhas.map((p) => ({ ...p, criadoEm: iso(p.criadoEm), atualizadoEm: iso(p.atualizadoEm) }))
  }

  pedido(id) {
    return this.prisma.pedido.findUnique({ where: { id: Number(id) } })
  }

  criarPedido(dados) {
    return this.prisma.pedido.create({ data: dados })
  }

  atualizarPedido(id, dados) {
    return this.prisma.pedido.update({ where: { id }, data: { ...dados, atualizadoEm: new Date() } })
  }

  // ---------- ficheiros privados ----------

  criarFicheiro(dados) {
    return this.prisma.ficheiro.create({ data: dados })
  }

  ficheiro(id) {
    return /^[0-9a-f-]{36}$/.test(String(id)) ? this.prisma.ficheiro.findUnique({ where: { id: String(id) } }) : null
  }

  // a que pertence um ficheiro (para decidir quem o pode descarregar)
  async usoDoFicheiro(id) {
    const p = this.prisma
    const [material, trabalho, entrega, pedido, programa] = await Promise.all([
      p.material.findFirst({ where: { ficheiroId: id }, select: { cadeiraId: true, secao: { select: { visivel: true } } } }),
      p.trabalho.findFirst({ where: { ficheiroId: id }, select: { cadeiraId: true, secao: { select: { visivel: true } } } }),
      p.entrega.findFirst({ where: { ficheiroId: id }, select: { estudanteId: true, trabalho: { select: { cadeiraId: true } } } }),
      p.pedido.findFirst({ where: { ficheiroId: id }, select: { estudanteId: true } }),
      p.unidadeCurricular.findFirst({ where: { programaFicheiroId: id }, select: { id: true } }),
    ])
    if (material) return { tipo: 'material', cadeiraId: material.cadeiraId, escondido: material.secao?.visivel === false }
    if (trabalho) return { tipo: 'enunciado', cadeiraId: trabalho.cadeiraId, escondido: trabalho.secao?.visivel === false }
    if (entrega) return { tipo: 'entrega', cadeiraId: entrega.trabalho.cadeiraId, estudanteId: entrega.estudanteId }
    if (pedido) return { tipo: 'pedido', estudanteId: pedido.estudanteId }
    if (programa) return { tipo: 'programa', cadeiraId: programa.id }
    return null
  }
}
