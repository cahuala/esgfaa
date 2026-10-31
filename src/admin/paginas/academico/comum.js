import { t as tx } from '../../../i18n/linguas'
// textos partilhados pelas páginas da Administração Escolar
export const PERIODOS = { 1: tx('1.º semestre'), 2: tx('2.º semestre'), anual: tx('Anual') }
export const PAPEIS_DOCENCIA = { regente: tx('Regente'), assistente: tx('Assistente') }

// uma cadeira do 1.º, do 2.º semestre ou anual, pelas datas do ano letivo: por começar, a decorrer ou terminada
export const ESTADOS_PERIODO = {
  por_comecar: { rotulo: tx('Por começar'), cor: 'bg-light text-dark border' },
  a_decorrer: { rotulo: tx('A decorrer'), cor: 'bg-success' },
  terminada: { rotulo: tx('Terminada'), cor: 'bg-gray-500' },
}
export function estadoDoPeriodo(ano, periodo, hoje = new Date().toISOString().slice(0, 10)) {
  if (!ano) return null
  const [de, ate] = periodo === '1' ? [ano.semestre1Inicio, ano.semestre1Fim] : periodo === '2' ? [ano.semestre2Inicio, ano.semestre2Fim] : [ano.inicio, ano.fim]
  return hoje < de ? 'por_comecar' : hoje > ate ? 'terminada' : 'a_decorrer'
}
