import { NaoEncontrado, SemPermissao } from '../../dominio/comum/erros.js'

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
      if (conta.tipo === 'estudante' && (await this.academico.turmasAtivas(conta.id)).includes(cadeira.turmaId)) return cadeira
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
    return this.academico.cadeirasDasTurmas(await this.academico.turmasAtivas(conta.id))
  }
}
