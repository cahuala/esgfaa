/*
  Registo de atividades (segurança): quem fez o quê, quando e de onde.
  ctx = { actor, ip, agente } — o contexto do pedido.
*/
export class ServicoAuditoria {
  constructor({ atividades }) {
    this.atividades = atividades
  }

  registar(ctx, { acao, colecao = null, alvoId = null, alvoTitulo = null, detalhes = null, utilizador = undefined }) {
    const u = utilizador === undefined ? ctx.actor : utilizador
    this.atividades.registar({
      utilizadorId: u?.id ?? null, utilizadorNome: u?.nome ?? null,
      acao, colecao, alvoId, alvoTitulo, detalhes, ip: ctx.ip, agente: ctx.agente,
    })
  }

  listar(ctx, filtros) {
    ctx.actor.exigir('atividades.ver')
    return this.atividades.listar(filtros)
  }
}
