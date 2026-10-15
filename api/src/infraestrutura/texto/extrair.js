import fs from 'node:fs'
import zlib from 'node:zlib'

/*
  Extrai o texto de um documento para a verificação de originalidade:
  PDF (pdf.js), Word (.docx), OpenDocument (.odt) e texto simples. Outros tipos dão texto vazio.
*/
const MAX_TEXTO = 2_000_000
const MAX_DESCOMPRIMIDO = 60 * 1048576
const MAX_PAGINAS = 600

const entidades = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
const descodificar = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)))
  return entidades[e.toLowerCase()] ?? m
})

// lê um ficheiro de dentro de um ZIP (os .docx e .odt são ZIP); null se não existir
export function lerDoZip(buffer, nome) {
  const fim = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  if (fim < 0) return null
  const total = buffer.readUInt16LE(fim + 10)
  let p = buffer.readUInt32LE(fim + 16)
  for (let k = 0; k < total && p + 46 <= buffer.length; k++) {
    if (buffer.readUInt32LE(p) !== 0x02014b50) return null
    const metodo = buffer.readUInt16LE(p + 10)
    const comprimido = buffer.readUInt32LE(p + 20)
    const n = buffer.readUInt16LE(p + 28)
    const extra = buffer.readUInt16LE(p + 30)
    const comentario = buffer.readUInt16LE(p + 32)
    const local = buffer.readUInt32LE(p + 42)
    const este = buffer.toString('utf8', p + 46, p + 46 + n)
    if (este === nome) {
      const inicio = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28)
      const dados = buffer.subarray(inicio, inicio + comprimido)
      if (metodo === 0) return dados
      if (metodo === 8) return zlib.inflateRawSync(dados, { maxOutputLength: MAX_DESCOMPRIMIDO })
      return null
    }
    p += 46 + n + extra + comentario
  }
  return null
}

// XML do Word/ODT -> texto, com parágrafos em linhas próprias
function xmlParaTexto(xml, { paragrafo, tab, quebra }) {
  return descodificar(xml
    .replace(paragrafo, '\n\n') // cada parágrafo do Word/ODT separado por uma linha em branco
    .replace(tab, '\t')
    .replace(quebra, '\n')
    .replace(/<[^>]+>/g, ''))
}

async function textoPdf(buffer) {
  const { getDocument, VerbosityLevel } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const tarefa = getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, useSystemFonts: false, verbosity: VerbosityLevel.ERRORS })
  const doc = await tarefa.promise
  const partes = []
  try {
    for (let n = 1; n <= Math.min(doc.numPages, MAX_PAGINAS); n++) {
      const pagina = await doc.getPage(n)
      const { items } = await pagina.getTextContent()
      partes.push(items.map((i) => (i.str ?? '') + (i.hasEOL ? '\n' : ' ')).join(''))
      pagina.cleanup()
    }
  } finally {
    await tarefa.destroy()
  }
  return partes.join('\n\n')
}

export const TIPOS_COM_TEXTO = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'application/vnd.oasis.opendocument.text': 'OpenDocument',
  'text/plain': 'Texto',
}

export async function extrairTexto(caminho, tipo) {
  if (!TIPOS_COM_TEXTO[tipo]) return ''
  return extrairDeBuffer(fs.readFileSync(caminho), tipo)
}

export async function extrairDeBuffer(buffer, tipo) {
  if (!TIPOS_COM_TEXTO[tipo]) return ''
  let t
  if (tipo === 'application/pdf') t = await textoPdf(buffer)
  else if (tipo === 'text/plain') t = buffer.toString('utf8')
  else if (tipo.includes('wordprocessingml')) {
    const xml = lerDoZip(buffer, 'word/document.xml')
    t = xml ? xmlParaTexto(xml.toString('utf8'), { paragrafo: /<\/w:p>/g, tab: /<w:tab\/>/g, quebra: /<w:br\/>/g }) : ''
  } else {
    const xml = lerDoZip(buffer, 'content.xml')
    t = xml ? xmlParaTexto(xml.toString('utf8'), { paragrafo: /<\/text:(p|h)>/g, tab: /<text:tab\/>/g, quebra: /<text:line-break\/>/g }) : ''
  }
  return limparTextoExtraido(t)
}

// espaços normalizados, hífenes de fim de linha juntos ("estraté-\ngia" -> "estratégia")
export function limparTextoExtraido(t) {
  return String(t)
    .replace(/\r\n?/g, '\n')
    .replace(/(\p{L})-\n(\p{Ll})/gu, '$1$2')
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_TEXTO)
}
