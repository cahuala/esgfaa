import { erro, escolha } from '../comum/validacao.js'

// Unidade curricular: período e alocação de docentes (regente e assistentes).

// período da cadeira e papel de cada docente alocado
export const PERIODOS = { 1: '1.º semestre', 2: '2.º semestre', anual: 'Anual' }

export const PAPEIS_DOCENCIA = ['regente', 'assistente']

/*
  Alocação de docentes a uma cadeira: no máximo um regente, sem docentes repetidos,
  horas inteiras de 0 a 1000. Devolve a lista limpa.
*/
export function validarAlocacao(lista) {
  if (!Array.isArray(lista) || lista.length > 20) throw erro('docentes', 'Lista de docentes inválida.')
  const vistos = new Set()
  const limpa = lista.map((d) => {
    const docenteId = Number(d.docenteId)
    if (!Number.isSafeInteger(docenteId) || docenteId < 1) throw erro('docentes', 'Escolha um docente.')
    if (vistos.has(docenteId)) throw erro('docentes', 'O mesmo docente está alocado duas vezes.')
    vistos.add(docenteId)
    const horas = Number(d.horas ?? 0)
    if (!Number.isInteger(horas) || horas < 0 || horas > 1000) throw erro('horas', 'Horas inválidas (0 a 1000).')
    return { docenteId, papel: escolha(d.papel || 'assistente', 'papel', 'Papel', PAPEIS_DOCENCIA), horas }
  })
  if (limpa.filter((d) => d.papel === 'regente').length > 1) throw erro('docentes', 'A cadeira só pode ter um regente.')
  return limpa
}
