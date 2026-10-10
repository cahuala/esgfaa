// "2026-10-09 09:21:50" ou "2026-10-09T09:21:50.000Z" (UTC, vindo da API) -> data e hora locais
export function dataHora(utc) {
  if (!utc) return '—'
  const iso = String(utc).replace(' ', 'T')
  const d = new Date(/(Z|[+-]\d{2}:\d{2})$/.test(iso) ? iso : `${iso}Z`)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })
}

// "2026-10-09" -> "09/10/2026"
export function dataCurta(iso) {
  if (!iso) return '—'
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}
