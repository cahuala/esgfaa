// datas e horas em português, a partir de ISO ("2026-10-13T10:00:00.000Z") ou "AAAA-MM-DD"

const local = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? new Date(`${v}T12:00:00`) : new Date(v))

export function data(v) {
  if (!v) return '—'
  const d = local(v)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function dataHora(v) {
  if (!v) return '—'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// "faltam 3 dias" / "termina hoje" / "terminou"
export function faltam(v, agora = new Date()) {
  const ms = new Date(v) - agora
  if (ms < 0) return 'terminou'
  const dias = Math.floor(ms / 86_400_000)
  if (dias === 0) return `termina hoje às ${new Date(v).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`
  return dias === 1 ? 'falta 1 dia' : `faltam ${dias} dias`
}

export const DIAS = ['', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export const nota = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 2 }))

export const tamanho = (bytes) => (bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)

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
  if (s < 60) return 'agora mesmo'
  if (s < 3600) return `há ${Math.floor(s / 60)} min`
  if (s < 86_400) return `há ${Math.floor(s / 3600)} h`
  if (s < 2 * 86_400) return 'ontem'
  return new Date(v).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })
}

// ícone e cor de cada tipo de notificação
export const ICONES_NOTIFICACAO = {
  material: ['fa-file-alt', 'bg-primary'], aviso: ['fa-bullhorn', 'bg-dark'], trabalho: ['fa-file-signature', 'bg-orange'],
  correcao: ['fa-check-double', 'bg-success'], notas: ['fa-clipboard-list', 'bg-red'], questionario: ['fa-question', 'bg-purple'],
  forum: ['fa-comments', 'bg-teal'], mensagem: ['fa-envelope', 'bg-blue'], prazo: ['fa-hourglass-half', 'bg-warning'],
  pedido: ['fa-file-signature', 'bg-gray-600'], geral: ['fa-calendar-alt', 'bg-indigo'],
}

// ISO -> valor de um <input type="datetime-local"> (hora local)
export const paraLocal = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

// motivos por que uma atividade ainda está fechada ao estudante (restrições de acesso)
export const textoBloqueio = (m) => (m.tipo === 'data'
  ? `Abre a ${dataHora(m.data)}`
  : m.notaMinima !== null && m.notaMinima !== undefined ? `Precisa de pelo menos ${nota(m.notaMinima)} valores em "${m.titulo}"` : `Precisa de concluir "${m.titulo}"`)
