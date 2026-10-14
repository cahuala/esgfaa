import { NaoEncontrado, SemPermissao } from '../../../dominio/comum/erros.js'

/*
  Regra de acesso do portal a uma cadeira: o estudante só vê as cadeiras das turmas onde tem
  matrícula ativa; o docente só as cadeiras onde está alocado (regente ou assistente).
  Tudo o resto responde "não encontrado" (não se revela o que existe).
*/
export class AcessoCadeiras {
  constructor({ academico }) {
    this.academico = academico
  }

  async acessivel(conta, cadeiraId) {
    const cadeira = await this.academico.cadeira(cadeiraId)
    if (cadeira) {
      if (conta.tipo === 'docente' && cadeira.docentes.some((d) => d.id === conta.id)) return cadeira
      if (conta.tipo === 'estudante') {
        if ((await this.academico.turmasAtivas(conta.id)).includes(cadeira.turmaId)) return cadeira
        if ((await this.academico.cadeirasInscritas(conta.id)).includes(cadeira.id)) return cadeira
      }
    }
    throw new NaoEncontrado('Cadeira não encontrada.')
  }

  async doDocente(conta, cadeiraId) {
    if (conta.tipo !== 'docente') throw new SemPermissao('Só os docentes da cadeira podem fazer isto.')
    return this.acessivel(conta, cadeiraId)
  }

  soEstudante(conta) {
    if (conta.tipo !== 'estudante') throw new SemPermissao('Disponível apenas para estudantes.')
  }

  async minhasCadeiras(conta) {
    if (conta.tipo === 'docente') return this.academico.cadeirasDoDocente(conta.id)
    const [daTurma, inscritas] = await Promise.all([
      this.academico.cadeirasDasTurmas(await this.academico.turmasAtivas(conta.id)),
      this.academico.cadeirasInscritas(conta.id),
    ])
    const extra = await Promise.all(inscritas.filter((id) => !daTurma.some((c) => c.id === id)).map((id) => this.academico.cadeira(id)))
    return [...daTurma, ...extra.filter(Boolean).map((c) => ({ ...c, inscrito: true }))]
  }
}
