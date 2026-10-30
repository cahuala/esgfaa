import { Conflito, ErroValidacao, NaoEncontrado } from '../dominio/comum/erros.js'
import { slugificar } from '../dominio/comum/texto.js'
import { relativizar } from '../dominio/comum/urls.js'
import { COLECOES, INTERATIVAS, NOMES_COLECOES, definicao, validarDados } from '../dominio/conteudos/colecoes.js'
import { Conteudo } from '../dominio/conteudos/conteudo.js'
import { estadoFinal, garantirPodeEditar, pedidoDeAprovacao, podeAprovar } from '../dominio/conteudos/politicaPublicacao.js'
import { bannerEmVigor } from '../dominio/publicidade/banner.js'

// no painel, quem edita continua a partir do que propôs (à espera do Comandante ou recusado)
const paraPainel = (c) => ({
  ...(c.aprovacao?.dados ?? c.dados), _estado: c.estado, _ordem: c.ordem, _criado: c.criadoEm, _atualizado: c.atualizadoEm, _editadoPor: c.editadoPor,
  _aprovacao: c.aprovacao ? { estado: c.aprovacao.estado, tipo: c.aprovacao.tipo, pedidoPor: c.aprovacao.pedidoPor, pedidoEm: c.aprovacao.pedidoEm, decididoPor: c.aprovacao.decididoPor, decididoEm: c.aprovacao.decididoEm, motivo: c.aprovacao.motivo } : null,
})

// Notícias, artigos, eventos, cursos, pessoas e banners
// quem, além de quem gere a coleção, pode ler a lista (só ler)
const LEITURA_ALARGADA = {
  cursos: ['academico.ver'],
  pessoas: ['noticias.ver', 'artigos.ver', 'eventos.ver', 'paginas.ver', 'cursos.ver'],
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
    let estado = estadoFinal({ actor: ctx.actor, colecao, pedido: corpo?._estado, atual: null })
    // sem aprovar publicações: fica em rascunho e o pedido vai ao Comandante
    let aprovacao = null
    if (estado === 'publicado' && !podeAprovar(ctx.actor)) {
      estado = 'rascunho'
      aprovacao = pedidoDeAprovacao({ actor: ctx.actor, tipo: 'publicar', dados: null, quando: this.relogio?.agora?.() ?? new Date() })
    }
    const base = slugificar(dados[def.chave] || dados[def.titulo])

    // identificador único; se outro pedido o ocupar ao mesmo tempo, tenta o seguinte
    for (let n = 1; n < 50; n++) {
      const id = n === 1 ? base : `${base}-${n}`
      if (await this.conteudos.existe(colecao, id)) continue
      const c = new Conteudo({ colecao, id, dados: { ...dados, [def.chave]: id }, estado, ordem: await this.conteudos.proximaOrdem(colecao), aprovacao })
      try {
        const criado = await this.conteudos.criar(c, ctx.actor.id)
        await this.auditoria.registar(ctx, { acao: aprovacao ? 'pedir_aprovacao' : 'criar', colecao, alvoId: id, alvoTitulo: c.titulo, detalhes: { estado } })
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

    // sem aprovar publicações: publicar ou alterar o que está publicado é um pedido ao Comandante
    if (!podeAprovar(ctx.actor) && estado === 'publicado') {
      const quando = this.relogio?.agora?.() ?? new Date()
      if (atual.estado === 'publicado' && !alterados.length && !atual.aprovacao) return paraPainel(atual)
      const proposta = atual.estado === 'publicado'
        ? new Conteudo({ ...atual, aprovacao: pedidoDeAprovacao({ actor: ctx.actor, tipo: 'alterar', dados, quando }) }) // o site mantém a versão aprovada
        : new Conteudo({ ...atual, dados, estado: 'rascunho', aprovacao: pedidoDeAprovacao({ actor: ctx.actor, tipo: 'publicar', dados: null, quando }) })
      const guardado = await this.conteudos.guardar(proposta, ctx.actor.id)
      await this.auditoria.registar(ctx, { acao: 'pedir_aprovacao', colecao, alvoId: id, alvoTitulo: proposta.titulo, detalhes: { campos: alterados } })
      return paraPainel(guardado)
    }

    // guardar como rascunho (ou retirar do site) desfaz um pedido em aberto
    const novo = new Conteudo({ ...atual, dados, estado, aprovacao: null })
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

  // ---------- aprovação do Comandante ----------

  async paraAprovar(ctx) {
    ctx.actor.exigir('publicacoes.aprovar')
    return (await this.conteudos.pendentes()).map((c) => ({
      colecao: c.colecao, id: c.id, titulo: (c.aprovacao.dados ?? c.dados)[definicao(c.colecao).titulo], tipo: c.aprovacao.tipo,
      pedidoPor: c.aprovacao.pedidoPor, pedidoEm: c.aprovacao.pedidoEm, estadoAtual: c.estado,
      dados: c.aprovacao.dados ?? c.dados, publicados: c.aprovacao.tipo === 'alterar' ? c.dados : null,
    })).sort((a, b) => String(a.pedidoEm).localeCompare(String(b.pedidoEm)))
  }

  async decidirPublicacao(ctx, colecao, id, { decisao, motivo }) {
    ctx.actor.exigir('publicacoes.aprovar')
    definicao(colecao)
    const atual = await this.conteudos.ler(colecao, id)
    if (!atual) throw new NaoEncontrado('Item não encontrado.')
    if (atual.aprovacao?.estado !== 'pendente') throw new Conflito('Este conteúdo não está à espera de aprovação.')
    const quando = (this.relogio?.agora?.() ?? new Date()).toISOString()
    if (decisao === 'aprovar') {
      const novo = new Conteudo({ ...atual, dados: atual.aprovacao.dados ?? atual.dados, estado: 'publicado', aprovacao: null })
      const guardado = await this.conteudos.guardar(novo, ctx.actor.id)
      await this.auditoria.registar(ctx, { acao: 'aprovar_publicacao', colecao, alvoId: id, alvoTitulo: novo.titulo, detalhes: { tipo: atual.aprovacao.tipo, pedidoPor: atual.aprovacao.pedidoPor } })
      this.aoPublicar?.(colecao, id)
      return paraPainel(guardado)
    }
    const m = String(motivo ?? '').trim()
    if (m.length < 3) throw new ErroValidacao('Escreva o motivo da recusa.', { campo: 'motivo' })
    const novo = new Conteudo({ ...atual, aprovacao: { ...atual.aprovacao, estado: 'recusado', motivo: m.slice(0, 1000), decididoPor: ctx.actor.nome ?? '', decididoEm: quando } })
    const guardado = await this.conteudos.guardar(novo, ctx.actor.id)
    await this.auditoria.registar(ctx, { acao: 'recusar_publicacao', colecao, alvoId: id, alvoTitulo: novo.titulo, detalhes: { motivo: m } })
    return paraPainel(guardado)
  }

  contarParaAprovar(ctx) {
    return ctx.actor.pode('publicacoes.aprovar') ? this.conteudos.contarPendentes() : 0
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
