import { ErroValidacao, NaoEncontrado } from '../../dominio/comum/erros.js'
import { PAGINAS } from '../../dominio/conteudos/paginas.js'
import { COLECOES_TRADUZIVEIS, ESTADOS_TRADUCAO, LINGUAS, desatualizados, extrairTextos, limparTextos } from '../../dominio/traducoes/textos.js'

/*
  Traduções do site: a redação traduz (ou pede à IA um rascunho), revê e publica cada língua.
  O site mostra a tradução publicada; o que não estiver traduzido aparece em português.
*/
// os originais guardados só dos textos que a tradução ainda tem
// o tradutor automático às vezes deixa espaços à volta do apóstrofo («L ' École», «d ' officiers»)
const arrumar = (textos) => Object.fromEntries(Object.entries(textos || {}).map(([c, t]) => [c, typeof t === 'string' ? t.replace(/(\p{L}) ' (\p{L})/gu, "$1'$2") : t]))
const limparOriginais = (originais, textos) => Object.fromEntries(Object.entries(originais || {}).filter(([c]) => c in textos))

export class ServicoTraducoes {
  #fila = Promise.resolve()

  // tradutor: { nome, traduzirMapa(mapa, lingua) } — o Claude ou o LibreTranslate (ou nenhum)
  constructor({ traducoes, conteudos, paginas, tradutor = null, auditoria, registarErro }) {
    Object.assign(this, { traducoes, conteudos, paginas, tradutor, auditoria, registarErro })
  }

  #agendarTarefa(nome, f) {
    const p = this.#fila.then(f).catch((e) => this.registarErro?.({ nivel: 'erro', mensagem: `Traduções: ${nome}`, erro: e.message }))
    this.#fila = p
    return p
  }

  esvaziar() {
    return this.#fila
  }

  // tradução automática de um conteúdo publicado: o que falta e o que mudou, em todas as línguas.
  // Uma tradução nova fica logo publicada (marcada como automática); a revisão da redação mantém-se.
  agendar(colecao, id) {
    if (!this.tradutor) return Promise.resolve()
    return this.#agendarTarefa('automática', () => this.#automatica(colecao, id))
  }

  async #automatica(colecao, id) {
    const a = await this.#alvo(colecao, id).catch(() => null)
    if (!a) return
    const originais = extrairTextos(a.dados)
    if (!Object.keys(originais).length) return
    for (const lingua of Object.keys(LINGUAS)) {
      const atual = await this.traducoes.ler(colecao, id, lingua)
      const mudados = atual ? new Set(desatualizados(atual.originais, originais)) : null
      const pedir = Object.fromEntries(Object.entries(originais).filter(([c]) => !atual || !atual.textos[c] || mudados.has(c)))
      if (!Object.keys(pedir).length) {
        // nada para traduzir, mas pode haver textos que deixaram de se traduzir (ex.: nomes com posto): tiram-se
        const limpos = atual && limparTextos(atual.textos, originais)
        if (limpos && Object.keys(limpos).length !== Object.keys(atual.textos).length) {
          await this.traducoes.guardar({ colecao, alvoId: id, lingua, textos: limpos, originais: limparOriginais(atual.originais, limpos), estado: atual.estado, automatica: atual.automatica, atualizadoPor: atual.atualizadoPor })
        }
        continue
      }
      const novos = arrumar(await this.tradutor.traduzirMapa(pedir, lingua))
      await this.traducoes.guardar({
        colecao, alvoId: id, lingua,
        textos: limparTextos({ ...(atual?.textos || {}), ...novos }, originais),
        originais: limparOriginais({ ...(atual?.originais || {}), ...Object.fromEntries(Object.keys(novos).map((c) => [c, originais[c]])) }, limparTextos({ ...(atual?.textos || {}), ...novos }, originais)),
        estado: atual?.estado ?? 'publicada', automatica: atual?.automatica ?? true, atualizadoPor: this.tradutor.nome,
      })
    }
  }

  // completa as traduções de tudo o que está publicado (no arranque e a pedido no painel)
  async completar() {
    if (!this.tradutor) return { itens: 0 }
    let n = 0
    for (const colecao of COLECOES_TRADUZIVEIS) {
      for (const c of await this.conteudos.listar(colecao, { soPublicados: true })) { this.agendar(colecao, c.id); n++ }
    }
    for (const p of PAGINAS) { this.agendar('paginas', p); n++ }
    return { itens: n }
  }

  async traduzirTudo(ctx) {
    ctx.actor.exigir('paginas.editar', 'noticias.publicar')
    if (!this.tradutor) throw new ErroValidacao('Não há tradutor automático configurado (LIBRETRANSLATE_URL ou ANTHROPIC_API_KEY).')
    return this.completar()
  }

  // o original e as permissões que se aplicam (coleção ou página)
  async #alvo(colecao, id) {
    if (colecao === 'paginas') {
      if (!PAGINAS.includes(id)) throw new NaoEncontrado('Página desconhecida.')
      return { dados: (await this.paginas.ler(id)) || {}, titulo: `Página ${id}`, ver: 'paginas.ver', editar: 'paginas.editar', publicar: 'paginas.editar' }
    }
    if (!COLECOES_TRADUZIVEIS.includes(colecao)) throw new NaoEncontrado('Este conteúdo não se traduz.')
    const c = await this.conteudos.ler(colecao, id)
    if (!c) throw new NaoEncontrado('Item não encontrado.')
    return { dados: c.dados, titulo: c.titulo, ver: `${colecao}.ver`, editar: `${colecao}.editar`, publicar: `${colecao}.publicar` }
  }

  #lingua(lingua) {
    if (!LINGUAS[lingua]) throw new ErroValidacao('Língua desconhecida.', { campo: 'lingua' })
  }

  async estado(ctx, colecao, id) {
    const a = await this.#alvo(colecao, id)
    ctx.actor.exigir(a.ver)
    const originais = extrairTextos(a.dados)
    const lista = await this.traducoes.doAlvo(colecao, id)
    const traducoes = Object.fromEntries(lista.map((t) => [t.lingua, {
      ...t, desatualizados: desatualizados(t.originais, originais).filter((c) => c in t.textos), emFalta: Object.keys(originais).filter((c) => !t.textos[c]),
    }]))
    return { linguas: LINGUAS, estados: ESTADOS_TRADUCAO, originais, traducoes, ia: Boolean(this.tradutor), tradutor: this.tradutor?.nome || '', podeEditar: ctx.actor.pode(a.editar), podePublicar: ctx.actor.pode(a.publicar) }
  }

  // rascunho feito pela IA: traduz o que falta e o que mudou no original (mantém o que a redação já reviu)
  async traduzirIA(ctx, colecao, id, lingua) {
    this.#lingua(lingua)
    const a = await this.#alvo(colecao, id)
    ctx.actor.exigir(a.editar)
    if (!this.tradutor) throw new ErroValidacao('A tradução automática não está ativa (falta configurar LIBRETRANSLATE_URL ou ANTHROPIC_API_KEY no servidor). Pode traduzir à mão.')
    const originais = extrairTextos(a.dados)
    const atual = await this.traducoes.ler(colecao, id, lingua)
    const mudados = atual ? new Set(desatualizados(atual.originais, originais)) : null
    const pedir = Object.fromEntries(Object.entries(originais).filter(([c]) => !atual || !atual.textos[c] || mudados.has(c)))
    const novos = Object.keys(pedir).length ? arrumar(await this.tradutor.traduzirMapa(pedir, lingua)) : {}
    const textos = limparTextos({ ...(atual?.textos || {}), ...novos }, originais)
    const t = await this.traducoes.guardar({
      colecao, alvoId: id, lingua, textos, originais: { ...(atual?.originais || {}), ...Object.fromEntries(Object.keys(novos).map((c) => [c, originais[c]])) },
      estado: 'rascunho', automatica: true, atualizadoPor: ctx.actor.nome || '',
    })
    await this.auditoria.registar(ctx, { acao: 'traduzir_ia', colecao, alvoId: id, alvoTitulo: a.titulo, detalhes: { lingua, textos: Object.keys(novos).length } })
    return { traduzidos: Object.keys(novos).length, traducao: t }
  }

  async guardar(ctx, colecao, id, lingua, { textos, estado = 'rascunho' }) {
    this.#lingua(lingua)
    if (!ESTADOS_TRADUCAO[estado]) throw new ErroValidacao('Estado desconhecido.', { campo: 'estado' })
    const a = await this.#alvo(colecao, id)
    ctx.actor.exigir(a.editar)
    if (estado === 'publicada') ctx.actor.exigir(a.publicar)
    const originais = extrairTextos(a.dados)
    const limpos = limparTextos(textos, originais)
    // o título (ou nome) tem de estar traduzido para publicar
    const principal = ['titulo', 'nome'].find((c) => c in originais)
    if (estado === 'publicada' && principal && !limpos[principal]) throw new ErroValidacao('Traduza pelo menos o título antes de publicar.', { campo: principal })
    const t = await this.traducoes.guardar({
      colecao, alvoId: id, lingua, textos: limpos, originais: Object.fromEntries(Object.keys(limpos).map((c) => [c, originais[c]])),
      estado, automatica: false, atualizadoPor: ctx.actor.nome || '', // revista pela redação
    })
    await this.auditoria.registar(ctx, { acao: estado === 'publicada' ? 'publicar_traducao' : 'guardar_traducao', colecao, alvoId: id, alvoTitulo: a.titulo, detalhes: { lingua } })
    return t
  }

  async apagar(ctx, colecao, id, lingua) {
    this.#lingua(lingua)
    const a = await this.#alvo(colecao, id)
    ctx.actor.exigir(a.editar)
    await this.traducoes.apagar(colecao, id, lingua)
    await this.auditoria.registar(ctx, { acao: 'apagar_traducao', colecao, alvoId: id, alvoTitulo: a.titulo, detalhes: { lingua } })
  }

  async estadosDaColecao(ctx, colecao) {
    if (colecao !== 'paginas' && !COLECOES_TRADUZIVEIS.includes(colecao)) throw new NaoEncontrado('Este conteúdo não se traduz.')
    ctx.actor.exigir(colecao === 'paginas' ? 'paginas.ver' : `${colecao}.ver`)
    return this.traducoes.estados(colecao)
  }

  // para o site: { linguas, itens: { "noticias/slug": { en: {caminho: texto} } } } (só as publicadas)
  async publicas() {
    const itens = {}
    const automaticas = {}
    for (const t of await this.traducoes.publicadas()) {
      const k = `${t.colecao}/${t.alvoId}`;
      (itens[k] ||= {})[t.lingua] = t.textos
      if (t.automatica) (automaticas[k] ||= []).push(t.lingua)
    }
    return { linguas: LINGUAS, itens, automaticas }
  }
}
