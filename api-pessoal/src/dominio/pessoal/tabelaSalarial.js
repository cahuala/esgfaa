import { FORMAS_SERVICO, POSTOS } from './hierarquia.js'

/*
  Tabela salarial por posto dos militares (a mesma do SIGP — Repartição de Finanças/CPD). Por posto e
  forma de prestação de serviço:
  - vencimento base (igual em todas as formas de serviço e nos três ramos; é o único valor que se altera);
  - condição militar = base × 30 %;
  - subsídio de representação: só de Coronel a General no Quadro Permanente (valores fixos da tabela);
  - comando/direcção/chefia = base × 5 %, de Coronel para baixo; os Oficiais Generais e o SMO não têm;
  - total ilíquido = soma das anteriores; Caixa de Segurança Social = ilíquido × 3 %; líquido = ilíquido − SS.
  O vencimento real de cada militar (folha de vencimentos) escreve-se na ficha; a tabela serve de referência.
*/
export const VENCIMENTO_BASE = {
  soldado: 120000, segundo_cabo: 126000, subsargento: 144000, segundo_sargento: 162000, primeiro_sargento: 180000,
  sargento_ajudante: 198000, sargento_chefe: 216000, sargento_maior: 234000, aspirante: 234000, subtenente: 270000,
  tenente: 288000, capitao: 306000, major: 324000, tenente_coronel: 342000, coronel: 360000, brigadeiro: 378000,
  tenente_general: 396000, general: 414000, general_exercito: 432000,
}
export const REPRESENTACAO_QP = { coronel: 56008.72, brigadeiro: 147990.85, tenente_general: 187364.56, general: 243302.38, general_exercito: 334540.77 }
export const PERCENTAGENS = { condicaoMilitar: 30, comandoChefia: 5, caixaSS: 3 }
export const PERC_CAIXA_SS = PERCENTAGENS.caixaSS

// postos de cada forma de prestação de serviço (Lei n.º 13/18): o SMO só tem praças, subsargento e aspirante
// (art. 127.º); o SMC chega a 1.º Sargento e a Tenente (art. 120.º); praças e subsargento só no SMO
const GRAUS_FPS = {
  QP: [4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
  SMC: [4, 5, 10, 11],
  SMO: [1, 2, 3, 9],
  SMR: [4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
}

const arred = (v) => Math.round(v * 100) / 100

// vencimento de referência de um posto e forma de serviço; bases = vencimentos base alterados (por posto)
export function vencimentoDoPosto(posto, fps = 'QP', bases = {}) {
  const p = POSTOS[posto]
  const base = Number(bases[posto] ?? VENCIMENTO_BASE[posto])
  if (!p || !base) return null
  const general = p.categoria === 'oficial_general'
  const condicaoMilitar = arred((base * PERCENTAGENS.condicaoMilitar) / 100)
  const representacao = fps === 'QP' ? REPRESENTACAO_QP[posto] ?? 0 : 0
  const comandoChefia = general || fps === 'SMO' ? 0 : arred((base * PERCENTAGENS.comandoChefia) / 100)
  const iliquido = arred(base + condicaoMilitar + representacao + comandoChefia)
  const caixaSS = arred((iliquido * PERCENTAGENS.caixaSS) / 100)
  return { base, condicaoMilitar, representacao, comandoChefia, iliquido, caixaSS, liquido: arred(iliquido - caixaSS) }
}

// a tabela inteira, agrupada por forma de prestação de serviço, do posto mais alto ao mais baixo
export function tabelaSalarial(bases = {}) {
  return Object.entries(GRAUS_FPS).map(([fps, graus]) => ({
    fps, nome: FORMAS_SERVICO[fps].nome,
    linhas: Object.values(POSTOS).filter((p) => graus.includes(p.grau)).sort((a, b) => b.grau - a.grau).map((p) => ({ posto: p.id, ...vencimentoDoPosto(p.id, fps, bases) })),
  }))
}
