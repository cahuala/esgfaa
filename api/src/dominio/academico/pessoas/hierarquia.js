/*
  Ordem das listas académicas (Lei n.º 13/18), a mesma do Sistema de Pessoal: pelo posto, do mais alto para o mais
  baixo (os postos equivalentes dos três ramos contam igual — ex.: Coronel = Capitão-de-Mar-e-Guerra); no mesmo posto,
  pela hierarquia da unidade (a posição da unidade na orgânica, que vem do Pessoal em dados.ordemUnidade: o Comando
  antes das Direcções, cada unidade seguida das suas subunidades; quem não tem unidade na orgânica vem depois); e por
  fim por ordem alfabética do nome. Os civis (sem posto) vêm depois dos militares, pela mesma ordem.
  O posto vem do Sistema de Gestão de Pessoal (dados.posto; na Polícia Nacional e nas forças estrangeiras, o posto
  equivalente das FAA em dados.postoEquivalente); nas contas antigas, da abreviatura no nome («Maj. …»).
*/
const GRAUS = [
  [20, 'General de Exército', 'General de Aviação', 'Almirante da Armada'],
  [19, 'General', 'Almirante', 'Gen.', 'Alm.'],
  [18, 'Tenente-General', 'Vice-Almirante', 'Ten.-Gen.', 'V.-Alm.'],
  [17, 'Brigadeiro', 'Contra-Almirante', 'Brig.', 'C.-Alm.'],
  [16, 'Coronel', 'Capitão-de-Mar-e-Guerra', 'Cor.', 'CMG'],
  [15, 'Tenente-Coronel', 'Capitão-de-Fragata', 'Ten.-Cor.', 'Cap.-Fr.'],
  [14, 'Major', 'Capitão-de-Corveta', 'Maj.', 'Cap.-Cv.'],
  [13, 'Capitão', 'Tenente-de-Navio', 'Cap.', 'Ten.-Nav.'],
  [12, 'Tenente', 'Tenente-de-Fragata', 'Ten.', 'Ten.-Fr.'],
  [11, 'Subtenente', 'Tenente-de-Corveta', 'Subten.', 'Ten.-Cv.'],
  [10, 'Aspirante', 'Guarda-Marinha', 'Asp.', 'G.-Mar.'],
  [9, 'Sargento-Maior', 'Sarg.-Mor'],
  [8, 'Sargento-Chefe', 'Sarg.-Ch.'],
  [7, 'Sargento-Ajudante', 'Sarg.-Aj.'],
  [6, '1.º Sargento', '1.º Sarg.'],
  [5, '2.º Sargento', '2.º Sarg.'],
  [4, 'Subsargento', 'Subsarg.'],
  [3, '1.º Cabo', 'Cabo'],
  [2, '2.º Cabo', 'Marinheiro', 'Mar.'],
  [1, 'Soldado', 'Grumete', 'Sold.', 'Grum.'],
]
const chave = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
const GRAU = new Map(GRAUS.flatMap(([g, ...nomes]) => nomes.map((n) => [chave(n), g])))
// abreviaturas/postos no início do nome, das mais compridas para as mais curtas («Ten.-Cor.» antes de «Ten.»)
const PREFIXOS = [...GRAU.keys()].sort((a, b) => b.length - a.length)

// o grau do posto (0 = civil ou sem posto)
export function grauDe(pessoa) {
  const p = chave(pessoa?.dados?.posto ?? pessoa?.posto)
  if (p && GRAU.has(p)) return GRAU.get(p)
  // Polícia Nacional e forças estrangeiras: o posto das FAA da mesma categoria (vem do Pessoal)
  const eq = chave(pessoa?.dados?.postoEquivalente)
  if (eq && GRAU.has(eq)) return GRAU.get(eq)
  const n = chave(pessoa?.nome)
  const pre = PREFIXOS.find((x) => n.startsWith(`${x} `))
  return pre ? GRAU.get(pre) : 0
}

// o nome sem o posto à frente («Maj. João Fernandes» → «João Fernandes»), para a ordem alfabética
export function nomeSemPosto(nome) {
  const n = String(nome ?? '').trim()
  const k = chave(n)
  const pre = PREFIXOS.find((x) => k.startsWith(`${x} `))
  return pre ? n.split(/\s+/).slice(pre.split(' ').length).join(' ') : n
}

// a posição da unidade na orgânica (sem ela, no fim)
const ordemDaUnidade = (p) => { const v = Number(p?.dados?.ordemUnidade ?? p?.ordemUnidade); return Number.isFinite(v) && v >= 0 ? v : 1e9 }
export const compararHierarquia = (a, b) => grauDe(b) - grauDe(a) || ordemDaUnidade(a) - ordemDaUnidade(b) || nomeSemPosto(a?.nome).localeCompare(nomeSemPosto(b?.nome), 'pt', { sensitivity: 'base' })

// ordena uma lista de pessoas (ou de linhas que têm a pessoa em «de(linha)»)
export const ordenarPorHierarquia = (lista, de = (x) => x) => [...lista].sort((a, b) => compararHierarquia(de(a), de(b)))
