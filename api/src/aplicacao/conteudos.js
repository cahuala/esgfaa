import { ErroValidacao, NaoEncontrado } from '../dominio/comum/erros.js'
import { slugificar } from '../dominio/comum/texto.js'
import { relativizar } from '../dominio/comum/urls.js'
import { COLECOES, INTERATIVAS, NOMES_COLECOES, definicao, validarDados } from '../dominio/conteudos/colecoes.js'
import { Conteudo } from '../dominio/conteudos/conteudo.js'
import { estadoFinal, garantirPodeEditar } from '../dominio/conteudos/politicaPublicacao.js'
import { bannerEmVigor } from '../dominio/publicidade/banner.js'

const paraPainel = (c) => ({
  ...c.dados, _estado: c.estado, _ordem: c.ordem, _criado: c.criadoEm, _atualizado: c.atualizadoEm, _editadoPor: c.editadoPor,
})

// Notícias, artigos, eventos, cursos, pessoas e banners
export class ServicoConteudos {
  constructor({ conteudos, interacoes, publicidade, auditoria, filtroHtml, relogio }) {
    Object.assign(this, { conteudos, interacoes, publicidade, auditoria, filtroHtml, relogio })
  }

  #ordenar(colecao, itens) {
    const { ordenar } = COLECOES[colecao]
    return ordenar ? itens.sort(ordenar) : itens
  }

  // dados enviados pelo painel -> dados seguros para guardar
  #preparar(colecao, corpo) {
    return relativizar(this.filtroHtml(validarDados(colecao, corpo)))
  }

  // ---------- site público ----------

  listarPublicados(colecao) {
    let itens = this.conteudos.listar(colecao, { soPublicados: true }).map((c) => c.dados)
    if (colecao === 'publicidade') {
      const hoje = this.relogio.agora().toISOString().slice(0, 10)
      itens = itens.filter((b) => bannerEmVigor(b, hoje))
    }
    return this.#ordenar(colecao, itens)
  }

  todosPublicados() {
    return Object.fromEntries(NOMES_COLECOES.map((c) => [c, this.listarPublicados(c)]))
  }

  // títulos de notícias, eventos e artigos (para mostrar comentários e estatísticas no painel)
  titulosInterativos() {
    const titulos = {}
    for (const c of INTERATIVAS) {
      for (const it of this.conteudos.listar(c)) titulos[`${c}/${it.id}`] = it.titulo
    }
    return titulos
  }

  // ---------- painel ----------

  listar(ctx, colecao) {
    definicao(colecao)
    ctx.actor.exigir(`${colecao}.ver`)
    const est = this.interacoes.porItem()
    const metricas = colecao === 'publicidade' ? this.publicidade.metricas() : {}
    const itens = this.#ordenar(colecao, this.conteudos.listar(colecao).map(paraPainel))
    const chave = COLECOES[colecao].chave
    return itens.map((it) => ({
      ...it,
      _estatisticas: est[`${colecao}/${it[chave]}`] || null,
      _metricas: colecao === 'publicidade' ? metricas[it[chave]] || { impressoes: 0, cliques: 0 } : undefined,
    }))
  }

  ler(ctx, colecao, id) {
    definicao(colecao)
    ctx.actor.exigir(`${colecao}.ver`)
    const c = this.conteudos.ler(colecao, id)
    if (!c) throw new NaoEncontrado('Item não encontrado.')
    return paraPainel(c)
  }

  criar(ctx, colecao, corpo) {
    const def = definicao(colecao)
    ctx.actor.exigir(`${colecao}.criar`)
    const dados = this.#preparar(colecao, corpo)

    const base = slugificar(dados[def.chave] || dados[def.titulo])
    let id = base
    for (let n = 2; this.conteudos.existe(colecao, id); n++) id = `${base}-${n}`
    dados[def.chave] = id

    const estado = estadoFinal({ actor: ctx.actor, colecao, pedido: corpo?._estado, atual: null })
    const c = new Conteudo({ colecao, id, dados, estado, ordem: this.conteudos.proximaOrdem(colecao) })
    const criado = this.conteudos.criar(c, ctx.actor.id)
    this.auditoria.registar(ctx, { acao: 'criar', colecao, alvoId: id, alvoTitulo: c.titulo, detalhes: { estado } })
    return paraPainel(criado)
  }

  editar(ctx, colecao, id, corpo) {
    const def = definicao(colecao)
    ctx.actor.exigir(`${colecao}.editar`, `${colecao}.publicar`)
    const atual = this.conteudos.ler(colecao, id)
    if (!atual) throw new NaoEncontrado('Item não encontrado.')
    garantirPodeEditar({ actor: ctx.actor, colecao, atual: atual.estado, pedido: corpo?._estado })

    // quem só pode publicar muda o estado mas mantém os dados
    const dados = ctx.actor.pode(`${colecao}.editar`) ? this.#preparar(colecao, corpo) : { ...atual.dados }
    dados[def.chave] = atual.id // o identificador (endereço da página) não muda ao editar
    const estado = estadoFinal({ actor: ctx.actor, colecao, pedido: corpo?._estado, atual: atual.estado })
    const alterados = atual.camposAlterados(dados)

    const novo = new Conteudo({ ...atual, dados, estado })
    const guardado = this.conteudos.guardar(novo, ctx.actor.id)
    const acao = estado !== atual.estado ? (estado === 'publicado' ? 'publicar' : 'despublicar') : 'editar'
    this.auditoria.registar(ctx, { acao, colecao, alvoId: id, alvoTitulo: novo.titulo, detalhes: { campos: alterados } })
    return paraPainel(guardado)
  }

  apagar(ctx, colecao, id) {
    definicao(colecao)
    ctx.actor.exigir(`${colecao}.apagar`)
    const atual = this.conteudos.ler(colecao, id)
    if (!atual) throw new NaoEncontrado('Item não encontrado.')
    this.conteudos.apagar(colecao, id)
    this.auditoria.registar(ctx, { acao: 'apagar', colecao, alvoId: id, alvoTitulo: atual.titulo })
  }

  // ordem manual de cursos, pessoas e banners
  reordenar(ctx, colecao, ids) {
    definicao(colecao)
    ctx.actor.exigir(`${colecao}.editar`)
    if (new Set(ids).size !== ids.length) throw new ErroValidacao('A lista tem identificadores repetidos.')
    const existentes = ids.filter((id) => this.conteudos.existe(colecao, id))
    this.conteudos.reordenar(colecao, existentes)
    this.auditoria.registar(ctx, { acao: 'reordenar', colecao, detalhes: { ids: existentes } })
  }
}
