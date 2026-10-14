import { erro, texto } from '../comum/validacao.js'

// Grelha de avaliação (rubrica) com critérios e pontos.

// grelha de avaliação (rubrica): 1 a 15 critérios com pontos máximos de 1 a 100
export function validarGrelha(grelha) {
  if (grelha === undefined || grelha === null || (Array.isArray(grelha) && !grelha.length)) return []
  if (!Array.isArray(grelha) || grelha.length > 15) throw erro('grelha', 'A grelha tem até 15 critérios.')
  return grelha.map((c) => {
    const pontos = Number(c.pontos)
    if (!Number.isInteger(pontos) || pontos < 1 || pontos > 100) throw erro('grelha', 'Os pontos de cada critério são inteiros de 1 a 100.')
    return {
      criterio: texto(c.criterio, 'grelha', 'Critério', { min: 2, max: 120 }),
      descricao: texto(c.descricao, 'grelha', 'Descrição do critério', { max: 500, obrigatorio: false }),
      pontos,
    }
  })
}

/*
  Avaliação pela grelha: pontos dados em cada critério (0 até ao máximo, aceita meios pontos)
  e a nota de 0 a 20 que resulta. pontos: { "0": 8, "1": 4.5 }. Falta um critério → nota null.
*/
export function avaliarGrelha(grelha, pontos = {}) {
  let obtidos = 0
  let total = 0
  const limpos = {}
  let completa = true
  grelha.forEach((c, i) => {
    total += c.pontos
    const v = pontos[i] ?? pontos[String(i)]
    if (v === undefined || v === null || v === '') { completa = false; return }
    const n = Number(String(v).replace(',', '.'))
    if (!Number.isFinite(n) || n < 0 || n > c.pontos) throw erro('grelha', `"${c.criterio}": de 0 a ${c.pontos} pontos.`)
    limpos[i] = Math.round(n * 2) / 2
    obtidos += limpos[i]
  })
  return { pontos: limpos, obtidos, total, nota: completa && total ? Math.round((obtidos / total) * 20 * 100) / 100 : null }
}
