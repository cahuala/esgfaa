import { Conflito } from '../../dominio/comum/erros.js'
import { eDuplicado } from '../bd/prisma.js'

const iso = (d) => (d ? new Date(d).toISOString() : null)
const num = (d) => (d === null || d === undefined ? null : Number(d))
const contaResumo = { select: { id: true, nome: true, numero: true, email: true } }

const ordemPapel = { regente: 0, assistente: 1 }
// ficheiros de uma pasta, por ordem
const FICHEIROS_PASTA = { ficheiros: { orderBy: { ordem: 'asc' }, include: { ficheiro: { select: { id: true, nome: true, tipo: true, tamanho: true } } } } }

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

  // todos os estudantes com alguma matrícula ativa (avisos gerais da Escola)
  async idsEstudantesAtivos() {
    const linhas = await this.prisma.matricula.findMany({ where: { estado: 'ativa', estudante: { ativo: true } }, distinct: ['estudanteId'], select: { estudanteId: true } })
    return linhas.map((l) => l.estudanteId)
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

  // grava as restrições de acesso de uma atividade
  restringirAtividade(tipo, id, dados) {
    const modelo = { material: this.prisma.material, trabalho: this.prisma.trabalho, questionario: this.prisma.questionario, inquerito: this.prisma.inquerito }[tipo]
    return modelo.update({ where: { id }, data: dados })
  }

  // muda uma atividade (material, trabalho, questionário) de capítulo
  moverAtividade(tipo, id, secaoId) {
    const modelo = { material: this.prisma.material, trabalho: this.prisma.trabalho, questionario: this.prisma.questionario, inquerito: this.prisma.inquerito }[tipo]
    return modelo.update({ where: { id }, data: { secaoId } })
  }

  // ---------- materiais e avisos ----------

  #material(m) {
    if (!m) return null
    const { ficheiros, ...resto } = m
    return {
      ...resto, publicadoEm: iso(m.publicadoEm), inicio: iso(m.inicio), disponivelDe: iso(m.disponivelDe),
      ficheiros: (ficheiros || []).map((x) => ({ id: x.ficheiro.id, nome: x.ficheiro.nome, tipo: x.ficheiro.tipo, tamanho: x.ficheiro.tamanho })),
    }
  }

  async materiais(cadeiraId) {
    const linhas = await this.prisma.material.findMany({ where: { cadeiraId }, orderBy: [{ publicadoEm: 'asc' }, { id: 'asc' }], include: FICHEIROS_PASTA })
    return linhas.map((m) => this.#material(m))
  }

  criarMaterial(dados) {
    return this.prisma.material.create({ data: dados })
  }

  // muda os campos e, numa pasta, junta e retira ficheiros
  async editarMaterial(id, dados, { juntar = [], retirar = [], ordemBase = 0 } = {}) {
    await this.prisma.$transaction([
      this.prisma.material.update({ where: { id }, data: dados }),
      this.prisma.materialFicheiro.deleteMany({ where: { materialId: id, ficheiroId: { in: retirar } } }),
      this.prisma.materialFicheiro.createMany({ data: juntar.map((ficheiroId, i) => ({ materialId: id, ficheiroId, ordem: ordemBase + i })) }),
    ])
  }

  async material(id) {
    const n = Number(id)
    if (!Number.isSafeInteger(n) || n < 1) return null
    return this.#material(await this.prisma.material.findUnique({ where: { id: n }, include: FICHEIROS_PASTA }))
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

  // composição das componentes calculadas: { p1: [{ tipo, id, peso }], … }
  async composicoes(cadeiraId) {
    const linhas = await this.prisma.composicaoNota.findMany({ where: { cadeiraId } })
    return Object.fromEntries(linhas.map((l) => [l.componente, l.itens]))
  }

  guardarComposicao(cadeiraId, componente, itens) {
    if (!itens) return this.prisma.composicaoNota.deleteMany({ where: { cadeiraId, componente } })
    return this.prisma.composicaoNota.upsert({ where: { cadeiraId_componente: { cadeiraId, componente } }, create: { cadeiraId, componente, itens }, update: { itens } })
  }

  // escreve na pauta os valores calculados de uma componente ({ estudanteId: valor | null })
  async gravarComponente(cadeiraId, componente, valores) {
    const p = this.prisma
    await p.$transaction(Object.entries(valores).map(([id, valor]) => p.notaPauta.upsert({
      where: { cadeiraId_estudanteId: { cadeiraId, estudanteId: Number(id) } },
      create: { cadeiraId, estudanteId: Number(id), [componente]: valor },
      update: { [componente]: valor },
    })))
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
    id: e.id, trabalhoId: e.trabalhoId, estudanteId: e.estudanteId, texto: e.texto, comentario: e.comentario,
    ficheiros: (e.ficheiros || []).sort((x, y) => x.ordem - y.ordem).map((f) => ({ id: f.ficheiro.id, nome: f.ficheiro.nome, tipo: f.ficheiro.tipo, tamanho: f.ficheiro.tamanho })),
    entregueEm: iso(e.entregueEm), nota: num(e.nota), correcao: e.correcao, corrigidaEm: iso(e.corrigidaEm),
    correcaoFicheiroId: e.correcaoFicheiroId, grelha: e.grelha || {},
    ...(e.estudante ? { estudante: e.estudante } : {}),
  })

  #comFicheiros = { ficheiros: { include: { ficheiro: { select: { id: true, nome: true, tipo: true, tamanho: true } } } } }

  async entregaDoEstudante(trabalhoId, estudanteId) {
    return this.paraEntrega(await this.prisma.entrega.findUnique({ where: { trabalhoId_estudanteId: { trabalhoId, estudanteId } }, include: this.#comFicheiros }))
  }

  async entregasDoEstudante(estudanteId, trabalhoIds) {
    const linhas = await this.prisma.entrega.findMany({ where: { estudanteId, trabalhoId: { in: trabalhoIds } }, include: this.#comFicheiros })
    return Object.fromEntries(linhas.map((e) => [e.trabalhoId, this.paraEntrega(e)]))
  }

  async entregasDoTrabalho(trabalhoId) {
    const linhas = await this.prisma.entrega.findMany({ where: { trabalhoId }, include: { estudante: contaResumo, ...this.#comFicheiros }, orderBy: { entregueEm: 'asc' } })
    return linhas.map((e) => this.paraEntrega(e))
  }

  async entrega(id) {
    const n = Number(id)
    if (!Number.isSafeInteger(n) || n < 1) return null
    return this.paraEntrega(await this.prisma.entrega.findUnique({ where: { id: n }, include: this.#comFicheiros }))
  }

  // entrega (ou substitui a anterior, enquanto o prazo permitir): ficheiros e/ou texto
  async gravarEntrega({ trabalhoId, estudanteId, ficheiroIds, texto, comentario }) {
    const p = this.prisma
    const e = await p.$transaction(async (tx) => {
      const x = await tx.entrega.upsert({
        where: { trabalhoId_estudanteId: { trabalhoId, estudanteId } },
        create: { trabalhoId, estudanteId, texto, comentario },
        update: { texto, comentario, entregueEm: new Date(), nota: null, correcao: '', corrigidaEm: null, correcaoFicheiroId: null, grelha: {} },
      })
      await tx.entregaFicheiro.deleteMany({ where: { entregaId: x.id } })
      if (ficheiroIds.length) await tx.entregaFicheiro.createMany({ data: ficheiroIds.map((ficheiroId, ordem) => ({ entregaId: x.id, ficheiroId, ordem })) })
      return x
    })
    return this.entrega(e.id)
  }

  async corrigirEntrega(id, dados) {
    await this.prisma.entrega.update({ where: { id }, data: { ...dados, corrigidaEm: new Date() } })
    return this.entrega(id)
  }

  // ---------- prorrogações de prazo ----------

  async prorrogacoes(trabalhoId) {
    const linhas = await this.prisma.prorrogacao.findMany({ where: { trabalhoId } })
    return Object.fromEntries(linhas.map((p) => [p.estudanteId, { prazo: iso(p.prazo), motivo: p.motivo }]))
  }

  async prorrogacao(trabalhoId, estudanteId) {
    const p = await this.prisma.prorrogacao.findUnique({ where: { trabalhoId_estudanteId: { trabalhoId, estudanteId } } })
    return p && { prazo: iso(p.prazo), motivo: p.motivo }
  }

  // prorrogações de um estudante em vários trabalhos: { trabalhoId: { prazo } }
  async prorrogacoesDoEstudante(estudanteId, trabalhoIds) {
    const linhas = await this.prisma.prorrogacao.findMany({ where: { estudanteId, trabalhoId: { in: trabalhoIds } } })
    return Object.fromEntries(linhas.map((p) => [p.trabalhoId, { prazo: iso(p.prazo), motivo: p.motivo }]))
  }

  definirProrrogacao(trabalhoId, estudanteId, dados) {
    if (!dados) return this.prisma.prorrogacao.deleteMany({ where: { trabalhoId, estudanteId } })
    return this.prisma.prorrogacao.upsert({ where: { trabalhoId_estudanteId: { trabalhoId, estudanteId } }, create: { trabalhoId, estudanteId, ...dados }, update: dados })
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
      p.material.findFirst({ where: { OR: [{ ficheiroId: id }, { ficheiros: { some: { ficheiroId: id } } }] }, select: { id: true, cadeiraId: true, secao: { select: { visivel: true } } } }),
      p.trabalho.findFirst({ where: { ficheiroId: id }, select: { id: true, cadeiraId: true, secao: { select: { visivel: true } } } }),
      p.entrega.findFirst({ where: { OR: [{ ficheiros: { some: { ficheiroId: id } } }, { correcaoFicheiroId: id }] }, select: { estudanteId: true, trabalho: { select: { cadeiraId: true } } } }),
      p.pedido.findFirst({ where: { ficheiroId: id }, select: { estudanteId: true } }),
      p.unidadeCurricular.findFirst({ where: { programaFicheiroId: id }, select: { id: true } }),
    ])
    if (material) return { tipo: 'material', cadeiraId: material.cadeiraId, escondido: material.secao?.visivel === false, atividade: `material-${material.id}` }
    if (trabalho) return { tipo: 'enunciado', cadeiraId: trabalho.cadeiraId, escondido: trabalho.secao?.visivel === false, atividade: `trabalho-${trabalho.id}` }
    if (entrega) return { tipo: 'entrega', cadeiraId: entrega.trabalho.cadeiraId, estudanteId: entrega.estudanteId }
    if (pedido) return { tipo: 'pedido', estudanteId: pedido.estudanteId }
    if (programa) return { tipo: 'programa', cadeiraId: programa.id }
    return null
  }
}
