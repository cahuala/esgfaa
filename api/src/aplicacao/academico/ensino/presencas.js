import { ErroValidacao, NaoEncontrado } from '../../../dominio/comum/erros.js'
import { ESTADOS_PRESENCA } from '../../../dominio/academico/atividades/presencas.js'
import { dataValida, escolha, texto } from '../../../dominio/academico/comum/validacao.js'

// Aulas dadas (sumário) e presenças registadas pelo docente.
export class ServicoPresencas {
  constructor(dependencias) {
    Object.assign(this, dependencias)
  }

  async aulas(ctx, cadeiraId) {
    const cadeira = await this.apoio.cadeiraDoDocente(ctx.conta, cadeiraId)
    const [aulas, estudantes] = await Promise.all([this.academico.aulas(cadeira.id), this.academico.estudantesAtivosDaTurma(cadeira.turmaId)])
    return { aulas, estudantes }
  }

  async #presencasValidas(cadeira, presencas) {
    const validos = new Set((await this.academico.estudantesAtivosDaTurma(cadeira.turmaId)).map((e) => e.id))
    return (presencas || []).map((p) => {
      if (!validos.has(Number(p.estudanteId))) throw new ErroValidacao('A lista de presenças tem um estudante que não pertence à turma.')
      return { estudanteId: Number(p.estudanteId), estado: escolha(p.estado, 'estado', 'Presença', ESTADOS_PRESENCA) }
    })
  }

  async registarAula(ctx, cadeiraId, { data, sumario, presencas }) {
    const cadeira = await this.apoio.cadeiraDoDocente(ctx.conta, cadeiraId)
    if (!dataValida(data)) throw new ErroValidacao('Data da aula inválida.', { campo: 'data' })
    return this.academico.registarAula({
      cadeiraId: cadeira.id, data,
      sumario: texto(sumario, 'sumario', 'Sumário', { max: 2000, obrigatorio: false }),
      presencas: await this.#presencasValidas(cadeira, presencas),
    })
  }

  async atualizarAula(ctx, id, { sumario, presencas }) {
    const aula = await this.academico.aula(id)
    if (!aula) throw new NaoEncontrado('Aula não encontrada.')
    const cadeira = await this.apoio.cadeiraDoDocente(ctx.conta, aula.cadeiraId)
    await this.academico.atualizarAula(aula.id, {
      sumario: texto(sumario, 'sumario', 'Sumário', { max: 2000, obrigatorio: false }),
      presencas: await this.#presencasValidas(cadeira, presencas),
    })
  }

  async apagarAula(ctx, id) {
    const aula = await this.academico.aula(id)
    if (!aula) throw new NaoEncontrado('Aula não encontrada.')
    await this.apoio.cadeiraDoDocente(ctx.conta, aula.cadeiraId)
    await this.academico.apagarAula(aula.id)
  }
}
