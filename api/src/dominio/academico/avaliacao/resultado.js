import { NOTA_MINIMA_APROVACAO, classificacao } from './nota.js'

// Resultado de um estudante numa cadeira (MAC, dispensa, exame, recurso).

/*
  Avaliação no ensino superior angolano (modelo do regulamento do ISP Tundavala, art. 19.º a 26.º;
  cada instituição tem o seu regulamento, por isso os números ficam aqui juntos):
  - duas provas parcelares (1.ª e 2.ª prova) por semestre; a sua média é a MAC (média de avaliação contínua);
  - MAC ≥ 14 sem nenhuma prova negativa: aprovado com dispensa de exame, nota final = MAC;
  - os restantes fazem exame na época normal: nota final = 40 % MAC + 60 % exame;
  - quem reprova no exame vai à época de recurso, com a mesma fórmula (o recurso substitui o exame);
  - a nota final é arredondada às unidades; classificação: < 10 reprovado, 10–13 suficiente, 14–16 bom, 17–20 muito bom.
*/
export const AVALIACAO = { macDispensa: 14, pesoMac: 0.4, pesoExame: 0.6 }

export const COMPONENTES_NOTA = ['p1', 'p2', 'exame', 'recurso']

export const NOMES_COMPONENTES = { p1: '1.ª Prova', p2: '2.ª Prova', exame: 'Exame', recurso: 'Recurso' }

export const temNota = (v) => v !== null && v !== undefined && v !== ''

/*
  Resultado de um estudante numa cadeira a partir das notas lançadas (null = ainda sem nota).
  situacao: em_curso (faltam provas) | dispensado | exame (aguarda exame) | recurso (aguarda recurso)
            | aprovado | reprovado
*/
export function resultadoDisciplina({ p1 = null, p2 = null, exame = null, recurso = null } = {}) {
  const v = (x) => (temNota(x) ? Number(x) : null)
  const [n1, n2, ne, nr] = [v(p1), v(p2), v(exame), v(recurso)]
  const vazio = { mac: null, final: null, situacao: 'em_curso', classificacao: null }
  if (n1 === null || n2 === null) return vazio
  const mac = Math.round(((n1 + n2) / 2) * 10) / 10
  const comPeso = (prova) => Math.round(AVALIACAO.pesoMac * mac + AVALIACAO.pesoExame * prova)
  const fim = (final, situacao) => ({ mac, final, situacao, classificacao: final === null ? null : classificacao(final) })

  if (mac >= AVALIACAO.macDispensa && n1 >= NOTA_MINIMA_APROVACAO && n2 >= NOTA_MINIMA_APROVACAO) {
    return fim(Math.round(mac), 'dispensado')
  }
  if (ne === null) return fim(null, 'exame')
  const normal = comPeso(ne)
  if (normal >= NOTA_MINIMA_APROVACAO) return fim(normal, 'aprovado')
  if (nr === null) return { ...fim(normal, 'recurso'), classificacao: null }
  const final = comPeso(nr)
  return fim(final, final >= NOTA_MINIMA_APROVACAO ? 'aprovado' : 'reprovado')
}

// o estudante só vê as componentes já publicadas pelo docente; o resultado conta só com essas
export function notasVisiveis(linha, publicadas) {
  const notas = Object.fromEntries(COMPONENTES_NOTA.map((k) => [k, publicadas.includes(k) ? linha?.[k] ?? null : null]))
  return { ...notas, ...resultadoDisciplina(notas), observacao: publicadas.length ? linha?.observacao || '' : '' }
}
