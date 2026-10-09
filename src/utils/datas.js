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

const DIAS_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']

// "Sexta-feira, 9 de outubro de 2026"
export function dataPorExtenso(data = new Date()) {
  return `${DIAS_SEMANA[data.getDay()]}, ${data.getDate()} de ${MESES_LONGOS[data.getMonth()]} de ${data.getFullYear()}`
}

// "Quinta-feira"
export function diaDaSemana(iso) {
  return DIAS_SEMANA[paraData(iso).getDay()]
}

// "outubro" (nome do mês por extenso, minúsculas)
export function mesLongo(iso) {
  return MESES_LONGOS[paraData(iso).getMonth()]
}

// "2026-10-09 09:21:50" (UTC, vindo da API) -> "há 5 min", "há 3 h", "há 2 dias" ou "12 Set 2026"
export function tempoRelativo(dataUtc) {
  const d = new Date(`${String(dataUtc).replace(' ', 'T')}Z`)
  const seg = Math.max(0, Math.round((Date.now() - d) / 1000))
  if (seg < 60) return 'agora mesmo'
  if (seg < 3600) return `há ${Math.floor(seg / 60)} min`
  if (seg < 86400) return `há ${Math.floor(seg / 3600)} h`
  if (seg < 7 * 86400) {
    const dias = Math.floor(seg / 86400)
    return `há ${dias} ${dias === 1 ? 'dia' : 'dias'}`
  }
  return `${String(d.getDate()).padStart(2, '0')} ${MESES_CURTOS[d.getMonth()]} ${d.getFullYear()}`
}
