import { escolha, texto } from '../comum/validacao.js'
import { ErroValidacao, Conflito } from '../../comum/erros.js'

// Inscrição de um estudante numa cadeira que não é da sua turma.

export const MOTIVOS_INSCRICAO = {
  atraso: 'Cadeira em atraso',
  repeticao: 'Repetição da cadeira',
  equivalencia: 'Equivalência / transferência',
  outro: 'Outro motivo',
}
export const ESTADOS_INSCRICAO = ['ativa', 'anulada']

export class Inscricao {
  constructor({ id, estudanteId, cadeiraId, motivo, observacao = '', estado = 'ativa', criadaEm = null }) {
    Object.assign(this, { id, estudanteId, cadeiraId, motivo, observacao, estado, criadaEm })
  }

  get ativa() {
    return this.estado === 'ativa'
  }

  /*
    Nova inscrição: o estudante não pode já frequentar a cadeira pela sua turma,
    nem ter outra inscrição ativa na mesma cadeira.
  */
  static nova({ estudante, cadeira, turmasDoEstudante, existente, motivo, observacao }) {
    if (!estudante || estudante.tipo !== 'estudante') throw new ErroValidacao('Escolha um estudante.', { campo: 'estudanteId' })
    if (turmasDoEstudante.includes(cadeira.turmaId)) throw new Conflito('O estudante já frequenta esta cadeira pela sua turma.')
    if (existente?.estado === 'ativa') throw new Conflito('O estudante já está inscrito nesta cadeira.')
    return new Inscricao({
      estudanteId: estudante.id, cadeiraId: cadeira.id,
      motivo: escolha(motivo || 'atraso', 'motivo', 'Motivo', Object.keys(MOTIVOS_INSCRICAO)),
      observacao: texto(observacao, 'observacao', 'Observação', { max: 300, obrigatorio: false }),
    })
  }

  anular() {
    if (!this.ativa) throw new Conflito('A inscrição já está anulada.')
    this.estado = 'anulada'
    return this
  }
}
