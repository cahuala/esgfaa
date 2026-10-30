import { relativizar } from '../dominio/comum/urls.js'
import { PAGINAS, validarPagina } from '../dominio/conteudos/paginas.js'
import { Conflito, ErroValidacao, NaoEncontrado } from '../dominio/comum/erros.js'
import { pedidoDeAprovacao, podeAprovar } from '../dominio/conteudos/politicaPublicacao.js'

// Conteúdo editável das páginas (início, instituição, contactos, cursos)
export class ServicoPaginas {
  constructor({ paginas, auditoria, filtroHtml, relogio }) {
    Object.assign(this, { paginas, auditoria, filtroHtml, relogio })
  }

  #existe(chave) {
    if (!PAGINAS.includes(chave)) throw new NaoEncontrado('Página desconhecida.')
  }

  async todas() {
    const dados = await Promise.all(PAGINAS.map((p) => this.paginas.ler(p)))
    return Object.fromEntries(PAGINAS.map((p, i) => [p, dados[i]]))
  }

  #agora() {
    return this.relogio?.agora?.() ?? new Date()
  }

  // no painel: continua a partir da alteração proposta (à espera do Comandante ou recusada)
  async ler(ctx, chave) {
    ctx.actor.exigir('paginas.ver')
    this.#existe(chave)
    const [dados, aprovacao] = await Promise.all([this.paginas.ler(chave), this.paginas.aprovacao(chave)])
    if (!aprovacao) return dados || {}
    const { dados: propostos, ...resto } = aprovacao
    return { ...(propostos ?? dados ?? {}), _aprovacao: resto }
  }

  async guardar(ctx, chave, corpo) {
    ctx.actor.exigir('paginas.editar')
    this.#existe(chave)
    const { _aprovacao, ...limpo } = corpo ?? {}
    void _aprovacao
    const dados = relativizar(this.filtroHtml(validarPagina(chave, limpo)))
    // sem aprovar publicações: a alteração fica à espera do Comandante e o site mantém a versão atual
    if (!podeAprovar(ctx.actor)) {
      await this.paginas.guardarAprovacao(chave, pedidoDeAprovacao({ actor: ctx.actor, tipo: 'alterar', dados, quando: this.#agora() }), ctx.actor.id)
      await this.auditoria.registar(ctx, { acao: 'pedir_aprovacao', colecao: 'paginas', alvoId: chave, alvoTitulo: `Página ${chave}` })
      return this.ler(ctx, chave)
    }
    await this.paginas.guardar(chave, dados, ctx.actor.id)
    await this.auditoria.registar(ctx, { acao: 'editar_pagina', colecao: 'paginas', alvoId: chave, alvoTitulo: `Página ${chave}` })
    this.aoPublicar?.('paginas', chave) // tradução automática do que mudou
    return this.paginas.ler(chave)
  }

  // ---------- aprovação do Comandante ----------

  async paraAprovar(ctx) {
    ctx.actor.exigir('publicacoes.aprovar')
    const l = await this.paginas.pendentes()
    return l.map((p) => ({ colecao: 'paginas', id: p.chave, titulo: `Página ${p.chave}`, tipo: 'alterar', pedidoPor: p.aprovacao.pedidoPor, pedidoEm: p.aprovacao.pedidoEm, dados: p.aprovacao.dados, publicados: p.dados }))
  }

  async decidir(ctx, chave, { decisao, motivo }) {
    ctx.actor.exigir('publicacoes.aprovar')
    this.#existe(chave)
    const aprovacao = await this.paginas.aprovacao(chave)
    if (aprovacao?.estado !== 'pendente') throw new Conflito('Esta página não tem alterações à espera de aprovação.')
    if (decisao === 'aprovar') {
      await this.paginas.guardar(chave, aprovacao.dados, ctx.actor.id)
      await this.auditoria.registar(ctx, { acao: 'aprovar_publicacao', colecao: 'paginas', alvoId: chave, alvoTitulo: `Página ${chave}`, detalhes: { pedidoPor: aprovacao.pedidoPor } })
      this.aoPublicar?.('paginas', chave)
      return { aprovado: true }
    }
    const m = String(motivo ?? '').trim()
    if (m.length < 3) throw new ErroValidacao('Escreva o motivo da recusa.', { campo: 'motivo' })
    await this.paginas.guardarAprovacao(chave, { ...aprovacao, estado: 'recusado', motivo: m.slice(0, 1000), decididoPor: ctx.actor.nome ?? '', decididoEm: this.#agora().toISOString() }, ctx.actor.id)
    await this.auditoria.registar(ctx, { acao: 'recusar_publicacao', colecao: 'paginas', alvoId: chave, alvoTitulo: `Página ${chave}`, detalhes: { motivo: m } })
    return { aprovado: false }
  }

  contarParaAprovar(ctx) {
    return ctx.actor.pode('publicacoes.aprovar') ? this.paginas.contarPendentes() : 0
  }
}
