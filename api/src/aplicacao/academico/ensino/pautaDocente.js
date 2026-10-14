import { quem } from '../partilhado/autor.js'

// Pauta da cadeira lançada pelo docente.
export class ServicoPautaDocente {
  constructor(dependencias) {
    Object.assign(this, dependencias)
  }

  // pauta completa em matriz: estudantes × (1.ª prova, 2.ª prova, MAC, exame, recurso, final)
  async pauta(ctx, cadeiraId) {
    return this.pautas.pauta(await this.apoio.cadeiraDoDocente(ctx.conta, cadeiraId))
  }

  async gravarPauta(ctx, cadeiraId, linhas) {
    return this.pautas.gravar(ctx, await this.apoio.cadeiraDoDocente(ctx.conta, cadeiraId), linhas, quem(ctx.conta))
  }

  async publicarNotas(ctx, cadeiraId, componentes) {
    return this.pautas.publicar(ctx, await this.apoio.cadeiraDoDocente(ctx.conta, cadeiraId), componentes, quem(ctx.conta))
  }

  async definirComposicao(ctx, cadeiraId, { componente, itens }) {
    return this.pautas.definirComposicao(ctx, await this.apoio.cadeiraDoDocente(ctx.conta, cadeiraId), componente, itens, quem(ctx.conta))
  }
}
