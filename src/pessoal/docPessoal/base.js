import { brasaoPng, emblema } from '../documentos'
import EmblemaFaa from '../../assets/emblema-faa.png'
import Logo from '../../assets/Logo.png'
import { paragrafo as paragrafoPdf } from '../../utils/pdfParagrafo'
import { fotoBase64 } from '../fotos'

/*
  Peças comuns dos documentos pessoais (modelos da ESG): A4, Times 14, os dados da pessoa em MAIÚSCULAS e a
  negrito, texto justificado, campos escritos sobre a linha, valores em kwanzas por extenso.
*/
export const TAM = 14
export const MARGEM = 20
export const LARGURA = 210 - 2 * MARGEM
const FUNDO = 280
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export const M = (v) => (v === null || v === undefined ? '' : String(v).toLocaleUpperCase('pt'))
const dia = (iso) => (iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00Z`) : null)
export const dataPt = (iso) => { const d = dia(iso); return d ? d.toLocaleDateString('pt-PT') : '' }
// «24 de Junho de 2026»
export const dataExtenso = (iso = new Date().toISOString()) => { const d = dia(iso); return d ? `${String(d.getUTCDate()).padStart(2, '0')} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}` : '' }

// ---------- valores por extenso ----------
const UNI = ['', 'Um', 'Dois', 'Três', 'Quatro', 'Cinco', 'Seis', 'Sete', 'Oito', 'Nove', 'Dez', 'Onze', 'Doze', 'Treze', 'Catorze', 'Quinze', 'Dezasseis', 'Dezassete', 'Dezoito', 'Dezanove']
const DEZ = ['', '', 'Vinte', 'Trinta', 'Quarenta', 'Cinquenta', 'Sessenta', 'Setenta', 'Oitenta', 'Noventa']
const CEM = ['', 'Cento', 'Duzentos', 'Trezentos', 'Quatrocentos', 'Quinhentos', 'Seiscentos', 'Setecentos', 'Oitocentos', 'Novecentos']
function ate999(n) {
  if (n === 100) return 'Cem'
  const c = Math.floor(n / 100)
  const r = n % 100
  const partes = []
  if (c) partes.push(CEM[c])
  if (r < 20) { if (r) partes.push(UNI[r]) } else { partes.push(DEZ[Math.floor(r / 10)]); if (r % 10) partes.push(UNI[r % 10]) }
  return partes.join(' e ')
}
export function extenso(n) {
  n = Math.floor(n)
  if (n === 0) return 'Zero'
  const grupos = [[1e9, 'Mil Milhões', 'Mil Milhões'], [1e6, 'Milhão', 'Milhões'], [1e3, 'Mil', 'Mil']]
  const partes = []
  let resto = n
  for (const [v, sing, plur] of grupos) {
    const q = Math.floor(resto / v)
    if (q) partes.push(v === 1e3 && q === 1 ? 'Mil' : `${ate999(q)} ${q === 1 ? sing : plur}`)
    resto %= v
  }
  if (resto) partes.push(ate999(resto))
  // «Mil e Cem», «Dois Mil e Quinhentos»; com centenas compostas usa-se vírgula
  if (partes.length > 1) {
    const ult = partes.pop()
    return `${partes.join(', ')}${resto < 100 || resto % 100 === 0 ? ' e ' : ', '}${ult}`
  }
  return partes[0]
}
// «410.945,74» (ponto nos milhares, vírgula nos cêntimos)
export function kwanzas(v) {
  const [inteiro, c] = Number(v).toFixed(2).split('.')
  return `${inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${c}`
}
export function kwanzasPorExtenso(v) {
  const k = Math.floor(Number(v) + 1e-9)
  const c = Math.round((Number(v) - k) * 100)
  // «Um Milhão de Kwanzas»
  const de = k >= 1e6 && k % 1e6 === 0 ? 'de ' : ''
  return `${extenso(k)} ${de}${k === 1 ? 'Kwanza' : 'Kwanzas'}${c ? ` e ${extenso(c)} ${c === 1 ? 'Cêntimo' : 'Cêntimos'}` : ''}`
}

// ---------- documento ----------
// emblema da ESG (anexo à ficha e fundo das declarações) e o das FAA (fundo das guias)
let logo = null
let fundo = null
function carregarLogo(src = Logo) {
  return new Promise((ok) => {
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, 500 / img.width)
      const fazer = (filtro) => {
        const c = document.createElement('canvas')
        c.width = Math.round(img.width * k)
        c.height = Math.round(img.height * k)
        const g = c.getContext('2d')
        g.filter = filtro
        g.drawImage(img, 0, 0, c.width, c.height)
        return c.toDataURL('image/png')
      }
      ok({ cor: fazer('none'), cinza: fazer('grayscale(1)'), proporcao: img.width / img.height })
    }
    img.onerror = () => ok(null)
    img.src = src
  })
}

export async function novoDocumento() {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  doc.setFont('times', 'normal').setFontSize(TAM)
  logo ??= await carregarLogo()
  fundo ??= await carregarLogo(EmblemaFaa)
  return { doc, autoTable, brasao: await brasaoPng(), logo, fundo, paginas: 0 }
}

// marca-d'água ao centro, muito clara (como nos modelos): o emblema da ESG nas declarações, o das FAA nas guias
export function marcaDagua(d, cx, cy, h, opacidade = 0.08, faa = false) {
  const { doc } = d
  const l = faa ? d.fundo : d.logo
  if (!l) return
  doc.saveGraphicsState()
  doc.setGState(new doc.GState({ opacity: opacidade }))
  doc.addImage(l.cinza, 'PNG', cx - (h * l.proporcao) / 2, cy - h / 2, h * l.proporcao, h)
  doc.restoreGraphicsState()
}

// emblema da ESG a cores (anexo à ficha individual)
export function logoEsg(d, cx, y, h) {
  const { doc, logo: l } = d
  if (l) doc.addImage(l.cor, 'PNG', cx - (h * l.proporcao) / 2, y, h * l.proporcao, h)
}

// cada documento começa numa página nova (no mesmo PDF)
export function novaPagina(d) {
  if (d.paginas++ > 0) d.doc.addPage('a4', 'portrait')
  d.doc.setFont('times', 'normal').setFontSize(TAM).setTextColor(0).setDrawColor(0).setLineWidth(0.25)
  return 18
}

/*
  Um documento que tem de caber numa só folha (as declarações): desenha-se à medida normal (k = 1); se
  passar a margem de baixo ou para outra folha, apaga-se e volta a desenhar-se um pouco mais apertado
  (letra e espaços), até caber. desenhar(k) desenha o documento todo, a começar com novaPagina(d).
*/
export function caberNaFolha(d, desenhar, { limite = 287, escalas = [1, 0.95, 0.9, 0.86, 0.82, 0.78, 0.74] } = {}) {
  const { doc } = d
  const paginasAntes = doc.getNumberOfPages()
  const contadorAntes = d.paginas
  // a primeira página do PDF já existe (a primeira folha não acrescenta nenhuma)
  const esperadas = paginasAntes + (contadorAntes > 0 ? 1 : 0)
  for (const [i, k] of escalas.entries()) {
    let fundo = 0
    const texto = doc.text
    doc.text = function (t, x, y, ...r) {
      if (typeof y === 'number' && doc.getNumberOfPages() === esperadas) fundo = Math.max(fundo, y)
      return texto.call(this, t, x, y, ...r)
    }
    try { desenhar(k) } finally { doc.text = texto }
    const coube = doc.getNumberOfPages() === esperadas && fundo <= limite
    if (coube || i === escalas.length - 1) return k
    // não coube: apaga o que desenhou (a primeira folha limpa-se trocando-a por uma nova) e tenta mais apertado
    while (doc.getNumberOfPages() > paginasAntes) doc.deletePage(doc.getNumberOfPages())
    if (contadorAntes === 0) { doc.addPage('a4', 'portrait'); doc.deletePage(1) }
    d.paginas = contadorAntes
  }
  return 1
}

export function garantir(d, y, altura) {
  if (y + altura <= FUNDO) return y
  d.doc.addPage('a4', 'portrait')
  return 20
}

// cabeçalho das declarações (como nos modelos): emblema das FAA e as três linhas, a última a negrito
export function cabecalho(d, linhas = ['FORÇAS ARMADAS ANGOLANAS', 'ESTADO MAIOR GENERAL', 'ESCOLA SUPERIOR DE GUERRA'], y = 24, { sublinhar = false } = {}) {
  const { doc } = d
  const w = 210
  emblema(doc, d.brasao, w / 2, y, 27)
  let yy = y + 34
  linhas.forEach((l, i) => {
    const ultima = i === linhas.length - 1
    doc.setFont('times', ultima ? 'bold' : 'normal').setFontSize(TAM - 1)
    doc.text(l, w / 2, yy, { align: 'center' })
    if (ultima && sublinhar) { const lw = doc.getTextWidth(l); doc.setLineWidth(0.3).line(w / 2 - lw / 2, yy + 1, w / 2 + lw / 2, yy + 1) }
    yy += 5.6
  })
  doc.setFont('times', 'normal').setFontSize(TAM)
  return yy + 4
}

export function titulo(d, texto, y, { sublinhado = true, tam = TAM + 1 } = {}) {
  const { doc } = d
  doc.setFont('times', 'bold').setFontSize(tam).text(texto, 105, y, { align: 'center' })
  if (sublinhado) { const lw = doc.getTextWidth(texto); doc.setLineWidth(0.3).line(105 - lw / 2, y + 1.2, 105 + lw / 2, y + 1.2) }
  doc.setFont('times', 'normal').setFontSize(TAM)
  return y + 10
}

// parágrafo justificado com partes a negrito (o algoritmo está em utils/pdfParagrafo.js); muda de página se for preciso
export function paragrafo(d, partes, y, { x = MARGEM, w = LARGURA, recuo = 12, entre = 6.6, justificar = true, tam = TAM } = {}) {
  const r = paragrafoPdf(d.doc, partes, y, { x, w, recuo, entre, justificar, tam, antesDaLinha: (yy) => garantir(d, yy, entre) })
  d.doc.setFont('times', 'normal').setFontSize(TAM)
  return r
}

/*
  Campo de ficha: «RÓTULO ______» com o valor (maiúsculas, negrito) escrito sobre a linha.
  Reduz a letra do valor se não couber.
*/
export function campo(d, rotulo, valor, x, y, w, { tam = TAM } = {}) {
  const { doc } = d
  doc.setFont('times', 'normal').setFontSize(tam)
  const r = rotulo ? `${rotulo} ` : ''
  doc.text(r, x, y)
  const lx = x + doc.getTextWidth(r)
  doc.setLineWidth(0.2).setDrawColor(90).line(lx, y + 1, x + w, y + 1).setDrawColor(0)
  const v = M(valor)
  if (v) {
    let t = tam
    doc.setFont('times', 'bold')
    while (t > 8 && doc.setFontSize(t).getTextWidth(v) > x + w - lx - 2) t -= 0.5
    doc.text(v, lx + 1, y - 0.4)
  }
  doc.setFont('times', 'normal').setFontSize(TAM)
}

/*
  Uma linha com vários campos: [[rótulo, valor, fracção], …]. Cada campo fica com o espaço de que precisa
  (rótulo + valor a 14) e o que sobra reparte-se pelas fracções; se não couberem todos, cada um vai para a
  sua linha (o valor nunca fica minúsculo nem sai da página).
*/
export function linhaCampos(d, campos, y, { x = MARGEM, w = LARGURA, alto = 9, tam = TAM } = {}) {
  const { doc } = d
  const preciso = campos.map(([r, v]) => {
    doc.setFont('times', 'normal').setFontSize(tam)
    const lr = r ? doc.getTextWidth(`${r} `) : 0
    doc.setFont('times', 'bold')
    const lv = v ? doc.getTextWidth(M(v)) : 0
    return lr + Math.max(lv, 14) + 6
  })
  doc.setFont('times', 'normal').setFontSize(TAM)
  const soma = preciso.reduce((a, b) => a + b, 0)
  if (campos.length > 1 && soma > w) {
    for (const c of campos) y = linhaCampos(d, [c], y, { x, w, alto, tam })
    return y
  }
  // um só campo com valor comprido: continua nas linhas de baixo (sempre a 14)
  if (campos.length === 1 && soma > w && campos[0][1]) {
    const [r, v] = campos[0]
    doc.setFont('times', 'normal').setFontSize(tam)
    const lr = r ? doc.getTextWidth(`${r} `) : 0
    doc.setFont('times', 'bold')
    const partes = doc.splitTextToSize(M(v), w - lr - 3)
    const primeira = partes[0]
    const resto = doc.splitTextToSize(M(v).slice(primeira.length).trim(), w - 3)
    doc.setFont('times', 'normal').setFontSize(TAM)
    y = garantir(d, y, alto * (1 + resto.length))
    campo(d, r, primeira, x, y, w, { tam })
    for (const linha of resto) { y += alto; campo(d, '', linha, x, y, w, { tam }) }
    return y + alto
  }
  y = garantir(d, y, alto)
  const total = campos.reduce((s2, c) => s2 + (c[2] ?? 1), 0)
  const sobra = Math.max(0, w - soma)
  let xx = x
  campos.forEach(([r, v, f = 1], k) => {
    const cw = preciso[k] + (sobra * f) / total
    campo(d, r, v, xx, y, cw - 3, { tam })
    xx += cw
  })
  return y + alto
}

export function secao(d, texto, y, { x = MARGEM, sublinhado = true, centrada = false } = {}) {
  const { doc } = d
  y = garantir(d, y, 12)
  doc.setFont('times', 'bold').setFontSize(TAM)
  const px = centrada ? 105 : x
  doc.text(texto, px, y, { align: centrada ? 'center' : 'left' })
  if (sublinhado) { const lw = doc.getTextWidth(texto); const x0 = centrada ? 105 - lw / 2 : x; doc.setLineWidth(0.3).line(x0, y + 1, x0 + lw, y + 1) }
  doc.setFont('times', 'normal')
  return y + 8
}

// linhas em branco para escrever à mão
export function linhasEmBranco(d, n, y, { x = MARGEM, w = LARGURA, entre = 8 } = {}) {
  for (let i = 0; i < n; i++) { y = garantir(d, y, entre); d.doc.setLineWidth(0.2).setDrawColor(120).line(x, y, x + w, y).setDrawColor(0); y += entre }
  return y
}

export function tabela(d, y, cabecalhoTabela, corpo, opcoes = {}) {
  d.autoTable(d.doc, {
    startY: y, head: [cabecalhoTabela], body: corpo, theme: 'grid', margin: { left: MARGEM, right: MARGEM },
    styles: { font: 'times', fontSize: opcoes.tam ?? TAM - 2, cellPadding: 1.6, lineColor: 0, lineWidth: 0.2, textColor: 0, minCellHeight: opcoes.alto ?? 7 },
    headStyles: { fillColor: 255, textColor: 0, fontStyle: 'bold', halign: 'center' },
    ...opcoes.extra,
  })
  return d.doc.lastAutoTable.finalY + 6
}

// assinatura: data por extenso, cargo, nome e posto (entre asteriscos, como nos modelos)
export function assinatura(d, y, quem, { data, local = 'Luanda', prefixoData = 'ESG em', maiusculas = false } = {}) {
  const { doc } = d
  y = garantir(d, y, 40)
  const linhaData = maiusculas ? `${M(local)}, ${M(dataExtenso(data))}` : `${prefixoData} ${local}, ${dataExtenso(data)}.`
  doc.setFont('times', 'normal').setFontSize(TAM).text(linhaData, 105, y, { align: 'center' })
  doc.setFont('times', 'bold').text(M(quem?.cargo || ''), 105, y + 12, { align: 'center' })
  if (quem?.nome) doc.text(M(quem.nome), 105, y + 26, { align: 'center' })
  if (quem?.posto) doc.text(`**${M(quem.posto)}**`, 105, y + 32, { align: 'center' })
  doc.setFont('times', 'normal')
  return y + 40
}

export async function foto(d, p, x, y, w = 30, h = 36) {
  const f = p.fotoId ? await fotoBase64(p.id, p.fotoId).catch(() => null) : null
  if (f) d.doc.addImage(f, 'JPEG', x, y, w, h)
  else d.doc.setLineWidth(0.3).rect(x, y, w, h)
}

// referência pequena ao fundo da página (as guias de marcha têm «RPQ/ESG/CP3 OP.MG»)
export function referencia(d, texto, x = MARGEM, y = 290) {
  d.doc.setFont('times', 'normal').setFontSize(6.5).setTextColor(90).text(texto, x, y).setTextColor(0).setFontSize(TAM)
}
