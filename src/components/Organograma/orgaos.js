// a lista de órgãos do organograma; sem ela (páginas antigas), sai das áreas e órgãos da «Estrutura»
export function orgaosDe(estrutura, comando = 'Comando da Escola') {
  if (estrutura?.orgaos?.length) return estrutura.orgaos.filter((o) => o.nome)
  // páginas antigas, só com áreas: o Comando, as áreas debaixo dele e os órgãos debaixo de cada área
  return [
    { nome: comando, texto: estrutura?.comando || '' },
    ...(estrutura?.ramos ?? []).flatMap((r) => [{ nome: r.titulo, dependeDe: comando }, ...(r.orgaos ?? []).map((o) => ({ ...o, dependeDe: r.titulo }))]),
  ]
}
