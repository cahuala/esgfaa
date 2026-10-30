import { GRUPOS_ACONTECIMENTOS } from '../dominio/identidade/acontecimentos.js'

/*
  Registo de atividades (segurança): quem fez o quê, quando e de onde.
  ctx = { actor, ip, agente } — o contexto do pedido.
*/
export class ServicoAuditoria {
  constructor({ atividades, relogio }) {
    this.atividades = atividades
    this.relogio = relogio
    this.ouvintes = []
  }

  // quem quer saber de cada atividade registada (ex.: os avisos por e-mail ao Comandante); nunca atrasa nem falha o pedido
  ouvir(fn) {
    this.ouvintes.push(fn)
  }

  async registar(ctx, { acao, colecao = null, alvoId = null, alvoTitulo = null, detalhes = null, utilizador = undefined }) {
    const u = utilizador === undefined ? ctx.actor : utilizador
    await this.atividades.registar({
      utilizadorId: u?.id ?? null, utilizadorNome: u?.nome ?? null,
      acao, colecao, alvoId, alvoTitulo, detalhes, ip: ctx.ip, agente: ctx.agente,
    })
    for (const fn of this.ouvintes) Promise.resolve().then(() => fn({ acao, colecao, alvoId, alvoTitulo, detalhes, quem: u?.nome ?? null })).catch(() => {})
  }

  listar(ctx, filtros) {
    ctx.actor.exigir('atividades.ver')
    return this.atividades.listar(filtros)
  }

  // o que de importante aconteceu nos últimos dias, por grupo (painel do Comandante)
  async acontecimentos(ctx, { dias = 7 } = {}) {
    ctx.actor.exigir('atividades.ver')
    const agora = this.relogio?.agora?.() ?? new Date()
    const desde = new Date(agora.getTime() - dias * 86_400_000)
    const grupos = await Promise.all(GRUPOS_ACONTECIMENTOS.map(async (g) => ({ id: g.id, titulo: g.titulo, icone: g.icone, ...(await this.atividades.porAcoes(g.acoes, desde)) })))
    return { dias, desde: desde.toISOString(), grupos }
  }
}
