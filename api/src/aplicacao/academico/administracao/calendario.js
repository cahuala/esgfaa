import { ErroValidacao, NaoEncontrado } from '../../../dominio/comum/erros.js'
import { TIPOS_EVENTO, validarEvento } from '../../../dominio/academico/organizacao/calendario.js'

// Calendário académico geral e das turmas (Administração Escolar).
export class ServicoCalendarioAcademico {
  constructor(dependencias) {
    Object.assign(this, dependencias)
  }

  async #cadeira(id) {
    const c = await this.academico.cadeira(id)
    if (!c) throw new NaoEncontrado('Cadeira não encontrada.')
    return c
  }

  // eventos gerais e das turmas (início de semestre, épocas de exames, feriados) e datas das provas das cadeiras
  listarEventos(ctx) {
    ctx.actor.exigir('academico.ver')
    return this.recursos.todosEventosGerais()
  }

  async eventosDaCadeira(ctx, cadeiraId) {
    ctx.actor.exigir('academico.ver')
    return this.recursos.eventosDaCadeira((await this.#cadeira(cadeiraId)).id)
  }

  async criarEvento(ctx, { turmaId, cadeiraId, ...dados }) {
    ctx.actor.exigir('academico.gerir')
    let turma = null
    let cadeira = null
    if (cadeiraId) cadeira = await this.#cadeira(cadeiraId)
    else if (turmaId) {
      turma = await this.academico.turma(turmaId)
      if (!turma) throw new ErroValidacao('Turma inválida.', { campo: 'turmaId' })
    }
    const e = await this.recursos.criarEvento({ cadeiraId: cadeira?.id ?? null, turmaId: turma?.id ?? null, ...validarEvento(dados, Object.keys(TIPOS_EVENTO)) })
    await this.auditoria.registar(ctx, { acao: 'marcar_evento', colecao: 'calendario', alvoId: e.id, alvoTitulo: `${e.titulo} (${e.data})` })
    return e
  }

  async apagarEvento(ctx, id) {
    ctx.actor.exigir('academico.gerir')
    const e = await this.recursos.evento(id)
    if (!e) throw new NaoEncontrado('Evento não encontrado.')
    await this.recursos.apagarEvento(e.id)
  }
}
