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
