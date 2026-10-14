import { HORA, erro, texto } from '../comum/validacao.js'

// Horário semanal das cadeiras e as aulas que dele resultam.

export function validarHorario({ diaSemana, inicio, fim, sala }) {
  const dia = Number(diaSemana)
  if (!Number.isInteger(dia) || dia < 1 || dia > 6) throw erro('diaSemana', 'Dia da semana inválido (segunda a sábado).')
  if (!HORA.test(inicio) || !HORA.test(fim)) throw erro('inicio', 'Horas no formato HH:MM.')
  if (inicio >= fim) throw erro('fim', 'A hora de fim tem de ser depois da de início.')
  return { diaSemana: dia, inicio, fim, sala: texto(sala, 'sala', 'Sala', { max: 60, obrigatorio: false }) }
}

/*
  Aulas do horário semanal entre duas datas (AAAA-MM-DD), saltando os dias de feriado.
  diaSemana: 1 = segunda … 6 = sábado.
*/
export function expandirAulas(horarios, de, ate, feriados = []) {
  const semAulas = new Set(feriados)
  const aulas = []
  for (let t = Date.parse(`${de}T00:00:00Z`); t <= Date.parse(`${ate}T00:00:00Z`); t += 86_400_000) {
    const d = new Date(t)
    const data = d.toISOString().slice(0, 10)
    const dia = d.getUTCDay() === 0 ? 7 : d.getUTCDay()
    if (semAulas.has(data)) continue
    for (const h of horarios) if (h.diaSemana === dia) aulas.push({ ...h, data })
  }
  return aulas
}
