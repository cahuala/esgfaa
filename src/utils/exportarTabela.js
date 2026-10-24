import Brasao from '../assets/Logo-ecra.webp'

/*
  Exportar o que a tabela mostra (painel e Portal): as linhas que a pesquisa e os filtros deixaram, todas
  as páginas, pela ordem do ecrã. Excel (.xlsx) ou PDF com o brasão da Escola; o filtro usado fica escrito
  no topo, para quem lê saber o que é a lista.
  colunas: [{ titulo, valor(linha) }] — o valor já como deve aparecer (texto, número, Sim/Não).
*/

const hoje = () => new Date().toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
export const nomeFicheiro = (titulo, ext) => `${String(titulo).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'dados'}-${new Date().toISOString().slice(0, 10)}.${ext}`
const texto = (v) => (v === null || v === undefined ? '' : typeof v === 'boolean' ? (v ? 'Sim' : 'Não') : String(v))

// a tabela em valores: [[cabeçalhos], [linha], …]; as colunas vazias em todos os resultados saem
export function valoresDaTabela(colunas, linhas) {
  const corpo = linhas.map((l) => colunas.map((c) => {
    const v = c.valor(l)
    return v === null || v === undefined || v === '' ? null : typeof v === 'number' ? v : texto(v)
  }))
  const ficam = colunas.map((_, i) => !corpo.length || corpo.some((l) => l[i] !== null))
  return [colunas.map((c) => c.titulo).filter((_, i) => ficam[i]), ...corpo.map((l) => l.filter((_, i) => ficam[i]))]
}

async function excel(titulo, colunas, linhas, filtro) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const [cab, ...corpo] = valoresDaTabela(colunas, linhas)
  const celula = (v) => (v === null ? null : typeof v === 'number' ? { value: v, type: Number } : { value: v, type: String })
  const topo = [
    [{ value: titulo, fontWeight: 'bold', fontSize: 14 }],
    [{ value: `Escola Superior de Guerra · ${hoje()} · ${linhas.length} registo(s)`, type: String }],
    ...(filtro ? [[{ value: `Filtros aplicados: ${filtro}`, type: String }]] : []),
    [],
  ]
  const largura = cab.map((t, i) => ({ width: Math.min(60, Math.max(t.length, ...corpo.slice(0, 300).map((l) => String(l[i] ?? '').length)) + 2) }))
  await writeXlsxFile([
    ...topo,
    cab.map((t) => ({ value: t, fontWeight: 'bold', backgroundColor: '#1f3a2d', textColor: '#ffffff' })),
    ...corpo.map((l) => l.map(celula)),
  ], { columns: largura, sheet: titulo.slice(0, 31).replace(/[\\/?*[\]:]/g, ' '), stickyRowsCount: topo.length + 1 }).toFile(nomeFicheiro(titulo, 'xlsx'))
}

// o brasão (WebP) passa a PNG pequeno, que o jsPDF aceita
let brasao
const brasaoPng = () => (brasao ??= new Promise((ok) => {
  const img = new Image()
  img.onload = () => {
    const k = Math.min(1, 240 / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * k)
    c.height = Math.round(img.height * k)
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
    ok({ dados: c.toDataURL('image/png'), proporcao: img.width / img.height })
  }
  img.onerror = () => ok(null)
  img.src = Brasao
}))

async function pdf(titulo, colunas, linhas, filtro) {
  const [{ jsPDF }, { autoTable }, b] = await Promise.all([import('jspdf'), import('jspdf-autotable'), brasaoPng()])
  const doc = new jsPDF({ orientation: colunas.length > 6 ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' })
  const w = doc.internal.pageSize.getWidth()
  if (b) doc.addImage(b.dados, 'PNG', w / 2 - 7 * b.proporcao, 8, 14 * b.proporcao, 14)
  doc.setFont('helvetica', 'normal').setFontSize(8).text('FORÇAS ARMADAS ANGOLANAS', w / 2, 26, { align: 'center' })
  doc.setFont('helvetica', 'bold').text('ESCOLA SUPERIOR DE GUERRA', w / 2, 30, { align: 'center' })
  doc.setFontSize(12).text(titulo, w / 2, 38, { align: 'center' })
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(90)
  doc.text(`${hoje()} · ${linhas.length} registo(s)${filtro ? ` · Filtros aplicados: ${filtro}` : ''}`, w / 2, 43, { align: 'center', maxWidth: w - 28 })
  doc.setTextColor(0)
  const [cab, ...corpo] = valoresDaTabela(colunas, linhas)
  autoTable(doc, {
    startY: 48,
    head: [cab],
    body: corpo.map((l) => l.map((v) => texto(v))),
    styles: { fontSize: 7.5, cellPadding: 1.4, overflow: 'linebreak' },
    headStyles: { fillColor: [31, 58, 45], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: 12, right: 12, bottom: 14 },
    didDrawPage: () => {
      const h = doc.internal.pageSize.getHeight()
      doc.setFontSize(7).setTextColor(120).text(`${titulo} · página ${doc.getNumberOfPages()}`, w - 12, h - 7, { align: 'right' }).setTextColor(0)
    },
  })
  doc.save(nomeFicheiro(titulo, 'pdf'))
}

export async function exportarTabela(formato, { titulo, colunas, linhas, filtro = '' }) {
  if (formato === 'pdf') await pdf(titulo, colunas, linhas, filtro)
  else await excel(titulo, colunas, linhas, filtro)
}
