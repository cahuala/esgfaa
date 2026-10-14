// a mesma regra que a API usa (fonte única): MAC, dispensa, exame, recurso e classificação
import { AVALIACAO, COMPONENTES_NOTA, NOMES_COMPONENTES, NOTA_MINIMA_APROVACAO, resultadoDisciplina } from '../../api/src/dominio/academico/regras.js'

export { AVALIACAO, COMPONENTES_NOTA, NOMES_COMPONENTES, NOTA_MINIMA_APROVACAO, resultadoDisciplina }

export const SITUACOES = {
  em_curso: { texto: 'Em curso', cor: 'cinzento' },
  dispensado: { texto: 'Dispensado', cor: 'verde' },
  exame: { texto: 'Exame', cor: 'azul' },
  recurso: { texto: 'Recurso', cor: 'dourado' },
  aprovado: { texto: 'Aprovado', cor: 'verde' },
  reprovado: { texto: 'Reprovado', cor: 'vermelho' },
}

// texto da regra, para as legendas
export const REGRA = `MAC = média da 1.ª e 2.ª prova. MAC ≥ ${AVALIACAO.macDispensa} sem prova negativa dispensa do exame. `
  + `Nota final = ${AVALIACAO.pesoMac * 100} % MAC + ${AVALIACAO.pesoExame * 100} % exame (ou recurso), arredondada às unidades; aprovação com ${NOTA_MINIMA_APROVACAO}.`

export const PERIODOS = { 1: '1.º semestre', 2: '2.º semestre', anual: 'Anual' }
