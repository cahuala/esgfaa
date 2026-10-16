import { t as tx, localAtual } from '../i18n/linguas'
// datas e horas em português, a partir de ISO ("2026-10-13T10:00:00.000Z") ou "AAAA-MM-DD"

const local = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? new Date(`${v}T12:00:00`) : new Date(v))

export function data(v) {
  if (!v) return '—'
  const d = local(v)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(localAtual(), { day: '2-digit', month: 'short', year: 'numeric' })
}

export function dataHora(v) {
  if (!v) return '—'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(localAtual(), { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// "faltam 3 dias" / "termina hoje" / "terminou"
export function faltam(v, agora = new Date()) {
  const ms = new Date(v) - agora
  if (ms < 0) return 'terminou'
  const dias = Math.floor(ms / 86_400_000)
  if (dias === 0) return tx('termina hoje às {0}', { 0: new Date(v).toLocaleTimeString(localAtual(), { hour: '2-digit', minute: '2-digit' }) })
  return dias === 1 ? tx('falta 1 dia') : tx('faltam {0} dias', { 0: dias })
}

export const DIAS = ['', tx('Segunda'), tx('Terça'), tx('Quarta'), tx('Quinta'), tx('Sexta'), tx('Sábado')]

export const nota = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString(localAtual(), { minimumFractionDigits: 0, maximumFractionDigits: 2 }))

export const tamanho = (bytes) => (bytes > 1048576 ? tx('{0} MB', { 0: (bytes / 1048576).toFixed(1) }) : tx('{0} KB', { 0: Math.max(1, Math.round(bytes / 1024)) }))

// valor de um <input type="datetime-local"> -> ISO (hora local)
export const localParaIso = (v) => (v ? new Date(v).toISOString() : '')

// nomes militares: a patente abreviada ("Maj.", "Ten.-Cor.") não conta como nome
const partes = (nome) => String(nome || '').split(/\s+/).filter((p) => p && !p.endsWith('.'))
export const primeiroNome = (nome) => partes(nome)[0] || nome
export const iniciais = (nome) => {
  const p = partes(nome)
  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase()
}

export const maiusculaInicial = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t)

// ícone Font Awesome conforme o tipo do ficheiro (PDF, Word, Excel, …)
const ICONES = [
  [/pdf/, 'fa-file-pdf text-danger'], [/word|document/, 'fa-file-word text-primary'], [/sheet|excel/, 'fa-file-excel text-success'],
  [/presentation|powerpoint/, 'fa-file-powerpoint text-warning'], [/^image\//, 'fa-file-image text-info'], [/^video\//, 'fa-file-video text-purple'],
  [/zip/, 'fa-file-archive text-gray-600'],
]
export const iconeFicheiro = (tipo = '') => ICONES.find(([re]) => re.test(tipo))?.[1] || 'fa-file-alt text-gray-600'

// "há 5 min", "há 2 h", "ontem", ou a data (notificações e mensagens)
export function ha(v, agora = new Date()) {
  const s = Math.round((agora - new Date(v)) / 1000)
  if (s < 60) return tx('agora mesmo')
  if (s < 3600) return tx('há {0} min', { 0: Math.floor(s / 60) })
  if (s < 86_400) return tx('há {0} h', { 0: Math.floor(s / 3600) })
  if (s < 2 * 86_400) return 'ontem'
  return new Date(v).toLocaleDateString(localAtual(), { day: '2-digit', month: 'short' })
}

// ícone e cor de cada tipo de notificação
export const ICONES_NOTIFICACAO = {
  material: ['fa-file-alt', 'bg-primary'], aviso: ['fa-bullhorn', 'bg-dark'], trabalho: ['fa-file-signature', 'bg-orange'],
  correcao: ['fa-check-double', 'bg-success'], notas: ['fa-clipboard-list', 'bg-red'], questionario: ['fa-question', 'bg-purple'],
  forum: ['fa-comments', 'bg-teal'], mensagem: ['fa-envelope', 'bg-blue'], prazo: ['fa-hourglass-half', 'bg-warning'],
  pedido: ['fa-file-signature', 'bg-gray-600'], geral: ['fa-calendar-alt', 'bg-indigo'], inquerito: ['fa-poll', 'bg-cyan'],
  biblioteca: ['fa-book', 'bg-lime'],
}

// ISO -> valor de um <input type="datetime-local"> (hora local)
export const paraLocal = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

// motivos por que uma atividade ainda está fechada ao estudante (restrições de acesso)
export const textoBloqueio = (m) => (m.tipo === 'data'
  ? tx('Abre a {0}', { 0: dataHora(m.data) })
  : m.notaMinima !== null && m.notaMinima !== undefined ? tx('Precisa de pelo menos {0} valores em "{1}"', { 0: nota(m.notaMinima), 1: m.titulo }) : tx('Precisa de concluir "{0}"', { 0: m.titulo }))

// videoconferência: 'em_breve' | 'abre' (15 min antes) | 'a_decorrer' | 'terminou'
export function estadoSessao(m, agora = new Date()) {
  if (!m.inicio) return 'em_breve'
  const inicio = new Date(m.inicio).getTime()
  const fim = inicio + (m.duracao || 60) * 60_000
  const t = agora.getTime()
  if (t >= fim) return 'terminou'
  if (t >= inicio) return 'a_decorrer'
  return t >= inicio - 15 * 60_000 ? 'abre' : 'em_breve'
}

// títulos da agenda compostos pela API em português ("Entrega: Ensaio…", "1.ª Prova")
const PREFIXOS_AGENDA = ['Entrega', 'Questionário', 'Videoconferência', 'Entrega (avaliação por pares)', 'Avaliar colegas']
export function tituloAgenda(titulo = '') {
  const m = /^([^:]+): ([\s\S]*)$/.exec(titulo)
  if (m && PREFIXOS_AGENDA.includes(m[1])) return `${tx(m[1])}: ${m[2]}`
  return tx(titulo)
}

// como um ficheiro se mostra no portal: pdf | video | audio | imagem (null: só se descarrega)
export const tipoVisivel = (tipo = '') => {
  if (tipo === 'application/pdf') return 'pdf'
  if (tipo.startsWith('video/')) return 'video'
  if (tipo.startsWith('audio/')) return 'audio'
  if (tipo.startsWith('image/')) return 'imagem'
  return null
}

// identificador de um vídeo do YouTube num endereço (watch, youtu.be, shorts, embed)
export const idYoutube = (url = '') => url.match(/(?:youtu\.be\/|[?&]v=|embed\/|shorts\/)([\w-]{11})/)?.[1] || null
