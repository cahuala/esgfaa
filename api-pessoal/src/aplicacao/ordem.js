import { comparadorHierarquico, posicoesDasUnidades } from '../dominio/pessoal/ordem.js'

// a posição de cada unidade na orgânica (para a ordem hierárquica das listas)
export async function posicoesUnidades(bd) {
  return posicoesDasUnidades(await bd.unidade.findMany({ select: { id: true, paiId: true, ordem: true, nome: true } }))
}

/*
  Ordena pela ordem hierárquica qualquer lista cujas linhas são de uma pessoa (licenças, ausências, contas, guias…):
  idDe(linha) dá o id da pessoa. As linhas da mesma pessoa ficam pela ordem em que vieram (ex.: a data); as linhas
  sem pessoa vão para o fim. Cada linha fica com «hierarquia» (1, 2, 3…), que as tabelas usam para voltar a esta ordem.
*/
export async function ordenarLinhas(bd, linhas, idDe = (x) => x.pessoaId ?? x.id) {
  if (!linhas?.length) return linhas ?? []
  const ids = [...new Set(linhas.map(idDe).filter((x) => x !== null && x !== undefined))]
  const [pessoas, posicoes] = await Promise.all([
    bd.pessoa.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true, tipo: true, vinculo: true, posto: true, carreiraCivil: true, unidadeId: true, dataAntiguidadePosto: true, cargo: { select: { funcao: true } } } }),
    posicoesUnidades(bd),
  ])
  const porId = new Map(pessoas.map((p) => [p.id, p]))
  const cmp = comparadorHierarquico(posicoes)
  return linhas
    .map((l, i) => ({ l, i, p: porId.get(idDe(l)) }))
    .sort((a, b) => (!a.p) - (!b.p) || (a.p && b.p ? cmp(a.p, b.p) : 0) || a.i - b.i)
    .map((x, k) => ({ ...x.l, hierarquia: k + 1 }))
}
