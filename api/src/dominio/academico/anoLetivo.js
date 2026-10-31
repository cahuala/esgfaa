import { ErroValidacao } from '../comum/erros.js'

export const ANO_LETIVO = /^\d{4}\/\d{4}$/
const dia = (d) => new Date(`${String(d).slice(0, 10)}T00:00:00Z`)
const iso = (d) => new Date(d).toISOString().slice(0, 10)

// datas habituais de um ano letivo novo (outubro a julho; o 1.º semestre até meados de fevereiro)
export function datasPadrao(id) {
  const [a, b] = id.split('/').map(Number)
  return {
    inicio: `${a}-10-01`, fim: `${b}-07-31`,
    semestre1Inicio: `${a}-10-01`, semestre1Fim: `${b}-02-15`,
    semestre2Inicio: `${b}-02-16`, semestre2Fim: `${b}-07-31`,
  }
}

export function validarId(id) {
  if (!ANO_LETIVO.test(id || '')) throw new ErroValidacao('Ano letivo no formato 2026/2027.', { campo: 'id' })
  const [a, b] = id.split('/').map(Number)
  if (b !== a + 1) throw new ErroValidacao('O ano letivo tem dois anos seguidos (ex.: 2026/2027).', { campo: 'id' })
  return id
}

const CAMPOS = [['inicio', 'Início do ano'], ['semestre1Inicio', 'Início do 1.º semestre'], ['semestre1Fim', 'Fim do 1.º semestre'], ['semestre2Inicio', 'Início do 2.º semestre'], ['semestre2Fim', 'Fim do 2.º semestre'], ['fim', 'Fim do ano']]

// as datas: todas preenchidas e por ordem (o 2.º semestre depois do 1.º, e os dois dentro do ano)
export function validarDatas(d) {
  const r = {}
  for (const [k, rotulo] of CAMPOS) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d[k] || '')) || Number.isNaN(dia(d[k]).getTime())) throw new ErroValidacao(`${rotulo}: indique a data.`, { campo: k })
    r[k] = dia(d[k])
  }
  const antes = (x, y, msg, campo) => { if (r[x] > r[y]) throw new ErroValidacao(msg, { campo }) }
  antes('inicio', 'fim', 'O ano termina antes de começar.', 'fim')
  antes('semestre1Inicio', 'semestre1Fim', 'O 1.º semestre termina antes de começar.', 'semestre1Fim')
  antes('semestre2Inicio', 'semestre2Fim', 'O 2.º semestre termina antes de começar.', 'semestre2Fim')
  if (r.semestre2Inicio <= r.semestre1Fim) throw new ErroValidacao('O 2.º semestre começa depois do fim do 1.º.', { campo: 'semestre2Inicio' })
  antes('inicio', 'semestre1Inicio', 'O 1.º semestre começa dentro do ano letivo.', 'semestre1Inicio')
  antes('semestre2Fim', 'fim', 'O 2.º semestre acaba dentro do ano letivo.', 'semestre2Fim')
  return r
}

// o semestre em que está uma data ('1', '2' ou null — férias ou fora do ano)
export function semestreEm(ano, hoje) {
  const h = iso(hoje)
  if (h >= iso(ano.semestre1Inicio) && h <= iso(ano.semestre1Fim)) return '1'
  if (h >= iso(ano.semestre2Inicio) && h <= iso(ano.semestre2Fim)) return '2'
  return null
}

// uma cadeira do 1.º, do 2.º semestre ou anual: por começar, a decorrer ou terminada
export function estadoDoPeriodo(ano, periodo, hoje) {
  const [de, ate] = periodo === '1' ? [ano.semestre1Inicio, ano.semestre1Fim] : periodo === '2' ? [ano.semestre2Inicio, ano.semestre2Fim] : [ano.inicio, ano.fim]
  const h = iso(hoje)
  if (h < iso(de)) return 'por_comecar'
  if (h > iso(ate)) return 'terminada'
  return 'a_decorrer'
}

export const publicoAno = (a, hoje) => ({
  id: a.id, atual: a.atual, inicio: iso(a.inicio), fim: iso(a.fim),
  semestre1Inicio: iso(a.semestre1Inicio), semestre1Fim: iso(a.semestre1Fim), semestre2Inicio: iso(a.semestre2Inicio), semestre2Fim: iso(a.semestre2Fim),
  semestreAtual: semestreEm(a, hoje),
})
