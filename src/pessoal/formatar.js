export const dataPt = (iso) => (iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00Z`).toLocaleDateString('pt-PT') : '—')
export const dataHoraPt = (iso) => (iso ? new Date(iso).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' }) : '—')
export const anos = (n) => (n === null || n === undefined ? '—' : `${String(n).replace('.', ',')} ano${n === 1 ? '' : 's'}`)
