import { relativizar } from '../dominio/comum/urls.js'
import { PAGINAS, validarPagina } from '../dominio/conteudos/paginas.js'
import { NaoEncontrado } from '../dominio/comum/erros.js'

// Conteúdo editável das páginas (início, instituição, contactos, cursos)
export class ServicoPaginas {
  constructor({ paginas, auditoria, filtroHtml }) {
    Object.assign(this, { paginas, auditoria, filtroHtml })
  }

  #existe(chave) {
    if (!PAGINAS.includes(chave)) throw new NaoEncontrado('Página desconhecida.')
  }

  async todas() {
    const dados = await Promise.all(PAGINAS.map((p) => this.paginas.ler(p)))
    return Object.fromEntries(PAGINAS.map((p, i) => [p, dados[i]]))
  }

  async ler(ctx, chave) {
    ctx.actor.exigir('paginas.ver')
    this.#existe(chave)
    return (await this.paginas.ler(chave)) || {}
  }

  async guardar(ctx, chave, corpo) {
    ctx.actor.exigir('paginas.editar')
    this.#existe(chave)
    const dados = relativizar(this.filtroHtml(validarPagina(chave, corpo)))
    await this.paginas.guardar(chave, dados, ctx.actor.id)
    await this.auditoria.registar(ctx, { acao: 'editar_pagina', colecao: 'paginas', alvoId: chave, alvoTitulo: `Página ${chave}` })
    this.aoPublicar?.('paginas', chave) // tradução automática do que mudou
    return this.paginas.ler(chave)
  }
}
