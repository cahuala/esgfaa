import { FORMAS_SERVICO, POSTOS } from './hierarquia.js'

/*
  Tabela salarial por posto dos militares (a mesma do SIGP — Repartição de Finanças/CPD). Por posto e
  forma de prestação de serviço:
  - vencimento base (igual nos três ramos; pode ser diferente em cada forma de serviço);
  - condição militar = base × 30 %;
  - subsídio de representação: só de Coronel a General no Quadro Permanente (valores fixos da tabela);
  - comando/direcção/chefia = base × 5 %, de Coronel para baixo; os Oficiais Generais e o SMO não têm;
  - a condição militar, a representação e o comando/chefia podem escrever-se à mão em cada posto (como no SIGP);
  - total ilíquido = soma das anteriores; Caixa de Segurança Social = ilíquido × 3 %; líquido = ilíquido − SS.
  O vencimento real de cada militar (folha de vencimentos) escreve-se na ficha; a tabela serve de referência.
*/
export const VENCIMENTO_BASE = {
  soldado: 120000, segundo_cabo: 126000, primeiro_cabo: 135000, subsargento: 144000, segundo_sargento: 162000, primeiro_sargento: 180000,
  sargento_ajudante: 198000, sargento_chefe: 216000, sargento_maior: 234000, aspirante: 234000, subtenente: 270000,
  tenente: 288000, capitao: 306000, major: 324000, tenente_coronel: 342000, coronel: 360000, brigadeiro: 378000,
  tenente_general: 396000, general: 414000, general_exercito: 432000,
}
export const REPRESENTACAO_QP = { coronel: 56008.72, brigadeiro: 147990.85, tenente_general: 187364.56, general: 243302.38, general_exercito: 334540.77 }
export const PERCENTAGENS = { condicaoMilitar: 30, comandoChefia: 5, caixaSS: 3 }
export const PERC_CAIXA_SS = PERCENTAGENS.caixaSS

// postos de cada forma de prestação de serviço (Lei n.º 13/18): o SMO só tem praças, subsargento e aspirante
// (art. 127.º); o SMC chega a 1.º Sargento e a Tenente (art. 120.º); praças e subsargento só no SMO
const QP_POSTOS = ['segundo_sargento', 'primeiro_sargento', 'sargento_ajudante', 'sargento_chefe', 'sargento_maior', 'subtenente', 'tenente', 'capitao', 'major', 'tenente_coronel', 'coronel', 'brigadeiro', 'tenente_general', 'general', 'general_exercito']
const POSTOS_FPS = {
  QP: QP_POSTOS,
  SMC: ['segundo_sargento', 'primeiro_sargento', 'subtenente', 'tenente'],
  SMO: ['soldado', 'segundo_cabo', 'primeiro_cabo', 'subsargento', 'aspirante'],
  SMR: QP_POSTOS,
}

export const FORMAS_SERVICO_TABELA = Object.keys(POSTOS_FPS)

const arred = (v) => Math.round(v * 100) / 100

// as componentes que se podem escrever à mão em cada posto (como no SIGP); as não escritas calculam-se
export const COMPONENTES = ['base', 'condicaoMilitar', 'representacao', 'comandoChefia']

// a chave do alterado de um posto numa forma de serviço («QP:major»); a antiga, só do posto, vale para todas
export const chavePosto = (fps, posto) => `${fps}:${posto}`

// vencimento de referência de um posto e forma de serviço; bases = o alterado de cada posto e forma de serviço:
// o vencimento base (número, como antes) ou { base, condicaoMilitar, representacao, comandoChefia } (à mão)
export function vencimentoDoPosto(posto, fps = 'QP', bases = {}) {
  const p = POSTOS[posto]
  const v = bases[chavePosto(fps, posto)] ?? bases[posto]
  const o = v && typeof v === 'object' ? v : { base: v }
  const base = Number(o.base ?? VENCIMENTO_BASE[posto])
  if (!p || !base) return null
  const manual = COMPONENTES.filter((k) => k !== 'base' && o[k] !== undefined && o[k] !== null)
  const fixo = (k, calculado) => (manual.includes(k) ? Number(o[k]) : calculado)
  const general = p.categoria === 'oficial_general'
  const condicaoMilitar = fixo('condicaoMilitar', arred((base * PERCENTAGENS.condicaoMilitar) / 100))
  // a representação só no Quadro Permanente; o SMO não tem comando/direcção/chefia
  const representacao = fps === 'QP' ? fixo('representacao', REPRESENTACAO_QP[posto] ?? 0) : 0
  const comandoChefia = fps === 'SMO' ? 0 : fixo('comandoChefia', general ? 0 : arred((base * PERCENTAGENS.comandoChefia) / 100))
  const iliquido = arred(base + condicaoMilitar + representacao + comandoChefia)
  const caixaSS = arred((iliquido * PERCENTAGENS.caixaSS) / 100)
  return { base, condicaoMilitar, representacao, comandoChefia, iliquido, caixaSS, liquido: arred(iliquido - caixaSS), manual }
}

// a tabela inteira, agrupada por forma de prestação de serviço, do posto mais alto ao mais baixo
export function tabelaSalarial(bases = {}) {
  return Object.entries(POSTOS_FPS).map(([fps, postos]) => ({
    fps, nome: FORMAS_SERVICO[fps].nome,
    linhas: Object.values(POSTOS).filter((p) => postos.includes(p.id)).sort((a, b) => b.grau - a.grau).map((p) => ({ posto: p.id, ...vencimentoDoPosto(p.id, fps, bases) })),
  }))
}
