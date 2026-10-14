import { erro, escolha } from '../comum/validacao.js'

// Livro de notas: componentes da pauta calculadas a partir das atividades.

export const TIPOS_ITEM_NOTA = ['trabalho', 'questionario', 'workshop']

// [{ tipo, id, peso }]: 1 a 20 atividades sem repetir, pesos inteiros de 1 a 100
export function validarComposicao(itens) {
  if (!Array.isArray(itens) || itens.length < 1 || itens.length > 20) throw erro('itens', 'Escolha de 1 a 20 atividades.')
  const vistas = new Set()
  return itens.map((i) => {
    const tipo = escolha(i.tipo, 'itens', 'Tipo de atividade', TIPOS_ITEM_NOTA)
    const id = Number(i.id)
    if (!Number.isSafeInteger(id) || id < 1) throw erro('itens', 'Atividade inválida.')
    if (vistas.has(`${tipo}-${id}`)) throw erro('itens', 'A mesma atividade aparece duas vezes.')
    vistas.add(`${tipo}-${id}`)
    const peso = Number(i.peso ?? 1)
    if (!Number.isInteger(peso) || peso < 1 || peso > 100) throw erro('itens', 'Os pesos são inteiros de 1 a 100.')
    return { tipo, id, peso }
  })
}

/*
  Nota de uma componente: média ponderada das notas das atividades (0 a 20, às centésimas).
  notas: { "trabalho-3": 14 | null }. Basta faltar uma nota para a componente ficar por calcular.
  (Quem não entregou depois do prazo, ou não fez o questionário depois de fechar, já chega aqui com 0.)
*/
export function notaComposta(itens, notas) {
  let soma = 0
  let pesos = 0
  for (const i of itens) {
    const n = notas[`${i.tipo}-${i.id}`]
    if (n === null || n === undefined) return null
    soma += Number(n) * i.peso
    pesos += i.peso
  }
  return pesos ? Math.round((soma / pesos) * 100) / 100 : null
}
