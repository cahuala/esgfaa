// "2026-10-09 09:21:50" (UTC, vindo da API) -> data e hora locais
export function dataHora(utc) {
  if (!utc) return '—'
  const d = new Date(`${String(utc).replace(' ', 'T')}Z`)
  return d.toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })
}

// "2026-10-09" -> "09/10/2026"
export function dataCurta(iso) {
  if (!iso) return '—'
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}
