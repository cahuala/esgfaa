import { ESCALA } from '../cadeira/escala'
import { t as tx } from '../../i18n/linguas'

/*
  Tipos de pergunta dos inquéritos (como no Google Forms) e regras partilhadas pelo formulário, pelo editor
  e pelos resultados. No servidor: api/src/dominio/comum/opiniao.js (as mesmas regras).
  "Caixas de verificação" e "Lista pendente" são uma escolha com multipla / lista.
*/
export const OUTRA = -1
export const TIPOS_EDITOR = {
  curta: { nome: tx('Resposta curta'), icone: 'fa-grip-lines' },
  aberta: { nome: tx('Parágrafo'), icone: 'fa-align-left' },
  escolha: { nome: tx('Escolha múltipla'), icone: 'fa-dot-circle' },
  caixas: { nome: tx('Caixas de verificação'), icone: 'fa-check-square' },
  lista: { nome: tx('Lista pendente'), icone: 'fa-caret-square-down' },
  escala: { nome: tx('Escala linear'), icone: 'fa-ellipsis-h' },
  grelha: { nome: tx('Grelha de escolha múltipla'), icone: 'fa-th' },
  grelhaCaixas: { nome: tx('Grelha de caixas de verificação'), icone: 'fa-border-all' },
  data: { nome: tx('Data'), icone: 'fa-calendar-alt' },
  hora: { nome: tx('Hora'), icone: 'fa-clock' },
}
// o tipo do editor a partir da pergunta guardada, e o contrário
export const tipoEditor = (p) => (p.tipo === 'escolha' ? (p.multipla ? 'caixas' : p.lista ? 'lista' : 'escolha') : p.tipo === 'grelha' && p.multipla ? 'grelhaCaixas' : p.tipo)
export function mudarTipo(p, novo) {
  const opcoes = p.opcoes?.length ? p.opcoes : ['']
  const base = { tipo: p.tipo, texto: p.texto, ...(p.descricao !== undefined ? { descricao: p.descricao } : {}), obrigatoria: p.obrigatoria ?? obrigatoriaPorOmissao(p.tipo) }
  if (novo === 'escolha' || novo === 'caixas' || novo === 'lista') return { ...base, tipo: 'escolha', opcoes, multipla: novo === 'caixas', lista: novo === 'lista', outra: novo !== 'lista' && Boolean(p.outra) }
  if (novo === 'grelha' || novo === 'grelhaCaixas') return { ...base, tipo: 'grelha', linhas: p.linhas?.length ? p.linhas : [''], colunas: p.colunas?.length ? p.colunas : ['', ''], multipla: novo === 'grelhaCaixas' }
  if (novo === 'escala') return { ...base, tipo: 'escala', min: p.min ?? 1, max: p.max ?? 5, rotuloMin: p.rotuloMin ?? '', rotuloMax: p.rotuloMax ?? '' }
  return { ...base, tipo: novo }
}

export const obrigatoriaPorOmissao = (tipo) => ['escala', 'escolha', 'grelha'].includes(tipo)
export const eObrigatoria = (p) => p.tipo !== 'seccao' && (p.obrigatoria ?? obrigatoriaPorOmissao(p.tipo))

export function respondida(p, v, outra) {
  if (p.tipo === 'escolha') return Array.isArray(v) && v.some((x) => x !== OUTRA || String(outra ?? '').trim())
  if (p.tipo === 'escala') return Number.isInteger(v)
  if (p.tipo === 'grelha') return Boolean(v) && p.linhas.every((_, l) => (Array.isArray(v[l]) ? v[l].length : v[l] !== undefined))
  return Boolean(String(v ?? '').trim())
}

// escala: limites e rótulos das pontas (a de 1 a 5 sem rótulos é a de concordância)
export function escalaDe(p) {
  const min = p.min ?? 1
  const max = p.max ?? 5
  const classica = min === 1 && max === 5
  return {
    min, max, valores: Array.from({ length: max - min + 1 }, (_, k) => min + k),
    rotuloMin: p.rotuloMin || (classica ? ESCALA[0] : ''), rotuloMax: p.rotuloMax || (classica ? ESCALA[4] : ''),
    nome: (n) => (classica && !p.rotuloMin && !p.rotuloMax ? ESCALA[n - 1] : String(n)),
  }
}

// páginas: cada secção começa uma; [{ seccao, indices }] (índices das perguntas na lista toda)
export function paginas(perguntas) {
  const r = [{ seccao: null, indices: [] }]
  perguntas.forEach((p, k) => {
    if (p.tipo === 'seccao') r.push({ seccao: { ...p, k }, indices: [] })
    else r.at(-1).indices.push(k)
  })
  return r.filter((x, i) => i > 0 || x.indices.length)
}
