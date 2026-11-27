/*
  O catálogo das cadeiras da Escola (das relações do corpo docente): o departamento de cada uma e os seus docentes
  habituais. Liga-se às cadeiras dos planos de curso pelo nome, que vem escrito de muitas maneiras
  («Metodologia de Invest. Ciêntifica», «Metodologia da Investigação Científica»…):
    - cada palavra do catálogo tem de estar no nome da cadeira (as abreviaturas valem: «Invest.» = «Investigação»);
    - com menos de três palavras, a primeira tem de ser a do nome («Geopolítica» → «Geopolítica Aplicada»; não «Liderança
      Estratégica»); as palavras contam iguais nas primeiras seis letras («Invest.» = «Investigação», mas não «Inter…»);
    - ganha a entrada do catálogo com mais palavras em comum.
*/
const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'em', 'na', 'no', 'nas', 'nos', 'para', 'ao', 'aos', 'as', 'os', 'à', 'às'])
const ABREVIATURAS = { adm: 'administracao', invest: 'investigacao', metod: 'metodologia', met: 'metodologia', com: 'comunicacao', rel: 'relacoes', publ: 'publicas', int: 'internacional', inter: 'internacional', plan: 'planeamento', org: 'organizacao', lg: 'logistica', logitica: 'logistica', cienciais: 'ciencias' }

export function palavras(nome) {
  return String(nome ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]+/g, ' ').split(' ')
    .filter((w) => w && !PARTICULAS.has(w)).map((w) => ABREVIATURAS[w] ?? w)
}

const igual = (a, b) => (a.length >= 6 && b.length >= 6 ? a.slice(0, 6) === b.slice(0, 6) : a === b || (a.length >= 3 && b.startsWith(a)) || (b.length >= 3 && a.startsWith(b)))

// a entrada do catálogo que corresponde ao nome de uma cadeira (ou null)
export function noCatalogo(nome, catalogo = []) {
  const n = palavras(nome)
  if (!n.length) return null
  let melhor = null
  for (const c of catalogo) {
    const p = palavras(c.nome)
    if (!p.length || !p.every((w) => n.some((x) => igual(w, x)))) continue
    // com menos de três palavras, o nome tem de começar pela mesma («Geopolítica» → «Geopolítica Aplicada»)
    if (p.length < 3 && !igual(p[0], n[0])) continue
    const pontos = p.length * 10 - (n.length - p.length)
    if (!melhor || pontos > melhor.pontos) melhor = { c, pontos }
  }
  return melhor?.c ?? null
}
