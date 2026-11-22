import { POSTOS } from './hierarquia.js'
import { CARREIRAS_CIVIS } from './civis.js'

/*
  Ordem hierárquica de todas as listas e tabelas de pessoal (a mesma das listas do Ensino):
  1. o posto (o mais alto primeiro; o graduado conta no posto em que está graduado); os civis depois dos militares,
     pelo nível da carreira (Técnico Superior, Técnico Médio, Administrativo… e os domiciliares no fim);
  2. dentro do mesmo posto (ou nível), por ordem alfabética do nome.
  (A Lista de antiguidade é a excepção: ordena pela antiguidade, que é o que mostra.)
*/

// posição de cada unidade na árvore (percorrida pela ordem e pelo nome): Map id -> 0, 1, 2…
export function posicoesDasUnidades(unidades) {
  const filhos = new Map()
  for (const u of unidades) { const k = u.paiId ?? 0; if (!filhos.has(k)) filhos.set(k, []); filhos.get(k).push(u) }
  const pos = new Map()
  const visitar = (k) => {
    for (const u of (filhos.get(k) ?? []).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || a.nome.localeCompare(b.nome, 'pt'))) {
      if (pos.has(u.id)) continue
      pos.set(u.id, pos.size)
      visitar(u.id)
    }
  }
  visitar(0)
  // unidades sem caminho até à raiz (ciclo): no fim
  for (const u of unidades) if (!pos.has(u.id)) pos.set(u.id, pos.size)
  return pos
}

/*
  Comparador. x: { posto | grau | grauEfectivo, tipo, vinculo, carreiraCivil, nome }.
  O posto de uma graduação activa conta (o graduado ocupa o lugar do posto em que está graduado), se vier em grauEfectivo.
*/
// (as posições das unidades já não contam; o parâmetro fica para quem ainda o passa)
export function comparadorHierarquico() {
  const chave = (x) => [
    -(x.grauEfectivo ?? x.grau ?? (x.posto ? POSTOS[x.posto]?.grau : null) ?? -1),
    x.posto || x.grau || x.grauEfectivo ? 0 : x.vinculo === 'domiciliar' ? 99 : CARREIRAS_CIVIS[x.carreiraCivil]?.nivel ?? 50,
  ]
  return (a, b) => {
    const ka = chave(a)
    const kb = chave(b)
    for (let k = 0; k < ka.length; k++) if (ka[k] !== kb[k]) return ka[k] - kb[k]
    return String(a.nome ?? '').localeCompare(String(b.nome ?? ''), 'pt', { sensitivity: 'base' })
  }
}

// ordena e numera: cada pessoa fica com «hierarquia» (1, 2, 3…), que as tabelas usam para voltar a esta ordem
export function ordenarPorHierarquia(lista, posicoes) {
  return [...lista].sort(comparadorHierarquico(posicoes)).map((x, i) => ({ ...x, hierarquia: i + 1 }))
}
