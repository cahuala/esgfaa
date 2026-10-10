import { ErroValidacao, NaoEncontrado } from '../dominio/comum/erros.js'
import { INTERATIVAS } from '../dominio/conteudos/colecoes.js'
import { novoComentario, visitanteValido } from '../dominio/interacao/comentario.js'

// Gostos, comentários e visualizações do público; moderação no painel
export class ServicoInteracoes {
  constructor({ interacoes, conteudos, auditoria, vistasRecentes, titulos }) {
    Object.assign(this, { interacoes, conteudos, auditoria, vistasRecentes, titulos })
  }

  // só se interage com notícias, eventos e artigos publicados
  #garantirItem(colecao, id) {
    if (!INTERATIVAS.includes(colecao)) throw new NaoEncontrado('Coleção inválida.')
    if (!this.conteudos.publicadoExiste(colecao, id)) throw new NaoEncontrado('Conteúdo não encontrado.')
  }

  resumo(colecao, id, visitante) {
    this.#garantirItem(colecao, id)
    return this.interacoes.resumo(colecao, id, visitanteValido(visitante) ? visitante : null)
  }

  // no máximo uma visualização por visitante a cada 30 min para o mesmo item
  registarVisualizacao(colecao, id, visitante, ip) {
    this.#garantirItem(colecao, id)
    const quem = visitanteValido(visitante) ? visitante : ip
    if (this.vistasRecentes.marcarSeNova(`${colecao}/${id}/${quem}`)) this.interacoes.contarVisualizacao(colecao, id)
  }

  alternarGosto(colecao, id, visitante) {
    this.#garantirItem(colecao, id)
    if (!visitanteValido(visitante)) throw new ErroValidacao('Identificador de visitante inválido.')
    this.interacoes.alternarGosto(colecao, id, visitante)
    return this.interacoes.resumo(colecao, id, visitante)
  }

  comentar(colecao, id, { nome, texto, visitante }, ip) {
    this.#garantirItem(colecao, id)
    this.interacoes.comentar(colecao, id, novoComentario({ nome, texto }), ip)
    return this.interacoes.resumo(colecao, id, visitanteValido(visitante) ? visitante : null)
  }

  // gostos, comentários e visualizações de cada item (mostrados nas listagens do site)
  contagens() {
    return this.interacoes.porItem()
  }

  // ---------- painel ----------

  listarComentarios(ctx) {
    ctx.actor.exigir('comentarios.ver')
    const titulos = this.titulos()
    return this.interacoes.listarComentarios({ limite: 2000 }).map((c) => ({ ...c, tituloItem: titulos[`${c.colecao}/${c.item_id}`] || c.item_id }))
  }

  apagarComentario(ctx, id) {
    ctx.actor.exigir('comentarios.apagar')
    const c = this.interacoes.comentario(id)
    if (!c) throw new NaoEncontrado('Comentário não encontrado.')
    this.interacoes.apagarComentario(c.id)
    this.auditoria.registar(ctx, {
      acao: 'apagar_comentario', colecao: c.colecao, alvoId: c.item_id,
      alvoTitulo: `Comentário de ${c.nome}`, detalhes: { texto: c.texto.slice(0, 300) },
    })
  }
}
