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

  // ---------- plano de curso da ESG: provas TAI/TAG ----------

  async criarProva(ctx, cadeiraId, dados) {
    return this.esg.criarAvaliacao(ctx, await this.apoio.cadeiraDoDocente(ctx.conta, cadeiraId), dados, quem(ctx.conta))
  }

  async editarProva(ctx, cadeiraId, provaId, dados) {
    return this.esg.editarAvaliacao(ctx, await this.apoio.cadeiraDoDocente(ctx.conta, cadeiraId), provaId, dados, quem(ctx.conta))
  }

  async apagarProva(ctx, cadeiraId, provaId) {
    return this.esg.apagarAvaliacao(ctx, await this.apoio.cadeiraDoDocente(ctx.conta, cadeiraId), provaId, quem(ctx.conta))
  }

  async notasProva(ctx, cadeiraId, provaId, linhas) {
    return this.esg.gravarNotas(ctx, await this.apoio.cadeiraDoDocente(ctx.conta, cadeiraId), provaId, linhas, quem(ctx.conta))
  }

  async publicarProva(ctx, cadeiraId, provaId, publicar) {
    return this.esg.publicar(ctx, await this.apoio.cadeiraDoDocente(ctx.conta, cadeiraId), provaId, publicar, quem(ctx.conta))
  }

  // o estudante pede o teste de recuperação de um TAI negativo
  async pedirRevisao(ctx, cadeiraId, provaId, motivo) {
    return this.esg.pedirRevisao(ctx, await this.apoio.cadeiraAcessivel(ctx.conta, cadeiraId), provaId, motivo)
  }

  async pedirRecuperacao(ctx, cadeiraId, provaId) {
    return this.esg.pedirRecuperacao(ctx, await this.apoio.cadeiraAcessivel(ctx.conta, cadeiraId), provaId)
  }
}
