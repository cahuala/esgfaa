import { ErroValidacao, NaoEncontrado } from '../../../dominio/comum/erros.js'
import { validarPrazo } from '../../../dominio/academico/avaliacao/prazosNotas.js'
import { NOMES_COMPONENTES } from '../../../dominio/academico/avaliacao/resultado.js'

/*
  Prazos de lançamento das notas (Administração Escolar / Direcção de Ensino): gerais, de uma turma ou de
  uma cadeira (prorrogação). Fora do prazo, o docente não lança essa componente no portal.
*/
export class ServicoPrazosNotas {
  constructor(dependencias) {
    Object.assign(this, dependencias)
  }

  async listar(ctx) {
    ctx.actor.exigir('academico.ver')
    return (await this.prazosNotas.todos()).map((p) => ({
      ...p, componenteNome: NOMES_COMPONENTES[p.componente],
      ambito: p.cadeira ? `Cadeira: ${p.cadeira.codigo} ${p.cadeira.nome}` : p.turma ? `Turma: ${p.turma.nome} (${p.turma.anoLetivo})` : 'Toda a Escola',
      turma: undefined, cadeira: undefined,
    }))
  }

  async criar(ctx, { turmaId = null, cadeiraId = null, ...dados }) {
    ctx.actor.exigir('academico.gerir')
    const v = validarPrazo(dados)
    if (cadeiraId && !(await this.academico.cadeira(cadeiraId))) throw new ErroValidacao('Cadeira inválida.', { campo: 'cadeiraId' })
    if (!cadeiraId && turmaId && !(await this.academico.turma(turmaId))) throw new ErroValidacao('Turma inválida.', { campo: 'turmaId' })
    const p = await this.prazosNotas.criar({ ...v, cadeiraId: cadeiraId || null, turmaId: cadeiraId ? null : turmaId || null, criadoPor: ctx.actor.nome ?? '' })
    await this.auditoria.registar(ctx, { acao: 'definir_prazo_notas', colecao: 'prazos_notas', alvoId: p.id, alvoTitulo: `${NOMES_COMPONENTES[p.componente]}: ${p.inicio} a ${p.fim}` })
    return p
  }

  async apagar(ctx, id) {
    ctx.actor.exigir('academico.gerir')
    const p = await this.prazosNotas.porId(id)
    if (!p) throw new NaoEncontrado('Prazo não encontrado.')
    await this.prazosNotas.apagar(id)
    await this.auditoria.registar(ctx, { acao: 'apagar_prazo_notas', colecao: 'prazos_notas', alvoId: id, alvoTitulo: `${NOMES_COMPONENTES[p.componente]}: ${p.inicio} a ${p.fim}` })
  }
}
