import { COMPONENTES_NOTA, NOMES_COMPONENTES } from './resultado.js'
import { dataValida, erro, escolha, texto } from '../comum/validacao.js'

/*
  Prazos de lançamento das notas, definidos pela Administração Escolar / Direcção de Ensino.
  Para cada componente (1.ª prova, 2.ª prova, exame, recurso) vale o prazo mais específico:
  o da cadeira (prorrogação) > o da turma > o geral da Escola. Sem nenhum prazo definido, o lançamento
  dessa componente fica livre. Datas AAAA-MM-DD; o último dia conta.
*/
export function validarPrazo(d) {
  const componente = escolha(d.componente, 'componente', 'Componente', COMPONENTES_NOTA)
  if (!dataValida(d.inicio)) throw erro('inicio', 'Indique a data de início.')
  if (!dataValida(d.fim)) throw erro('fim', 'Indique a data de fim.')
  if (d.fim < d.inicio) throw erro('fim', 'O fim tem de ser depois do início.')
  return { componente, inicio: d.inicio, fim: d.fim, descricao: texto(d.descricao, 'descricao', 'Descrição', { max: 300, obrigatorio: false }) }
}

// estado de cada componente na cadeira: { p1: { livre, aberto, inicio, fim, origem, texto }, … }
export function estadoDosPrazos(prazos, cadeira, hoje) {
  const r = {}
  for (const k of COMPONENTES_NOTA) {
    const nivel = (p) => (p.cadeiraId === cadeira.id ? 3 : p.turmaId && p.turmaId === cadeira.turmaId ? 2 : !p.cadeiraId && !p.turmaId ? 1 : 0)
    const aplicaveis = prazos.filter((p) => p.componente === k && nivel(p) > 0)
    const maior = Math.max(0, ...aplicaveis.map(nivel))
    const doNivel = aplicaveis.filter((p) => nivel(p) === maior).sort((a, b) => a.inicio.localeCompare(b.inicio))
    if (!doNivel.length) { r[k] = { livre: true, aberto: true, texto: 'Sem prazo definido' }; continue }
    const atual = doNivel.find((p) => p.inicio <= hoje && hoje <= p.fim)
    const proximo = doNivel.find((p) => p.inicio > hoje)
    const ultimo = [...doNivel].reverse().find((p) => p.fim < hoje)
    const origem = { 3: 'prorrogação para esta cadeira', 2: 'prazo da turma', 1: 'prazo geral da Escola' }[maior]
    const fmt = (d) => d.split('-').reverse().join('/')
    if (atual) r[k] = { aberto: true, inicio: atual.inicio, fim: atual.fim, origem, texto: `Aberto até ${fmt(atual.fim)}` }
    else if (proximo) r[k] = { aberto: false, inicio: proximo.inicio, fim: proximo.fim, origem, texto: `Abre a ${fmt(proximo.inicio)}` }
    else r[k] = { aberto: false, inicio: ultimo?.inicio, fim: ultimo?.fim, origem, texto: `Fechado desde ${fmt(ultimo.fim)}` }
  }
  return r
}

export const mensagemFechado = (k, e) => `O prazo de lançamento da ${NOMES_COMPONENTES[k]} está fechado (${e.texto.toLowerCase()}, ${e.origem}). Peça à Administração Escolar uma prorrogação.`
