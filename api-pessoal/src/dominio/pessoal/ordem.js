import { POSTOS } from './hierarquia.js'
import { CARREIRAS_CIVIS } from './civis.js'

/*
  Ordem hierárquica de todas as listas e tabelas de pessoal:
  1. o posto (o mais alto primeiro); os civis depois dos militares, pelo nível da carreira (Técnico Superior,
     Técnico Médio, Administrativo… e os domiciliares no fim);
  2. no mesmo posto, a ordem da unidade na orgânica (a Direcção antes dos Serviços Gerais; cada unidade
     logo seguida das suas subunidades), pela «ordem» de cada unidade;
  3. a função do cargo (comando, direcção/chefia, estado-maior, execução);
  4. a antiguidade no posto (a mais antiga primeiro) e, por fim, o nome.
  Os militares em «Missão de serviço» (indicados para um cargo sem nomeação efectiva) ficam no fim dos militares
  (antes dos civis), seja qual for o posto, e entre eles pela mesma ordem.
*/
const FUNCAO = { comando: 0, direccao_chefia: 1, estado_maior: 2, execucao: 3 }

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
  Comparador. x: { posto | grau, tipo, unidadeId, funcao (do cargo) | cargo: { funcao }, dataAntiguidadePosto, nome }.
  O posto de uma graduação activa conta (o graduado ocupa o lugar do posto em que está graduado), se vier em grauEfectivo.
*/
export function comparadorHierarquico(posicoes) {
  const data = (d) => (d ? new Date(d).getTime() : Infinity)
  // missaoServico vem dado quando «estado» é outra coisa (ex.: o estado do processo individual)
  const militar = (x) => Boolean(x.posto || x.grau || x.grauEfectivo)
  const emMissao = (x) => Boolean(x.missaoServico ?? x.estado === 'missao_servico')
  // 0: militares; 1: militares em missão de serviço; 2: civis
  const chave = (x) => [
    !militar(x) ? 2 : emMissao(x) ? 1 : 0,
    -(x.grauEfectivo ?? x.grau ?? (x.posto ? POSTOS[x.posto]?.grau : null) ?? -1),
    x.posto || x.grau || x.grauEfectivo ? 0 : x.vinculo === 'domiciliar' ? 99 : CARREIRAS_CIVIS[x.carreiraCivil]?.nivel ?? 50,
    posicoes.get(x.unidadeId) ?? 1e6,
    FUNCAO[x.funcao ?? x.cargo?.funcao] ?? 9,
    data(x.dataAntiguidadePosto),
  ]
  return (a, b) => {
    const ka = chave(a)
    const kb = chave(b)
    for (let k = 0; k < ka.length; k++) if (ka[k] !== kb[k]) return ka[k] - kb[k]
    return String(a.nome ?? '').localeCompare(String(b.nome ?? ''), 'pt')
  }
}

// ordena e numera: cada pessoa fica com «hierarquia» (1, 2, 3…), que as tabelas usam para voltar a esta ordem
export function ordenarPorHierarquia(lista, posicoes) {
  return [...lista].sort(comparadorHierarquico(posicoes)).map((x, i) => ({ ...x, hierarquia: i + 1 }))
}
