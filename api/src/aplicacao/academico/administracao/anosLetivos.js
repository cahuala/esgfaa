import { Conflito, ErroValidacao, NaoEncontrado } from '../../../dominio/comum/erros.js'
import { FINALIDADES_REABERTURA, datasPadrao, publicoAno, validarDatas, validarId } from '../../../dominio/academico/anoLetivo.js'

/*
  Anos letivos (Administração Escolar): as datas do ano e dos dois semestres, e qual é o atual. As turmas
  são de um ano letivo; as cadeiras de um semestre (ou anuais) — daqui sai se cada uma está por começar,
  a decorrer ou terminada.
*/
export class ServicoAnosLetivos {
  constructor({ prisma, auditoria, relogio, aprovacaoComandante = false }) {
    Object.assign(this, { prisma, auditoria, relogio, aprovacaoComandante })
  }

  async listar(ctx) {
    ctx.actor.exigir('academico.ver')
    const [anos, turmas] = await Promise.all([
      this.prisma.anoLetivo.findMany({ orderBy: { id: 'desc' } }),
      this.prisma.turma.groupBy({ by: ['anoLetivo'], _count: { _all: true } }),
    ])
    const n = Object.fromEntries(turmas.map((t) => [t.anoLetivo, t._count._all]))
    const hoje = this.relogio.agora()
    return anos.map((a) => ({ ...publicoAno(a, hoje), turmas: n[a.id] ?? 0 }))
  }

  async criar(ctx, { id, ...datas }) {
    ctx.actor.exigir('academico.gerir')
    validarId(id)
    if (await this.prisma.anoLetivo.findUnique({ where: { id } })) throw new Conflito(`O ano lectivo ${id} já existe.`)
    const primeiro = !(await this.prisma.anoLetivo.count())
    const a = await this.prisma.anoLetivo.create({ data: { id, ...validarDatas(datas), atual: primeiro } })
    await this.auditoria.registar(ctx, { acao: 'criar_ano_letivo', colecao: 'anos_letivos', alvoId: id, alvoTitulo: `Ano lectivo ${id}` })
    return publicoAno(a, this.relogio.agora())
  }

  async editar(ctx, id, datas) {
    ctx.actor.exigir('academico.gerir')
    if (!(await this.prisma.anoLetivo.findUnique({ where: { id } }))) throw new NaoEncontrado('Ano lectivo não encontrado.')
    const a = await this.prisma.anoLetivo.update({ where: { id }, data: validarDatas(datas) })
    await this.auditoria.registar(ctx, { acao: 'editar_ano_letivo', colecao: 'anos_letivos', alvoId: id, alvoTitulo: `Ano lectivo ${id}` })
    return publicoAno(a, this.relogio.agora())
  }

  async tornarAtual(ctx, id) {
    ctx.actor.exigir('academico.gerir')
    if (!(await this.prisma.anoLetivo.findUnique({ where: { id } }))) throw new NaoEncontrado('Ano lectivo não encontrado.')
    await this.prisma.$transaction([
      this.prisma.anoLetivo.updateMany({ where: { atual: true }, data: { atual: false } }),
      this.prisma.anoLetivo.update({ where: { id }, data: { atual: true } }),
    ])
    await this.auditoria.registar(ctx, { acao: 'ano_letivo_atual', colecao: 'anos_letivos', alvoId: id, alvoTitulo: `Ano lectivo ${id}` })
    return this.listar(ctx)
  }

  async apagar(ctx, id) {
    ctx.actor.exigir('academico.gerir')
    if (await this.prisma.turma.count({ where: { anoLetivo: id } })) throw new Conflito('Este ano lectivo tem turmas: não se pode apagar.')
    await this.prisma.anoLetivo.deleteMany({ where: { id } })
    await this.auditoria.registar(ctx, { acao: 'apagar_ano_letivo', colecao: 'anos_letivos', alvoId: id, alvoTitulo: `Ano lectivo ${id}` })
  }

  // ---------- fechar e reabrir ----------
  /*
    Os anos lectivos nascem abertos (para lançar as notas e o resto das actividades). No fim, fecha-se o ano por
    ordem do Comandante (ele fecha directamente; a Administração Escolar pede e fecha quando ele aprova): já não se mexe nas turmas, cadeiras, matrículas, notas e actividades desse ano, nem se
    emitem documentos dele. Reabre-se por ordem do Comandante — ele reabre directamente; a Administração Escolar
    pede (para lançar notas ou actividades, ou para emitir um documento) e só reabre quando ele aprova («Por
    aprovar»); se recusar, a Administração Escolar vê o motivo. Depois de feito o que era preciso, fecha-se outra vez.
  */
  async #ano(id) {
    const a = await this.prisma.anoLetivo.findUnique({ where: { id } })
    if (!a) throw new NaoEncontrado('Ano lectivo não encontrado.')
    return a
  }

  async fechar(ctx, id, { motivo = '' } = {}) {
    ctx.actor.exigir('academico.gerir')
    const a = await this.#ano(id)
    if (a.fechado) throw new Conflito(`O ano lectivo ${id} já está fechado.`)
    const pedido = { motivo: String(motivo ?? '').trim(), pedidoPor: ctx.actor.nome ?? '', pedidoEm: this.relogio.agora().toISOString() }
    // o Comandante (ou sem a aprovação do Comandante configurada) fecha logo; a Administração Escolar pede
    if (!this.aprovacaoComandante || ctx.actor.pode('academico.homologar')) {
      await this.#fechar(ctx, id, pedido)
      return { fechado: true, anos: await this.listar(ctx) }
    }
    if (a.pedidoFecho) throw new Conflito(`O fecho do ano lectivo ${id} já está à espera do Comandante.`)
    await this.prisma.anoLetivo.update({ where: { id }, data: { pedidoFecho: pedido, recusaFecho: null } })
    await this.auditoria.registar(ctx, { acao: 'pedir_fecho_ano_letivo', colecao: 'anos_letivos', alvoId: id, alvoTitulo: `Ano lectivo ${id}` })
    return { fechado: false, anos: await this.listar(ctx) }
  }

  async #fechar(ctx, id, pedido) {
    await this.prisma.anoLetivo.update({ where: { id }, data: { fechado: true, fechadoEm: this.relogio.agora(), fechadoPor: pedido.pedidoPor || (ctx.actor.nome ?? ''), pedidoFecho: null, recusaFecho: null, pedidoReabertura: null } })
    await this.auditoria.registar(ctx, { acao: 'fechar_ano_letivo', colecao: 'anos_letivos', alvoId: id, alvoTitulo: `Ano lectivo ${id}`, detalhes: { autorizadoPor: ctx.actor.nome ?? '' } })
  }

  async pedirReabertura(ctx, id, { motivo, finalidade = 'actividades', documento = '' }) {
    ctx.actor.exigir('academico.gerir')
    const a = await this.#ano(id)
    if (!a.fechado) throw new Conflito(`O ano lectivo ${id} está aberto.`)
    const m = String(motivo ?? '').trim()
    if (m.length < 3) throw new ErroValidacao('Indique o motivo da reabertura (o Comandante vê-o).', { campo: 'motivo' })
    if (!FINALIDADES_REABERTURA[finalidade]) throw new ErroValidacao('Para que é a reabertura?', { campo: 'finalidade' })
    const doc = String(documento ?? '').trim()
    if (finalidade === 'documento' && doc.length < 3) throw new ErroValidacao('Indique o documento a emitir.', { campo: 'documento' })
    const pedido = { motivo: m, finalidade, ...(finalidade === 'documento' ? { documento: doc } : {}), pedidoPor: ctx.actor.nome ?? '', pedidoEm: this.relogio.agora().toISOString() }
    // o Comandante (ou sem a aprovação do Comandante configurada) reabre logo
    if (!this.aprovacaoComandante || ctx.actor.pode('academico.homologar')) {
      await this.#reabrir(ctx, id, pedido)
      return { reaberto: true, anos: await this.listar(ctx) }
    }
    await this.prisma.anoLetivo.update({ where: { id }, data: { pedidoReabertura: pedido, recusaReabertura: null } })
    await this.auditoria.registar(ctx, { acao: 'pedir_reabertura_ano_letivo', colecao: 'anos_letivos', alvoId: id, alvoTitulo: `Ano lectivo ${id}`, detalhes: { motivo: m, finalidade } })
    return { reaberto: false, anos: await this.listar(ctx) }
  }

  async #reabrir(ctx, id, pedido) {
    const reabertura = { ...pedido, autorizadoPor: ctx.actor.nome ?? '', autorizadoEm: this.relogio.agora().toISOString() }
    await this.prisma.anoLetivo.update({ where: { id }, data: { fechado: false, fechadoEm: null, fechadoPor: '', pedidoReabertura: null, recusaReabertura: null, reabertura } })
    await this.auditoria.registar(ctx, { acao: 'reabrir_ano_letivo', colecao: 'anos_letivos', alvoId: id, alvoTitulo: `Ano lectivo ${id}`, detalhes: { motivo: pedido.motivo, finalidade: pedido.finalidade, documento: pedido.documento } })
  }

  // o que espera pelo Comandante
  async reaberturasPendentes() {
    return (await this.prisma.anoLetivo.findMany({ where: { fechado: true }, orderBy: { id: 'desc' } })).filter((a) => a.pedidoReabertura)
  }

  async fechosPendentes() {
    return (await this.prisma.anoLetivo.findMany({ where: { fechado: false }, orderBy: { id: 'desc' } })).filter((a) => a.pedidoFecho)
  }

  // a decisão do Comandante: sobre o pedido de fecho (ano aberto) ou de reabertura (ano fechado)
  async decidir(ctx, id, corpo) {
    const a = await this.#ano(id)
    return !a.fechado && a.pedidoFecho ? this.decidirFecho(ctx, id, corpo) : this.decidirReabertura(ctx, id, corpo)
  }

  async decidirFecho(ctx, id, { decisao, motivo }) {
    ctx.actor.exigir('academico.homologar')
    const a = await this.#ano(id)
    if (a.fechado || !a.pedidoFecho) throw new Conflito('O fecho deste ano lectivo não está à espera de aprovação.')
    if (decisao === 'aprovar') {
      await this.#fechar(ctx, id, a.pedidoFecho)
      return { decisao: 'aprovar' }
    }
    const m = String(motivo ?? '').trim()
    if (m.length < 3) throw new ErroValidacao('Indique o motivo (a Administração Escolar vê-o).', { campo: 'motivo' })
    await this.prisma.anoLetivo.update({ where: { id }, data: { pedidoFecho: null, recusaFecho: { ...a.pedidoFecho, motivoRecusa: m, decididoPor: ctx.actor.nome ?? '', decididoEm: this.relogio.agora().toISOString() } } })
    await this.auditoria.registar(ctx, { acao: 'recusar_fecho_ano_letivo', colecao: 'anos_letivos', alvoId: id, alvoTitulo: `Ano lectivo ${id}`, detalhes: { motivo: m } })
    return { decisao: 'recusar' }
  }

  async decidirReabertura(ctx, id, { decisao, motivo }) {
    ctx.actor.exigir('academico.homologar')
    const a = await this.#ano(id)
    if (!a.fechado || !a.pedidoReabertura) throw new Conflito('A reabertura deste ano lectivo não está à espera de aprovação.')
    if (decisao === 'aprovar') {
      await this.#reabrir(ctx, id, a.pedidoReabertura)
      return { decisao: 'aprovar' }
    }
    const m = String(motivo ?? '').trim()
    if (m.length < 3) throw new ErroValidacao('Indique o motivo (a Administração Escolar vê-o).', { campo: 'motivo' })
    await this.prisma.anoLetivo.update({ where: { id }, data: { pedidoReabertura: null, recusaReabertura: { ...a.pedidoReabertura, motivoRecusa: m, decididoPor: ctx.actor.nome ?? '', decididoEm: this.relogio.agora().toISOString() } } })
    await this.auditoria.registar(ctx, { acao: 'recusar_reabertura_ano_letivo', colecao: 'anos_letivos', alvoId: id, alvoTitulo: `Ano lectivo ${id}`, detalhes: { motivo: m } })
    return { decisao: 'recusar' }
  }

  /*
    Antes de mexer em alguma coisa de um ano lectivo (a turma, uma cadeira, uma matrícula, uma nota, uma
    actividade): se o ano está fechado, recusa. De: { anoLetivo } | { turmaId } | { cadeiraId }.
  */
  async anoDe({ anoLetivo, turmaId, cadeiraId, matriculaId, inscricaoId, horarioId, trabalhoId, questionarioId, materialId, entregaId, tentativaId }) {
    if (anoLetivo) return anoLetivo
    const turma = { select: { turma: { select: { anoLetivo: true } } } }
    const daCadeira = async (q) => (await q)?.cadeira?.turma?.anoLetivo ?? null
    if (turmaId) return (await this.prisma.turma.findUnique({ where: { id: turmaId }, select: { anoLetivo: true } }))?.anoLetivo ?? null
    if (cadeiraId) return (await this.prisma.unidadeCurricular.findUnique({ where: { id: cadeiraId }, ...turma }))?.turma.anoLetivo ?? null
    if (matriculaId) return (await this.prisma.matricula.findUnique({ where: { id: matriculaId }, ...turma }))?.turma.anoLetivo ?? null
    const comCadeira = { select: { cadeira: turma } }
    if (inscricaoId) return daCadeira(this.prisma.inscricaoCadeira.findUnique({ where: { id: inscricaoId }, ...comCadeira }))
    if (horarioId) return daCadeira(this.prisma.horario.findUnique({ where: { id: horarioId }, ...comCadeira }))
    if (trabalhoId) return daCadeira(this.prisma.trabalho.findUnique({ where: { id: trabalhoId }, ...comCadeira }))
    if (questionarioId) return daCadeira(this.prisma.questionario.findUnique({ where: { id: questionarioId }, ...comCadeira }))
    if (materialId) return daCadeira(this.prisma.material.findUnique({ where: { id: materialId }, ...comCadeira }))
    if (entregaId) return (await this.prisma.entrega.findUnique({ where: { id: entregaId }, select: { trabalho: comCadeira } }))?.trabalho?.cadeira?.turma?.anoLetivo ?? null
    if (tentativaId) return (await this.prisma.tentativa.findUnique({ where: { id: tentativaId }, select: { questionario: comCadeira } }))?.questionario?.cadeira?.turma?.anoLetivo ?? null
    return null
  }

  async exigirAberto(de) {
    const ano = await this.anoDe(de)
    if (!ano) return
    const a = await this.prisma.anoLetivo.findUnique({ where: { id: ano }, select: { fechado: true } })
    if (a?.fechado) throw new Conflito(`O ano lectivo ${ano} está fechado: já não se pode alterar nem emitir documentos dele. Para isso, o Comandante tem de o reabrir (peça em «Ano lectivo e semestres»).`)
  }

  // uma turma nova num ano ainda por configurar: o ano fica registado com as datas habituais (corrigem-se depois)
  async garantir(id) {
    validarId(id)
    if (await this.prisma.anoLetivo.findUnique({ where: { id } })) return
    const primeiro = !(await this.prisma.anoLetivo.count())
    await this.prisma.anoLetivo.create({ data: { id, ...validarDatas(datasPadrao(id)), atual: primeiro } }).catch(() => {})
  }
}
