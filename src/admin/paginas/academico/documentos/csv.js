// descarrega uma tabela em CSV para o Excel (separador ";" e vírgula decimal, como no Excel em português)
const celula = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
export const decimal = (v) => (v === null || v === undefined || v === '' ? '' : String(v).replace('.', ','))

export function descarregarCsv(nome, linhas) {
  const texto = linhas.map((l) => l.map(celula).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob(['\uFEFF', texto], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${nome}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export const dataPt = (v) => (v ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T12:00:00` : v).toLocaleDateString('pt-PT') : '')
export const valor = (v) => (v === null || v === undefined || v === '' ? '—' : Number(v).toLocaleString('pt-PT', { maximumFractionDigits: 2 }))
