import { Conflito, ErroValidacao, NaoEncontrado } from '../dominio/comum/erros.js'
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
// quem, além de quem gere a coleção, pode ler a lista (só ler)
const LEITURA_ALARGADA = {
  cursos: ['academico.ver'],
  pessoas: ['noticias.ver', 'artigos.ver', 'eventos.ver', 'paginas.ver'],
}

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

  async listarPublicados(colecao) {
    let itens = (await this.conteudos.listar(colecao, { soPublicados: true })).map((c) => c.dados)
    if (colecao === 'publicidade') {
      const hoje = this.relogio.agora().toISOString().slice(0, 10)
      itens = itens.filter((b) => bannerEmVigor(b, hoje))
    }
    return this.#ordenar(colecao, itens)
  }

  async todosPublicados() {
    const listas = await Promise.all(NOMES_COLECOES.map((c) => this.listarPublicados(c)))
    return Object.fromEntries(NOMES_COLECOES.map((c, i) => [c, listas[i]]))
  }

  // títulos de notícias, eventos e artigos (para mostrar comentários e estatísticas no painel)
  async titulosInterativos() {
    const titulos = {}
    for (const c of INTERATIVAS) {
      for (const it of await this.conteudos.listar(c)) titulos[`${c}/${it.id}`] = it.titulo
    }
    return titulos
  }

  // ---------- painel ----------

  async listar(ctx, colecao) {
    definicao(colecao)
    // a lista dos cursos serve também a gestão académica (turmas); a das pessoas, quem escolhe o autor de um texto
    ctx.actor.exigir(`${colecao}.ver`, ...(LEITURA_ALARGADA[colecao] ?? []))
    const [est, metricas, lista] = await Promise.all([
      this.interacoes.porItem(),
      colecao === 'publicidade' ? this.publicidade.metricas() : {},
      this.conteudos.listar(colecao),
    ])
    const chave = COLECOES[colecao].chave
    return this.#ordenar(colecao, lista.map(paraPainel)).map((it) => ({
      ...it,
      _estatisticas: est[`${colecao}/${it[chave]}`] || null,
      _metricas: colecao === 'publicidade' ? metricas[it[chave]] || { impressoes: 0, cliques: 0 } : undefined,
    }))
  }

  async ler(ctx, colecao, id) {
    definicao(colecao)
    ctx.actor.exigir(`${colecao}.ver`)
    const c = await this.conteudos.ler(colecao, id)
    if (!c) throw new NaoEncontrado('Item não encontrado.')
    return paraPainel(c)
  }

  async criar(ctx, colecao, corpo) {
    const def = definicao(colecao)
    ctx.actor.exigir(`${colecao}.criar`)
    const dados = this.#preparar(colecao, corpo)
    const estado = estadoFinal({ actor: ctx.actor, colecao, pedido: corpo?._estado, atual: null })
    const base = slugificar(dados[def.chave] || dados[def.titulo])

    // identificador único; se outro pedido o ocupar ao mesmo tempo, tenta o seguinte
    for (let n = 1; n < 50; n++) {
      const id = n === 1 ? base : `${base}-${n}`
      if (await this.conteudos.existe(colecao, id)) continue
      const c = new Conteudo({ colecao, id, dados: { ...dados, [def.chave]: id }, estado, ordem: await this.conteudos.proximaOrdem(colecao) })
      try {
        const criado = await this.conteudos.criar(c, ctx.actor.id)
        await this.auditoria.registar(ctx, { acao: 'criar', colecao, alvoId: id, alvoTitulo: c.titulo, detalhes: { estado } })
        if (estado === 'publicado') this.aoPublicar?.(colecao, id)
        return paraPainel(criado)
      } catch (erro) {
        if (!(erro instanceof Conflito)) throw erro
      }
    }
    throw new Conflito('Não foi possível gerar um identificador único. Mude o título.')
  }

  async editar(ctx, colecao, id, corpo) {
    const def = definicao(colecao)
    ctx.actor.exigir(`${colecao}.editar`, `${colecao}.publicar`)
    const atual = await this.conteudos.ler(colecao, id)
    if (!atual) throw new NaoEncontrado('Item não encontrado.')
    garantirPodeEditar({ actor: ctx.actor, colecao, atual: atual.estado, pedido: corpo?._estado })

    // quem só pode publicar muda o estado mas mantém os dados
    const dados = ctx.actor.pode(`${colecao}.editar`) ? this.#preparar(colecao, corpo) : { ...atual.dados }
    dados[def.chave] = atual.id // o identificador (endereço da página) não muda ao editar
    const estado = estadoFinal({ actor: ctx.actor, colecao, pedido: corpo?._estado, atual: atual.estado })
    const alterados = atual.camposAlterados(dados)

    const novo = new Conteudo({ ...atual, dados, estado })
    const guardado = await this.conteudos.guardar(novo, ctx.actor.id)
    const acao = estado !== atual.estado ? (estado === 'publicado' ? 'publicar' : 'despublicar') : 'editar'
    await this.auditoria.registar(ctx, { acao, colecao, alvoId: id, alvoTitulo: novo.titulo, detalhes: { campos: alterados } })
    if (estado === 'publicado') this.aoPublicar?.(colecao, id) // tradução automática do que mudou
    return paraPainel(guardado)
  }

  async apagar(ctx, colecao, id) {
    definicao(colecao)
    ctx.actor.exigir(`${colecao}.apagar`)
    const atual = await this.conteudos.ler(colecao, id)
    if (!atual) throw new NaoEncontrado('Item não encontrado.')
    await this.conteudos.apagar(colecao, id)
    await this.auditoria.registar(ctx, { acao: 'apagar', colecao, alvoId: id, alvoTitulo: atual.titulo })
  }

  // ordem manual de cursos, pessoas e banners
  async reordenar(ctx, colecao, ids) {
    definicao(colecao)
    ctx.actor.exigir(`${colecao}.editar`)
    if (new Set(ids).size !== ids.length) throw new ErroValidacao('A lista tem identificadores repetidos.')
    const existentes = []
    for (const id of ids) if (await this.conteudos.existe(colecao, id)) existentes.push(id)
    await this.conteudos.reordenar(colecao, existentes)
    await this.auditoria.registar(ctx, { acao: 'reordenar', colecao, detalhes: { ids: existentes } })
  }
}
