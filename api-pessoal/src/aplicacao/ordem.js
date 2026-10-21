import { posicoesDasUnidades } from '../dominio/pessoal/ordem.js'

// a posição de cada unidade na orgânica (para a ordem hierárquica das listas)
export async function posicoesUnidades(bd) {
  return posicoesDasUnidades(await bd.unidade.findMany({ select: { id: true, paiId: true, ordem: true, nome: true } }))
}
