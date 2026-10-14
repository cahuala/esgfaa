import { NaoEncontrado } from '../../../dominio/comum/erros.js'

// Pautas lançadas e publicadas pela Administração Escolar.
export class ServicoPautasAdministracao {
  constructor(dependencias) {
    Object.assign(this, dependencias)
  }

  async #cadeira(id) {
    const c = await this.academico.cadeira(id)
    if (!c) throw new NaoEncontrado('Cadeira não encontrada.')
    return c
  }

  async pauta(ctx, cadeiraId) {
    ctx.actor.exigir('academico.ver')
    return this.pautas.pauta(await this.#cadeira(cadeiraId))
  }

  async gravarPauta(ctx, cadeiraId, linhas) {
    ctx.actor.exigir('academico.notas')
    return this.pautas.gravar(ctx, await this.#cadeira(cadeiraId), linhas)
  }

  async publicarNotas(ctx, cadeiraId, componentes) {
    ctx.actor.exigir('academico.notas')
    return this.pautas.publicar(ctx, await this.#cadeira(cadeiraId), componentes)
  }

  async definirComposicao(ctx, cadeiraId, { componente, itens }) {
    ctx.actor.exigir('academico.notas')
    return this.pautas.definirComposicao(ctx, await this.#cadeira(cadeiraId), componente, itens)
  }
}
