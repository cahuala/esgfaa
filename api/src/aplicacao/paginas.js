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

  todas() {
    return Object.fromEntries(PAGINAS.map((p) => [p, this.paginas.ler(p)]))
  }

  ler(ctx, chave) {
    ctx.actor.exigir('paginas.ver')
    this.#existe(chave)
    return this.paginas.ler(chave) || {}
  }

  guardar(ctx, chave, corpo) {
    ctx.actor.exigir('paginas.editar')
    this.#existe(chave)
    const dados = relativizar(this.filtroHtml(validarPagina(chave, corpo)))
    this.paginas.guardar(chave, dados, ctx.actor.id)
    this.auditoria.registar(ctx, { acao: 'editar_pagina', colecao: 'paginas', alvoId: chave, alvoTitulo: `Página ${chave}` })
    return this.paginas.ler(chave)
  }
}
