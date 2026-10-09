const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const MESES_LONGOS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

// converte "2026-09-25" em Date local (evita problemas de fuso horário do new Date(string))
export function paraData(iso) {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return new Date(ano, mes - 1, dia)
}

export function hoje() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

// "12 Set 2026"
export function formatarData(iso) {
  const d = paraData(iso)
  return `${String(d.getDate()).padStart(2, '0')} ${MESES_CURTOS[d.getMonth()]} ${d.getFullYear()}`
}

// "12 de setembro de 2026"
export function formatarDataLonga(iso) {
  const d = paraData(iso)
  return `${d.getDate()} de ${MESES_LONGOS[d.getMonth()]} de ${d.getFullYear()}`
}

// "Outubro de 2026" — usado para agrupar eventos por mês
export function formatarMesAno(iso) {
  const d = paraData(iso)
  const mes = MESES_LONGOS[d.getMonth()]
  return `${mes[0].toUpperCase()}${mes.slice(1)} de ${d.getFullYear()}`
}

export function diaDoMes(iso) {
  return String(paraData(iso).getDate()).padStart(2, '0')
}

export function mesCurto(iso) {
  return MESES_CURTOS[paraData(iso).getMonth()].toUpperCase()
}

export function diasAte(iso) {
  return Math.round((paraData(iso) - hoje()) / 86400000)
}

// "Hoje", "Amanhã" ou "Faltam 6 dias"
export function contagem(iso) {
  const dias = diasAte(iso)
  if (dias === 0) return 'Hoje'
  if (dias === 1) return 'Amanhã'
  return `Faltam ${dias} dias`
}
