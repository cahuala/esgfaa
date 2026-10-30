import { NaoEncontrado, SemPermissao, Conflito, ErroValidacao } from '../../dominio/comum/erros.js'
import { contarPerguntas, limparRespostasInquerito, mediaGlobal, resultadosInquerito } from '../../dominio/comum/opiniao.js'
import { InqueritoInstitucional, MODELOS, PUBLICOS } from '../../dominio/qualidade/inquerito.js'

/*
  Inquéritos institucionais de satisfação: a Administração Escolar prepara, lança e vê os resultados;
  estudantes e docentes respondem no portal, de forma anónima. O lançamento espera a aprovação do
  Comandante (permissão «publicacoes.aprovar»); quem a tem lança logo.
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

  // lança: fica visível no portal e avisa quem deve responder (sem a aprovação, fica pedido ao Comandante)
  async lancar(ctx, id) {
    ctx.actor.exigir('academico.gerir')
    const atual = await this.#inquerito(id)
    if (!ctx.actor.pode('publicacoes.aprovar')) {
      if (atual.aprovacao?.estado === 'pendente') throw new Conflito('O lançamento já está à espera do Comandante.')
      atual.lancar(this.relogio.agora()) // as mesmas verificações (já lançado, data de fecho)
      const g = await this.qualidade.guardar(atual, { aprovacao: { estado: 'pendente', pedidoPor: ctx.actor.nome ?? null, pedidoEm: this.relogio.agora().toISOString() } })
      await this.auditoria.registar(ctx, { acao: 'pedir_aprovacao_inquerito', colecao: 'inqueritos', alvoId: g.id, alvoTitulo: g.titulo })
      return this.#resumo(g)
    }
    return this.#lancar(ctx, atual)
  }

  async #lancar(ctx, atual) {
    const i = atual.lancar(this.relogio.agora())
    const g = await this.qualidade.guardar(i, { lancadoEm: i.lancadoEm, aprovacao: null })
    const para = await this.qualidade.destinatarios(g)
    await this.notificacoes?.notificar(para, {
      tipo: 'inquerito', titulo: `Inquérito: ${g.titulo}`, texto: `Responda até ${new Date(g.fecha).toLocaleDateString('pt-PT', { timeZone: 'Africa/Luanda' })}. As respostas são anónimas.`,
      ligacao: `/inqueritos/${g.id}`,
    })
    await this.auditoria.registar(ctx, { acao: 'lancar_inquerito_institucional', colecao: 'inqueritos', alvoId: g.id, alvoTitulo: g.titulo, detalhes: { destinatarios: para.length } })
    return this.#resumo(g, para.length)
  }

  // ---------- Comandante ----------

  async paraAprovar(ctx) {
    if (!ctx.actor.pode('publicacoes.aprovar')) return []
    const PUB = { estudantes: 'Estudantes', docentes: 'Docentes', todos: 'Estudantes e docentes' }
    return (await this.qualidade.pendentes()).map((i) => ({
      colecao: 'inqueritos', id: String(i.id), titulo: i.titulo, tipo: 'publicar', pedidoPor: i.aprovacao.pedidoPor, pedidoEm: i.aprovacao.pedidoEm,
      resumo: `${i.descricao ? `${i.descricao} — ` : ''}${i.perguntas.length} pergunta(s); fecha a ${new Date(i.fecha).toLocaleDateString('pt-PT', { timeZone: 'Africa/Luanda' })}.`,
      destino: PUB[i.publico] ?? i.publico,
    }))
  }

  contarParaAprovar(ctx) {
    return ctx.actor.pode('publicacoes.aprovar') ? this.qualidade.contarPendentes() : 0
  }

  async decidir(ctx, id, { decisao, motivo }) {
    ctx.actor.exigir('publicacoes.aprovar')
    const i = await this.#inquerito(id)
    if (i.aprovacao?.estado !== 'pendente') throw new Conflito('Este inquérito não está à espera de aprovação.')
    if (decisao === 'aprovar') {
      await this.#lancar(ctx, i)
      await this.auditoria.registar(ctx, { acao: 'aprovar_publicacao', colecao: 'inqueritos', alvoId: i.id, alvoTitulo: i.titulo, detalhes: { pedidoPor: i.aprovacao.pedidoPor } })
      return { aprovado: true }
    }
    const m = String(motivo ?? '').trim()
    if (m.length < 3) throw new ErroValidacao('Escreva o motivo da recusa.', { campo: 'motivo' })
    await this.qualidade.guardar(i, { aprovacao: { ...i.aprovacao, estado: 'recusado', motivo: m.slice(0, 1000), decididoPor: ctx.actor.nome ?? '', decididoEm: this.relogio.agora().toISOString() } })
    await this.auditoria.registar(ctx, { acao: 'recusar_publicacao', colecao: 'inqueritos', alvoId: i.id, alvoTitulo: i.titulo, detalhes: { motivo: m } })
    return { aprovado: false }
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
    return meus.map((i) => ({ id: i.id, titulo: i.titulo, descricao: i.descricao, fecha: i.fecha, perguntas: contarPerguntas(i.perguntas), respondido: feitos.has(i.id) }))
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
