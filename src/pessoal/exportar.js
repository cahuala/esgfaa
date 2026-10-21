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

// tabela simples em PDF, no mesmo modelo das listas da Escola (cabeçalho, título sublinhado, assinatura)
export async function exportarPdf(titulo, colunas, linhas, { subtitulo = '' } = {}) {
  await documentoPdf({ titulo, subtitulo, orientacao: colunas.length > 6 ? 'landscape' : 'portrait', seccoes: [{ colunas: colunas.map((c) => ({ ...c, alinhar: c.alinhar === 'right' ? 'right' : c.alinhar })), linhas }] })
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const texto = (v) => (v === null || v === undefined ? '' : typeof v === 'boolean' ? (v ? 'Sim' : 'Não') : String(v))

/*
  Listas e mapas da Repartição, como o modelo da Escola («Lista geral do pessoal civil»): «VISTO / O
  COMANDANTE DA ESG» à esquerda, o emblema e as três linhas ao centro (a última sublinhada), o título
  sublinhado, a tabela (N/O 01, 02…; as datas em D/M/A, uma coluna para cada) e, no fim, a data e a
  assinatura do Chefe da Repartição de Pessoal e Quadros.
  d = { titulo, subtitulo, seccoes: [{ titulo, colunas: [{ titulo, valor(linha, i), alinhar, largura, data }], linhas, totais }],
        orientacao: 'portrait' | 'landscape', assinatura, nota }
*/
const partes = (v) => { const t = v ? String(v).slice(0, 10) : ''; return /^\d{4}-\d{2}-\d{2}$/.test(t) ? [t.slice(8, 10), t.slice(5, 7), t.slice(0, 4)] : /^\d{2}\/\d{2}\/\d{4}$/.test(t) ? t.split('/') : ['', '', ''] }
export async function documentoPdf(d) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ orientation: d.orientacao ?? 'landscape', unit: 'mm', format: 'a4' })
  const w = doc.internal.pageSize.getWidth()
  const h = doc.internal.pageSize.getHeight()
  const brasao = await brasaoPng()
  const quem = await api('/definicoes/assinaturas').catch(() => ({}))
  // os mapas estatísticos (Mod. 2 a 5/DPQ) têm «APROVADO», o número do modelo à direita e letra Times
  const mod = d.modelo
  const F = mod ? 'times' : 'helvetica'
  let y
  if (mod) {
    const c = quem.comandante ?? {}
    doc.setFont('times', 'bold').setFontSize(9).text('APROVADO', 45, 20, { align: 'center' }).text((c.cargo || 'O COMANDANTE DA ESG').toUpperCase(), 45, 24, { align: 'center' })
    if (c.nome) doc.text(c.nome.toUpperCase(), 45, 31, { align: 'center' })
    if (c.posto) doc.text(`**${c.posto.toUpperCase()}**`, 45, 35, { align: 'center' })
    emblema(doc, brasao, w / 2, 6, 17)
    doc.setFont('times', 'normal').setFontSize(9).text('FORÇAS ARMADAS ANGOLANAS', w / 2, 28, { align: 'center' }).text('ESTADO MAIOR GENERAL', w / 2, 32, { align: 'center' })
    doc.setFont('times', 'bold').text('ESCOLA SUPERIOR DE GUERRA', w / 2, 36, { align: 'center' })
    const agora = new Date()
    if (mod.numero) doc.text(mod.numero, w - 30, 26, { align: 'center' })
    doc.text('', w - 30, 26, { align: 'center' }).setFont('times', 'normal').text(`${agora.getDate()} DE ${MESES[agora.getMonth()].toUpperCase()} DE ${agora.getFullYear()}`, w - 30, 30.5, { align: 'center' })
    doc.setFont('times', 'bold').setFontSize(10)
    // (o mapa por idade não tem título geral: cada quadro tem o seu; o período vai por baixo)
    const linhas = [!mod.semTitulo && d.titulo.toUpperCase(), d.subtitulo && d.subtitulo.toUpperCase()].filter(Boolean)
    linhas.forEach((l, i) => doc.text(l, w / 2, 44 + i * 4.6, { align: 'center' }))
    y = 44 + linhas.length * 4.6 - 1
  } else {
    // cabeçalho do modelo
    doc.setFont('helvetica', 'normal').setFontSize(8.5).text('VISTO', 38, 20, { align: 'center' }).text('O COMANDANTE DA ESG', 38, 24, { align: 'center' })
    emblema(doc, brasao, w / 2, 6, 17)
    doc.setFont('helvetica', 'normal').setFontSize(8.5).text('FORÇAS ARMADAS ANGOLANAS', w / 2, 28, { align: 'center' })
    doc.setFont('helvetica', 'italic').text('ESTADO MAIOR GENERAL', w / 2, 32, { align: 'center' })
    doc.setFont('helvetica', 'normal').text('ESCOLA SUPERIOR DE GUERRA', w / 2, 36, { align: 'center' })
    const sub = (t, yy) => { const tw = doc.getTextWidth(t); doc.setLineWidth(0.25).line(w / 2 - tw / 2, yy + 0.9, w / 2 + tw / 2, yy + 0.9) }
    sub('ESCOLA SUPERIOR DE GUERRA', 36)
    doc.setFontSize(9.5)
    const tit = doc.splitTextToSize(d.titulo.toUpperCase(), w - 60)
    doc.text(tit, w / 2, 44, { align: 'center' })
    tit.forEach((l, i) => sub(l, 44 + i * 4.4))
    y = 44 + tit.length * 4.4 + 1
    if (d.subtitulo) { doc.setFontSize(8).setTextColor(70).text(d.subtitulo, w / 2, y + 1.5, { align: 'center' }).setTextColor(0); y += 4 }
  }
  y += 3
  const total = d.seccoes.reduce((n, s) => n + (s.contar === false ? 0 : s.linhas.length), 0)
  if (!d.seccoes.some((s) => s.linhas.length)) {
    doc.setFontSize(9).text('Sem registos para os critérios escolhidos.', 14, y + 4)
    y += 10
  }
  for (const s of d.seccoes) {
    if (!s.linhas.length && !s.mostrarVazia) continue
    if (y > h - 30) { doc.addPage(); y = 16 }
    // nos mapas o título de cada quadro vai ao centro («POR IDADE»)
    if (s.titulo && mod) {
      doc.setFont('times', 'bold').setFontSize(10).text(s.titulo.toUpperCase(), w / 2, y + 2, { align: 'center' })
      y += 4
    } else if (s.titulo) {
      doc.setFont('helvetica', 'bold').setFontSize(8.5).text(`${s.titulo}${s.contar === false ? '' : ` (${s.linhas.length})`}`, 14, y + 1)
      y += 3
    }
    // as colunas de datas abrem-se em três (D/M/A), como no modelo
    const temDatas = s.colunas.some((c) => c.data)
    const head = temDatas
      ? [s.colunas.map((c) => (c.data ? { content: c.titulo.toUpperCase(), colSpan: 3 } : { content: c.titulo.toUpperCase(), rowSpan: 2 })), s.colunas.filter((c) => c.data).map(() => ({ content: 'D/M/A', colSpan: 3 }))]
      : [s.colunas.map((c) => c.titulo.toUpperCase())]
    const linha = (l, i) => s.colunas.flatMap((c) => (c.data ? partes(c.valor(l, i)) : [texto(c.valor(l, i))]))
    const estilos = {}
    let k = 0
    for (const c of s.colunas) {
      if (c.data) { for (let j = 0; j < 3; j++) estilos[k++] = { halign: 'center', cellWidth: j === 2 ? 10 : 7 } } else estilos[k++] = { halign: c.alinhar ?? 'left', ...(c.largura ? { cellWidth: c.largura } : {}) }
    }
    // linhas especiais dos mapas: { faixa: 'EXÉRCITO' } (uma célula a toda a largura) e { negrito: true } (subtotais)
    const corpo = s.linhas.map((l, i) => (l?.faixa ? [{ content: l.faixa, colSpan: k, styles: { fontStyle: 'bold', halign: 'center' } }] : linha(l, i)))
    autoTable(doc, {
      startY: y,
      head: s.cabeca ?? head,
      body: corpo,
      foot: s.totais ? [s.totais.flatMap((v, i) => (s.colunas[i]?.data ? [{ content: '', colSpan: 3 }] : [{ content: texto(v), styles: { halign: s.colunas[i]?.alinhar ?? 'left' } }]))] : undefined,
      showFoot: 'lastPage',
      theme: 'grid',
      styles: { font: F, fontSize: s.letra ?? 7.4, cellPadding: s.letra ? 0.6 : 1.3, overflow: 'linebreak', lineColor: [60, 60, 60], lineWidth: 0.15, textColor: 0, valign: 'middle' },
      headStyles: { fillColor: 255, textColor: 0, fontStyle: mod ? 'bold' : 'normal', halign: 'center', fontSize: s.letra ? s.letra - 0.6 : 7 },
      footStyles: { fillColor: 255, textColor: 0, fontStyle: 'bold' },
      columnStyles: estilos,
      margin: { left: 14, right: 14, top: 14, bottom: 14 },
      // os títulos ao alto (como nos mapas): { content, vertical: true } escreve-se de baixo para cima
      didParseCell: (c) => {
        if (c.section === 'head' && c.cell.raw?.vertical) { if (c.cell.raw.alto) c.cell.styles.minCellHeight = c.cell.raw.alto; c.cell.textoAlto = c.cell.text.join(' '); c.cell.text = [''] }
        if (c.section === 'body' && s.linhas[c.row.index]?.negrito) c.cell.styles.fontStyle = 'bold'
      },
      didDrawCell: (c) => {
        if (c.section !== 'head' || !c.cell.textoAlto) return
        const t = c.cell.styles.fontSize
        doc.setFont(F, 'bold').setFontSize(t).text(c.cell.textoAlto, c.cell.x + c.cell.width / 2 + t * 0.12, c.cell.y + c.cell.height - 1.2, { angle: 90 })
      },
    })
    y = doc.lastAutoTable.finalY + 6
  }
  // nos mapas a nota fica à esquerda, ao lado da assinatura
  if (d.nota) {
    doc.setFont(F, 'normal').setFontSize(mod ? 6.5 : 7.5).setTextColor(90).text(doc.splitTextToSize(d.nota, mod ? w / 2 - 20 : w - 28), 14, y + (mod ? 3 : 0)).setTextColor(0)
    if (!mod) y += 8
  }
  // «ESCOLA SUPERIOR DE GUERRA em Luanda, 21 de Abril de 2026» e o Chefe da Repartição
  if (mod) {
    // nos mapas: só o Chefe da Repartição, à direita
    if (y > h - 20) { doc.addPage(); y = 20 }
    const c = quem.chefeRpq ?? {}
    doc.setFont('times', 'bold').setFontSize(9).text((c.cargo || 'O CHEFE DA REPARTIÇÃO DE PESSOAL E QUADROS').toUpperCase(), w - 70, y + 4, { align: 'center' })
    if (c.nome) doc.setFont('times', 'normal').text(c.nome.toUpperCase(), w - 70, y + 14, { align: 'center' })
    if (c.posto) doc.text(`***${c.posto.toUpperCase()}***`, w - 70, y + 18, { align: 'center' })
  } else if (d.assinatura !== false) {
    if (y > h - 42) { doc.addPage(); y = 25 }
    const agora = new Date()
    const resto = ` em ${quem.local || 'Luanda'}, ${agora.getDate()} de ${MESES[agora.getMonth()]} de ${agora.getFullYear()}`
    doc.setFont('helvetica', 'normal').setFontSize(9)
    const w1 = doc.getTextWidth('ESCOLA SUPERIOR DE GUERRA')
    const w2 = doc.getTextWidth(resto)
    doc.text('ESCOLA SUPERIOR DE GUERRA', w / 2 - (w1 + w2) / 2, y + 6).text(resto, w / 2 - (w1 + w2) / 2 + w1, y + 6)
    const c = quem.chefeRpq ?? {}
    doc.text((c.cargo || 'O CHEFE DA REPARTIÇÃO DE PESSOAL E QUADROS').toUpperCase(), w / 2, y + 20, { align: 'center' })
    if (c.nome) doc.text(c.nome.toUpperCase(), w / 2, y + 34, { align: 'center' })
    if (c.posto) doc.text(`**${c.posto.toUpperCase()}**`, w / 2, y + 39, { align: 'center' })
  }
  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal').setFontSize(6.5).setTextColor(90).text(`Pág. ${i}/${n}`, w - 14, h - 6, { align: 'right' }).setTextColor(0)
    if (d.referencia) doc.setFontSize(6.5).text(d.referencia, 14, h - 6)
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
