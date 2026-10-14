import { NOTA_MINIMA_APROVACAO } from './regras.js'

/*
  Indicadores da Administração Escolar: estudantes em risco e pautas em atraso.
  Limiares escolhidos para a ESG (ajustáveis aqui):
*/
export const ASSIDUIDADE_MINIMA = 75 // % de presenças abaixo da qual o estudante está em risco
export const DIAS_SEM_ACESSO = 14 // dias sem entrar no portal
export const DIAS_PARA_LANCAR = 15 // dias depois da prova para a nota estar lançada

const dias = (a, b) => Math.floor((a - b) / 86_400_000)

/*
  Motivos de risco de um estudante. assiduidades: [{ cadeira, valor }]; notas: linhas da pauta
  com { cadeira, p1, p2, mac, situacao }; ultimoAcesso: ISO ou null.
  Devolve [{ tipo: 'faltas'|'nota'|'situacao'|'acesso', texto, cadeira? }].
*/
export function motivosDeRisco({ assiduidades = [], notas = [], ultimoAcesso = null, agora = new Date() }) {
  const motivos = []
  for (const a of assiduidades) {
    if (a.valor !== null && a.valor < ASSIDUIDADE_MINIMA) motivos.push({ tipo: 'faltas', cadeira: a.cadeira, texto: `${a.valor}% de presenças` })
  }
  for (const n of notas) {
    if (n.situacao === 'reprovado') motivos.push({ tipo: 'situacao', cadeira: n.cadeira, texto: 'Reprovado' })
    else if (n.situacao === 'recurso') motivos.push({ tipo: 'situacao', cadeira: n.cadeira, texto: 'Vai a recurso' })
    else {
      const negativas = [['1.ª prova', n.p1], ['2.ª prova', n.p2]].filter(([, v]) => v !== null && v !== undefined && Number(v) < NOTA_MINIMA_APROVACAO)
      if (negativas.length) motivos.push({ tipo: 'nota', cadeira: n.cadeira, texto: `Negativa na ${negativas.map(([k, v]) => `${k} (${Number(v)})`).join(' e na ')}` })
    }
  }
  if (!ultimoAcesso) motivos.push({ tipo: 'acesso', texto: 'Nunca entrou no portal' })
  else if (dias(agora, new Date(ultimoAcesso)) >= DIAS_SEM_ACESSO) motivos.push({ tipo: 'acesso', texto: `Sem entrar no portal há ${dias(agora, new Date(ultimoAcesso))} dias` })
  return motivos
}

/*
  Componentes com notas por lançar depois da data da prova: eventos (p1, p2, exame, recurso) com a data
  passada há DIAS_PARA_LANCAR dias, e estudantes que deviam ter essa nota e não têm.
  linhas: as da pauta (com situacao). Devolve [{ componente, data, diasAtraso, faltam }].
*/
export function pautasEmAtraso(eventos, linhas, agora = new Date()) {
  const devia = {
    p1: () => true,
    p2: () => true,
    exame: (l) => l.situacao === 'exame',
    recurso: (l) => l.situacao === 'recurso',
  }
  const r = []
  for (const e of eventos) {
    if (!devia[e.tipo]) continue
    const atraso = dias(agora, new Date(`${e.data}T23:59:59Z`))
    if (atraso < DIAS_PARA_LANCAR) continue
    const faltam = linhas.filter((l) => devia[e.tipo](l) && (l[e.tipo] === null || l[e.tipo] === undefined)).length
    if (faltam) r.push({ componente: e.tipo, data: e.data, diasAtraso: atraso, faltam })
  }
  return r
}

// taxa de aprovação de quem já tem resultado final (dispensados e aprovados sobre os que terminaram)
export function taxaAprovacao(linhas) {
  const terminaram = linhas.filter((l) => ['aprovado', 'dispensado', 'reprovado'].includes(l.situacao))
  if (!terminaram.length) return null
  return Math.round((terminaram.filter((l) => l.situacao !== 'reprovado').length / terminaram.length) * 100)
}

export function media(valores) {
  const v = valores.filter((x) => x !== null && x !== undefined).map(Number)
  return v.length ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10) / 10 : null
}
