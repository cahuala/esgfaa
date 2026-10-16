// a mesma regra que a API usa (fonte única): MAC, dispensa, exame, recurso e classificação
import { NOTA_MINIMA_APROVACAO } from '../../api/src/dominio/academico/avaliacao/nota.js'
import { AVALIACAO, COMPONENTES_NOTA, NOMES_COMPONENTES, resultadoDisciplina } from '../../api/src/dominio/academico/avaliacao/resultado.js'
import { t as tx } from '../i18n/linguas'

export { AVALIACAO, COMPONENTES_NOTA, NOMES_COMPONENTES, NOTA_MINIMA_APROVACAO, resultadoDisciplina }

export const SITUACOES = {
  em_curso: { texto: tx('Em curso'), cor: 'cinzento' },
  dispensado: { texto: tx('Dispensado'), cor: 'verde' },
  exame: { texto: tx('Exame'), cor: 'azul' },
  recurso: { texto: tx('Recurso'), cor: 'dourado' },
  aprovado: { texto: tx('Aprovado'), cor: 'verde' },
  reprovado: { texto: tx('Reprovado'), cor: 'vermelho' },
}

// texto da regra, para as legendas
export const REGRA = tx('MAC = média da 1.ª e 2.ª prova. MAC ≥ {0} sem prova negativa dispensa do exame. ', { 0: AVALIACAO.macDispensa })
  + `Nota final = ${AVALIACAO.pesoMac * 100} % MAC + ${AVALIACAO.pesoExame * 100} % exame (ou recurso), arredondada às unidades; aprovação com ${NOTA_MINIMA_APROVACAO}.`

export const PERIODOS = { 1: tx('1.º semestre'), 2: tx('2.º semestre'), anual: tx('Anual') }
