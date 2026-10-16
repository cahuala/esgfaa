import { ErroValidacao, NaoEncontrado } from '../../dominio/comum/erros.js'
import { PAGINAS } from '../../dominio/conteudos/paginas.js'
import { COLECOES_TRADUZIVEIS, ESTADOS_TRADUCAO, LINGUAS, desatualizados, extrairTextos, limparTextos } from '../../dominio/traducoes/textos.js'
import { traduzirComClaude } from './traducaoIA.js'

/*
  Traduções do site: a redação traduz (ou pede à IA um rascunho), revê e publica cada língua.
  O site mostra a tradução publicada; o que não estiver traduzido aparece em português.
*/
export class ServicoTraducoes {
  constructor({ traducoes, conteudos, paginas, claude = null, auditoria }) {
    Object.assign(this, { traducoes, conteudos, paginas, claude, auditoria })
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
    return { linguas: LINGUAS, estados: ESTADOS_TRADUCAO, originais, traducoes, ia: Boolean(this.claude), podeEditar: ctx.actor.pode(a.editar), podePublicar: ctx.actor.pode(a.publicar) }
  }

  // rascunho feito pela IA: traduz o que falta e o que mudou no original (mantém o que a redação já reviu)
  async traduzirIA(ctx, colecao, id, lingua) {
    this.#lingua(lingua)
    const a = await this.#alvo(colecao, id)
    ctx.actor.exigir(a.editar)
    if (!this.claude) throw new ErroValidacao('A tradução automática não está ativa (falta a chave ANTHROPIC_API_KEY no servidor). Pode traduzir à mão.')
    const originais = extrairTextos(a.dados)
    const atual = await this.traducoes.ler(colecao, id, lingua)
    const mudados = atual ? new Set(desatualizados(atual.originais, originais)) : null
    const pedir = Object.fromEntries(Object.entries(originais).filter(([c]) => !atual || !atual.textos[c] || mudados.has(c)))
    const novos = Object.keys(pedir).length ? await traduzirComClaude(this.claude, pedir, lingua) : {}
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
    const atual = await this.traducoes.ler(colecao, id, lingua)
    const t = await this.traducoes.guardar({
      colecao, alvoId: id, lingua, textos: limpos, originais: Object.fromEntries(Object.keys(limpos).map((c) => [c, originais[c]])),
      estado, automatica: atual?.automatica ?? false, atualizadoPor: ctx.actor.nome || '',
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
    for (const t of await this.traducoes.publicadas()) (itens[`${t.colecao}/${t.alvoId}`] ||= {})[t.lingua] = t.textos
    return { linguas: LINGUAS, itens }
  }
}
