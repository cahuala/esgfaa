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
  excluido: { texto: tx('Excluído por faltas'), cor: 'vermelho' },
  // plano de curso da ESG
  recuperacao: { texto: tx('Em recuperação'), cor: 'dourado' },
  sem_provas: { texto: tx('Sem provas'), cor: 'cinzento' },
}

// texto da regra, para as legendas
export const REGRA = tx('MAC = média da 1.ª e 2.ª prova. MAC ≥ {0} sem prova negativa dispensa do exame. ', { 0: AVALIACAO.macDispensa })
  + tx('Nota final = {0} % MAC + {1} % exame (ou recurso), arredondada às unidades; aprovação com {2}.', { 0: AVALIACAO.pesoMac * 100, 1: AVALIACAO.pesoExame * 100, 2: NOTA_MINIMA_APROVACAO })
  + ' ' + tx('Com menos de {0} % de presenças nas aulas, o estudante fica excluído por faltas.', { 0: AVALIACAO.assiduidadeMinima })

// planos de curso da ESG (a mesma regra da API)
export { BLOCOS_DE_TEMPOS, FORMAS_AVALIACAO, NOTA_MAXIMA_RECUPERACAO, TEMPOS_ESCOLARES, TIPOS_AVALIACAO, mencao, resultadoUc } from '../../api/src/dominio/academico/avaliacao/planoCurso.js'
export const REGRA_ESG = tx('Nota da UC = média dos TAI e TAG (0 a 20, às centésimas). Aprovação com 10 na UC e em cada TAI de teste escrito. Um TAI negativo dá direito a um teste de recuperação, pedido até às 17h do dia útil seguinte à publicação, uma só vez; esse TAI conta no máximo 10. Menção: Muito Bom 18–20, Bom 14–17,99, Regular 10–13,99.')

export const PERIODOS = { 1: tx('1.º semestre'), 2: tx('2.º semestre'), anual: tx('Anual') }
