import { api } from './api'
import { brasaoPng } from './documentos'

const hoje = () => new Date().toLocaleDateString('pt-PT')
const nomeFicheiro = (titulo, ext) => `${titulo.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'dados'}-${new Date().toISOString().slice(0, 10)}.${ext}`
// cada exportação fica registada na auditoria (quem levou que dados)
const registar = (tabela, formato, linhas) => api('/auditoria/exportacao', { metodo: 'POST', corpo: { tabela: tabela.slice(0, 120), formato, linhas } }).catch(() => {})

// colunas: [{ titulo, valor(linha) }] — o valor já em texto/número/data, como deve aparecer no ficheiro
export async function exportarExcel(titulo, colunas, linhas) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const cab = colunas.map((c) => ({ value: c.titulo, fontWeight: 'bold', backgroundColor: '#1f3a2d', textColor: '#ffffff' }))
  const corpo = linhas.map((l) => colunas.map((c) => {
    const v = c.valor(l)
    if (v === null || v === undefined || v === '') return null
    if (typeof v === 'number') return { value: v, type: Number }
    if (typeof v === 'boolean') return { value: v ? 'Sim' : 'Não', type: String }
    return { value: String(v), type: String }
  }))
  const largura = colunas.map((c, i) => ({ width: Math.min(50, Math.max(c.titulo.length, ...linhas.slice(0, 200).map((l) => String(colunas[i].valor(l) ?? '').length)) + 2) }))
  await writeXlsxFile([[{ value: `${titulo} — ${hoje()}`, fontWeight: 'bold', fontSize: 14 }], [], cab, ...corpo], { columns: largura, sheet: titulo.slice(0, 31).replace(/[\\/?*[\]:]/g, ' '), stickyRowsCount: 3 }).toFile(nomeFicheiro(titulo, 'xlsx'))
  registar(titulo, 'excel', linhas.length)
}

export async function exportarPdf(titulo, colunas, linhas, { subtitulo = '' } = {}) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ orientation: colunas.length > 6 ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' })
  const w = doc.internal.pageSize.getWidth()
  const brasao = await brasaoPng()
  if (brasao) doc.addImage(brasao, 'PNG', 14, 5, 15, 15)
  doc.setFont('helvetica', 'bold').setFontSize(11).text('ESCOLA SUPERIOR DE GUERRA', w / 2, 12, { align: 'center' })
  doc.setFont('helvetica', 'normal').setFontSize(9).text('Repartição de Pessoal e Quadros — Sistema de Gestão de Pessoal', w / 2, 17, { align: 'center' })
  doc.setFont('helvetica', 'bold').setFontSize(13).text(titulo, 14, 27)
  doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(90).text(`${subtitulo ? `${subtitulo} · ` : ''}${linhas.length} registo(s) · ${hoje()}`, 14, 32)
  doc.setTextColor(0)
  autoTable(doc, {
    startY: 36,
    head: [colunas.map((c) => c.titulo)],
    body: linhas.map((l) => colunas.map((c) => { const v = c.valor(l); return v === null || v === undefined ? '' : typeof v === 'boolean' ? (v ? 'Sim' : 'Não') : String(v) })),
    styles: { fontSize: 7.5, cellPadding: 1.6, overflow: 'linebreak' },
    headStyles: { fillColor: [31, 58, 45], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [244, 246, 244] },
    margin: { left: 14, right: 14, bottom: 14 },
    didDrawPage: () => {
      const h = doc.internal.pageSize.getHeight()
      doc.setFontSize(7).setTextColor(120)
      doc.text('Documento interno — uso exclusivo da Escola Superior de Guerra', 14, h - 7)
      doc.text(`Página ${doc.getNumberOfPages()}`, w - 14, h - 7, { align: 'right' })
      doc.setTextColor(0)
    },
  })
  doc.save(nomeFicheiro(titulo, 'pdf'))
  registar(titulo, 'pdf', linhas.length)
}
