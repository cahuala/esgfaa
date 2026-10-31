import { Conflito, ErroValidacao, NaoEncontrado } from '../dominio/comum/erros.js'
import { INTERATIVAS } from '../dominio/conteudos/colecoes.js'
import { novoComentario, visitanteValido } from '../dominio/interacao/comentario.js'

/*
  Gostos, comentários e visualizações do público; moderação no painel.
  Um comentário só aparece no site depois de duas aprovações: a equipa de comunicação revê («comentarios.aprovar»,
  pendente → revisto) e o Comandante aprova («publicacoes.aprovar», revisto → publicado). Quem tem as duas
  permissões publica logo. Recusar apaga o comentário (fica o texto no registo de atividades).
*/
export class ServicoInteracoes {
  constructor({ interacoes, conteudos, auditoria, vistasRecentes, titulos, relogio = { agora: () => new Date() }, tempoReal = null }) {
    Object.assign(this, { interacoes, conteudos, auditoria, vistasRecentes, titulos, relogio, tempoReal })
  }

  // só se interage com notícias, eventos e artigos publicados
  async #garantirItem(colecao, id) {
    if (!INTERATIVAS.includes(colecao)) throw new NaoEncontrado('Coleção inválida.')
    if (!(await this.conteudos.publicadoExiste(colecao, id))) throw new NaoEncontrado('Conteúdo não encontrado.')
  }

  async resumo(colecao, id, visitante) {
    await this.#garantirItem(colecao, id)
    return this.interacoes.resumo(colecao, id, visitanteValido(visitante) ? visitante : null)
  }

  // no máximo uma visualização por visitante a cada 30 min para o mesmo item
  async registarVisualizacao(colecao, id, visitante, ip) {
    await this.#garantirItem(colecao, id)
    const quem = visitanteValido(visitante) ? visitante : ip
    if (this.vistasRecentes.marcarSeNova(`${colecao}/${id}/${quem}`)) await this.interacoes.contarVisualizacao(colecao, id)
  }

  async alternarGosto(colecao, id, visitante) {
    await this.#garantirItem(colecao, id)
    if (!visitanteValido(visitante)) throw new ErroValidacao('Identificador de visitante inválido.')
    await this.interacoes.alternarGosto(colecao, id, visitante)
    return this.interacoes.resumo(colecao, id, visitante)
  }

  async comentar(colecao, id, { nome, texto, visitante }, ip) {
    await this.#garantirItem(colecao, id)
    await this.interacoes.comentar(colecao, id, novoComentario({ nome, texto }), ip)
    this.tempoReal?.avisar('painel', { tipo: 'comentarios' })
    return { ...(await this.interacoes.resumo(colecao, id, visitanteValido(visitante) ? visitante : null)), emAprovacao: true }
  }

  // gostos, comentários e visualizações de cada item (mostrados nas listagens do site)
  contagens() {
    return this.interacoes.porItem()
  }

  // ---------- painel ----------

  async listarComentarios(ctx) {
    ctx.actor.exigir('comentarios.ver')
    const [titulos, lista] = await Promise.all([this.titulos(), this.interacoes.listarComentarios({ limite: 2000 })])
    return lista.map((c) => ({ ...c, tituloItem: titulos[`${c.colecao}/${c.item_id}`] || c.item_id }))
  }

  async #comentario(id) {
    const c = await this.interacoes.comentario(id)
    if (!c) throw new NaoEncontrado('Comentário não encontrado.')
    return c
  }

  async #publicar(ctx, c, acao) {
    await this.interacoes.mudarEstadoComentario(c.id, 'publicado')
    await this.auditoria.registar(ctx, { acao, colecao: c.colecao, alvoId: c.item_id, alvoTitulo: `Comentário de ${c.nome}`, detalhes: { texto: c.texto.slice(0, 300) } })
    this.tempoReal?.avisar('publico', { tipo: 'comentarios', colecao: c.colecao, id: c.item_id })
  }

  async #recusar(ctx, c, motivo) {
    await this.interacoes.apagarComentario(c.id)
    await this.auditoria.registar(ctx, {
      acao: 'recusar_comentario', colecao: c.colecao, alvoId: c.item_id,
      alvoTitulo: `Comentário de ${c.nome}`, detalhes: { texto: c.texto.slice(0, 300), ...(motivo ? { motivo: String(motivo).trim().slice(0, 1000) } : {}) },
    })
  }

  // 1.º passo: a equipa de comunicação revê o comentário (aprovado, vai ao Comandante)
  async rever(ctx, id, { decisao, motivo }) {
    ctx.actor.exigir('comentarios.aprovar')
    const c = await this.#comentario(id)
    if (c.estado !== 'pendente') throw new Conflito('Este comentário já foi revisto.')
    if (decisao !== 'aprovar') return this.#recusar(ctx, c, motivo).then(() => ({ estado: 'recusado' }))
    if (ctx.actor.pode('publicacoes.aprovar')) return this.#publicar(ctx, c, 'aprovar_comentario').then(() => ({ estado: 'publicado' }))
    await this.interacoes.mudarEstadoComentario(c.id, 'revisto', { revistoPor: ctx.actor.nome ?? '', revistoEm: this.relogio.agora() })
    await this.auditoria.registar(ctx, { acao: 'rever_comentario', colecao: c.colecao, alvoId: c.item_id, alvoTitulo: `Comentário de ${c.nome}`, detalhes: { texto: c.texto.slice(0, 300) } })
    return { estado: 'revisto' }
  }

  // 2.º passo: o Comandante (em «Por aprovar»)
  async paraAprovar(ctx) {
    if (!ctx.actor.pode('publicacoes.aprovar')) return []
    const [titulos, lista] = await Promise.all([this.titulos(), this.interacoes.listarComentarios({ estado: 'revisto', limite: 500 })])
    return lista.map((c) => ({
      colecao: 'comentarios', id: String(c.id), titulo: `Comentário de ${c.nome}`, tipo: 'publicar', resumo: c.texto,
      destino: titulos[`${c.colecao}/${c.item_id}`] || c.item_id, pedidoPor: c.revistoPor, pedidoEm: c.revistoEm ?? c.data,
    }))
  }

  contarParaAprovar(ctx) {
    return ctx.actor.pode('publicacoes.aprovar') ? this.interacoes.contarComentarios('revisto') : 0
  }

  // para a equipa de comunicação: quantos esperam por ela
  contarPorRever(ctx) {
    return ctx.actor.pode('comentarios.aprovar') ? this.interacoes.contarComentarios('pendente') : 0
  }

  async decidir(ctx, id, { decisao, motivo }) {
    ctx.actor.exigir('publicacoes.aprovar')
    const c = await this.#comentario(id)
    if (c.estado !== 'revisto') throw new Conflito('Este comentário não está à espera do Comandante.')
    if (decisao === 'aprovar') {
      await this.#publicar(ctx, c, 'aprovar_comentario')
      return { aprovado: true }
    }
    if (String(motivo ?? '').trim().length < 3) throw new ErroValidacao('Escreva o motivo da recusa.', { campo: 'motivo' })
    await this.#recusar(ctx, c, motivo)
    return { aprovado: false }
  }

  async apagarComentario(ctx, id) {
    ctx.actor.exigir('comentarios.apagar')
    const c = await this.interacoes.comentario(id)
    if (!c) throw new NaoEncontrado('Comentário não encontrado.')
    await this.interacoes.apagarComentario(c.id)
    if (c.estado === 'publicado') this.tempoReal?.avisar('publico', { tipo: 'comentarios', colecao: c.colecao, id: c.item_id })
    await this.auditoria.registar(ctx, {
      acao: 'apagar_comentario', colecao: c.colecao, alvoId: c.item_id,
      alvoTitulo: `Comentário de ${c.nome}`, detalhes: { texto: c.texto.slice(0, 300) },
    })
  }
}
