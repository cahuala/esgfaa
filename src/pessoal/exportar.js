import { api } from './api'
import { brasaoPng, emblema } from './documentos'

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
  emblema(doc, brasao, 20, 4, 17)
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

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const texto = (v) => (v === null || v === undefined ? '' : typeof v === 'boolean' ? (v ? 'Sim' : 'Não') : String(v))

/*
  Documento oficial com secções (listas, mapas): cabeçalho com o brasão e a cadeia hierárquica, uma tabela
  por secção (com linha de totais, se houver), assinatura do Chefe da Repartição e páginas numeradas.
  d = { titulo, subtitulo, seccoes: [{ titulo, colunas: [{ titulo, valor(linha, i), alinhar }], linhas, totais }],
        orientacao: 'portrait' | 'landscape', assinatura, nota }
*/
export async function documentoPdf(d) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const largas = d.seccoes.some((s) => s.colunas.length > 7)
  const doc = new jsPDF({ orientation: d.orientacao ?? (largas ? 'landscape' : 'portrait'), unit: 'mm', format: 'a4' })
  const w = doc.internal.pageSize.getWidth()
  const brasao = await brasaoPng()
  emblema(doc, brasao, w / 2, 5, 19)
  doc.setFont('helvetica', 'bold').setFontSize(9)
  doc.text('REPÚBLICA DE ANGOLA', w / 2, 27, { align: 'center' })
  doc.text('FORÇAS ARMADAS ANGOLANAS', w / 2, 31, { align: 'center' })
  doc.text('ESCOLA SUPERIOR DE GUERRA', w / 2, 35, { align: 'center' })
  doc.setFont('helvetica', 'normal').setFontSize(8.5).text('Repartição de Pessoal e Quadros', w / 2, 39, { align: 'center' })
  doc.setFont('helvetica', 'bold').setFontSize(12.5).text(doc.splitTextToSize(d.titulo.toUpperCase(), w - 40), w / 2, 47, { align: 'center' })
  const total = d.seccoes.reduce((n, s) => n + (s.contar === false ? 0 : s.linhas.length), 0)
  // mapas (só quadros de totais): não se contam registos
  const mapa = d.seccoes.every((s) => s.contar === false)
  doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(80)
  doc.text([d.subtitulo, mapa ? '' : `${total} registo(s)`, `Situação em ${hoje()}`].filter(Boolean).join(' · '), w / 2, 53, { align: 'center' })
  doc.setTextColor(0).setLineWidth(0.3).line(14, 56, w - 14, 56)
  let y = 61
  if (!d.seccoes.some((s) => s.linhas.length)) {
    doc.setFontSize(10).text('Sem registos para os critérios escolhidos.', 14, y + 4)
    y += 10
  }
  for (const s of d.seccoes) {
    if (!s.linhas.length && !s.mostrarVazia) continue
    if (y > doc.internal.pageSize.getHeight() - 30) { doc.addPage(); y = 18 }
    if (s.titulo) {
      doc.setFont('helvetica', 'bold').setFontSize(10).text(`${s.titulo}${s.contar === false ? '' : ` (${s.linhas.length})`}`, 14, y)
      y += 2
    }
    autoTable(doc, {
      startY: y,
      head: [s.colunas.map((c) => c.titulo)],
      body: s.linhas.map((l, i) => s.colunas.map((c) => texto(c.valor(l, i)))),
      foot: s.totais ? [s.totais.map((v, i) => ({ content: texto(v), styles: { halign: s.colunas[i]?.alinhar ?? 'left' } }))] : undefined,
      showFoot: 'lastPage',
      theme: 'grid',
      styles: { fontSize: 7.6, cellPadding: 1.4, overflow: 'linebreak', lineColor: [200, 205, 200] },
      headStyles: { fillColor: [31, 58, 45], textColor: 255, fontStyle: 'bold', halign: 'center' },
      footStyles: { fillColor: [232, 236, 231], textColor: 0, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [247, 248, 247] },
      columnStyles: Object.fromEntries(s.colunas.map((c, i) => [i, { halign: c.alinhar ?? 'left', ...(c.largura ? { cellWidth: c.largura } : {}) }])),
      margin: { left: 14, right: 14, top: 16, bottom: 16 },
    })
    y = doc.lastAutoTable.finalY + 7
  }
  if (d.nota) {
    doc.setFontSize(7.5).setTextColor(90).text(doc.splitTextToSize(d.nota, w - 28), 14, y).setTextColor(0)
    y += 8
  }
  if (d.assinatura !== false) {
    if (y > doc.internal.pageSize.getHeight() - 42) { doc.addPage(); y = 25 }
    const agora = new Date()
    doc.setFontSize(9).text(`Luanda, aos ${agora.getDate()} de ${MESES[agora.getMonth()]} de ${agora.getFullYear()}`, w - 14, y + 2, { align: 'right' })
    doc.setFont('helvetica', 'bold').setFontSize(8.5).text('O CHEFE DA REPARTIÇÃO DE PESSOAL E QUADROS', w / 2, y + 14, { align: 'center' })
    doc.setFont('helvetica', 'normal').line(w / 2 - 35, y + 32, w / 2 + 35, y + 32)
  }
  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)
    const h = doc.internal.pageSize.getHeight()
    doc.setFontSize(7).setTextColor(120).text('Documento interno — uso exclusivo da Escola Superior de Guerra (Lei n.º 22/11)', 14, h - 7)
    doc.text(`Página ${i} de ${n}`, w - 14, h - 7, { align: 'right' }).setTextColor(0)
  }
  doc.save(nomeFicheiro(d.titulo, 'pdf'))
  registar(d.titulo, 'pdf', total)
}

// o mesmo documento em Excel: uma folha, com a secção na primeira coluna (para filtrar e contar)
export async function documentoExcel(d) {
  const comSeccao = d.seccoes.length > 1
  const linhas = d.seccoes.flatMap((s) => s.linhas.map((l, i) => ({ s, l, i })))
  const base = d.seccoes[0]?.colunas ?? []
  // as secções de um documento podem ter colunas diferentes (mapas): cada secção vai com as suas
  if (d.seccoes.some((s) => s.colunas.length !== base.length || s.colunas.some((c, k) => c.titulo !== base[k].titulo))) {
    const { default: writeXlsxFile } = await import('write-excel-file/browser')
    const folhas = d.seccoes.filter((s) => s.linhas.length || s.totais).map((s) => [
      [{ value: s.titulo || d.titulo, fontWeight: 'bold' }],
      s.colunas.map((c) => ({ value: c.titulo, fontWeight: 'bold', backgroundColor: '#1f3a2d', textColor: '#ffffff' })),
      ...s.linhas.map((l, i) => s.colunas.map((c) => { const v = c.valor(l, i); return v === null || v === undefined || v === '' ? null : typeof v === 'number' ? { value: v, type: Number } : { value: texto(v), type: String } })),
      ...(s.totais ? [s.totais.map((v) => (typeof v === 'number' ? { value: v, type: Number, fontWeight: 'bold' } : { value: texto(v), fontWeight: 'bold' }))] : []),
      [],
    ])
    await writeXlsxFile([[{ value: `${d.titulo} — ${hoje()}`, fontWeight: 'bold', fontSize: 14 }], [], ...folhas.flat()], { sheet: d.titulo.slice(0, 31).replace(/[\\/?*[\]:]/g, ' ') }).toFile(nomeFicheiro(d.titulo, 'xlsx'))
    registar(d.titulo, 'excel', linhas.length)
    return
  }
  await exportarExcel(d.titulo, [...(comSeccao ? [{ titulo: 'Grupo', valor: (x) => x.s.titulo }] : []), ...base.map((c) => ({ titulo: c.titulo, valor: (x) => c.valor(x.l, x.i) }))], linhas)
}
