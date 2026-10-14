import { NaoEncontrado, SemPermissao, Conflito } from '../../dominio/comum/erros.js'
import { limparRespostasInquerito, mediaGlobal, resultadosInquerito } from '../../dominio/comum/opiniao.js'
import { InqueritoInstitucional, MODELOS, PUBLICOS } from '../../dominio/qualidade/inquerito.js'

/*
  Inquéritos institucionais de satisfação: a Administração Escolar prepara, lança e vê os resultados;
  estudantes e docentes respondem no portal, de forma anónima.
*/
export class ServicoInqueritosInstitucionais {
  constructor({ qualidade, academico, notificacoes, auditoria, relogio }) {
    Object.assign(this, { qualidade, academico, notificacoes, auditoria, relogio })
  }

  async #inquerito(id) {
    const i = await this.qualidade.porId(id)
    if (!i) throw new NaoEncontrado('Inquérito não encontrado.')
    return i
  }

  #resumo(i, destinatarios = null) {
    return { ...i, estado: i.estado(this.relogio.agora()), ...(destinatarios !== null ? { destinatarios } : {}) }
  }

  // ---------- Administração Escolar ----------

  async listar(ctx) {
    ctx.actor.exigir('academico.ver')
    const l = await this.qualidade.listar()
    return { modelos: MODELOS, publicos: PUBLICOS, inqueritos: await Promise.all(l.map(async (i) => this.#resumo(i, (await this.qualidade.destinatarios(i)).length))) }
  }

  async criar(ctx, dados) {
    ctx.actor.exigir('academico.gerir')
    const i = await this.qualidade.criar({ ...InqueritoInstitucional.validar(dados), autor: ctx.actor.nome || '' })
    await this.auditoria.registar(ctx, { acao: 'criar_inquerito_institucional', colecao: 'inqueritos', alvoId: i.id, alvoTitulo: i.titulo })
    return this.#resumo(i)
  }

  async atualizar(ctx, id, dados) {
    ctx.actor.exigir('academico.gerir')
    const i = await this.#inquerito(id)
    return this.#resumo(await this.qualidade.guardar(i, i.mudancasPermitidas(InqueritoInstitucional.validar(dados, i))))
  }

  // lança: fica visível no portal e avisa quem deve responder
  async lancar(ctx, id) {
    ctx.actor.exigir('academico.gerir')
    const i = (await this.#inquerito(id)).lancar(this.relogio.agora())
    const g = await this.qualidade.guardar(i, { lancadoEm: i.lancadoEm })
    const para = await this.qualidade.destinatarios(g)
    await this.notificacoes?.notificar(para, {
      tipo: 'inquerito', titulo: `Inquérito: ${g.titulo}`, texto: `Responda até ${new Date(g.fecha).toLocaleDateString('pt-PT', { timeZone: 'Africa/Luanda' })}. As respostas são anónimas.`,
      ligacao: `/inqueritos/${g.id}`,
    })
    await this.auditoria.registar(ctx, { acao: 'lancar_inquerito_institucional', colecao: 'inqueritos', alvoId: g.id, alvoTitulo: g.titulo, detalhes: { destinatarios: para.length } })
    return this.#resumo(g, para.length)
  }

  async apagar(ctx, id) {
    ctx.actor.exigir('academico.gerir')
    const i = await this.#inquerito(id)
    await this.qualidade.apagar(i.id)
    await this.auditoria.registar(ctx, { acao: 'apagar_inquerito_institucional', colecao: 'inqueritos', alvoId: i.id, alvoTitulo: i.titulo })
  }

  async resultados(ctx, id) {
    ctx.actor.exigir('academico.ver')
    const i = await this.#inquerito(id)
    const resultados = resultadosInquerito(i.perguntas, await this.qualidade.respostas(i.id))
    return { ...this.#resumo(i, (await this.qualidade.destinatarios(i)).length), resultados, media: mediaGlobal(resultados) }
  }

  // ---------- portal ----------

  async #turmas(conta) {
    return conta.tipo === 'estudante' ? this.academico.turmasAtivas(conta.id) : []
  }

  // inquéritos abertos (e os já respondidos) para esta conta
  async doPortal(ctx) {
    const turmas = await this.#turmas(ctx.conta)
    const agora = this.relogio.agora()
    const meus = (await this.qualidade.listar({ soLancados: true })).filter((i) => i.destinadoA(ctx.conta, turmas) && i.estado(agora) === 'aberto')
    const feitos = await this.qualidade.respondidos(ctx.conta.id, meus.map((i) => i.id))
    return meus.map((i) => ({ id: i.id, titulo: i.titulo, descricao: i.descricao, fecha: i.fecha, perguntas: i.perguntas.length, respondido: feitos.has(i.id) }))
  }

  async #doPortal(ctx, id) {
    const i = await this.#inquerito(id)
    if (!i.lancado || !i.destinadoA(ctx.conta, await this.#turmas(ctx.conta))) throw new NaoEncontrado('Inquérito não encontrado.')
    return i
  }

  async ver(ctx, id) {
    const i = await this.#doPortal(ctx, id)
    const respondido = (await this.qualidade.respondidos(ctx.conta.id, [i.id])).has(i.id)
    const estado = i.estado(this.relogio.agora())
    return { id: i.id, titulo: i.titulo, descricao: i.descricao, fecha: i.fecha, perguntas: i.perguntas, estado, respondido, podeResponder: estado === 'aberto' && !respondido }
  }

  async responder(ctx, id, respostas) {
    const i = await this.#doPortal(ctx, id)
    if (i.estado(this.relogio.agora()) !== 'aberto') throw new Conflito('Este inquérito já fechou.')
    if (!ctx.conta) throw new SemPermissao()
    await this.qualidade.responder(i.id, ctx.conta.id, limparRespostasInquerito(i.perguntas, respostas), this.relogio.agora())
    return this.ver(ctx, i.id)
  }
}
