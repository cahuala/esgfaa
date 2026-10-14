import { dataValida, texto } from '../comum/validacao.js'
import { ErroValidacao } from '../../comum/erros.js'
import { NOTA_MINIMA_APROVACAO, classificacao, validarNota } from '../avaliacao/nota.js'

// Trabalho de fim de curso (monografia / TFC) de um estudante finalista.
export class TrabalhoFimCurso {
  constructor({ id = null, estudanteId, turmaId, tema, orientador = '', juri = '', dataDefesa = null, nota = null, observacao = '' }) {
    Object.assign(this, { id, estudanteId, turmaId, tema, orientador, juri, dataDefesa, nota: nota === null || nota === undefined ? null : Number(nota), observacao })
  }

  get defendido() {
    return this.nota !== null
  }

  get aprovado() {
    return this.nota !== null && this.nota >= NOTA_MINIMA_APROVACAO
  }

  get classificacao() {
    return classificacao(this.nota === null ? null : Math.round(this.nota))
  }

  // dados lançados pela Administração Escolar (a nota só com a data da defesa)
  static validar(d) {
    const tema = texto(d.tema, 'tema', 'Tema', { min: 5, max: 300 })
    const dataDefesa = d.dataDefesa ? String(d.dataDefesa) : null
    if (dataDefesa && !dataValida(dataDefesa)) throw new ErroValidacao('Data da defesa inválida.', { campo: 'dataDefesa' })
    const nota = validarNota(d.nota)
    if (nota !== null && !dataDefesa) throw new ErroValidacao('Indique a data da defesa antes de lançar a nota.', { campo: 'dataDefesa' })
    return {
      tema, dataDefesa, nota,
      orientador: texto(d.orientador, 'orientador', 'Orientador', { max: 150, obrigatorio: false }),
      juri: texto(d.juri, 'juri', 'Júri', { max: 500, obrigatorio: false }),
      observacao: texto(d.observacao, 'observacao', 'Observação', { max: 500, obrigatorio: false }),
    }
  }
}
