import { carregarPdfjs } from '../../leitor/pdfjs'

/*
  PDF corrigido: o PDF do estudante com as anotações do docente desenhadas por cima
  (traços, realces, comentários, ✓ e ✗). Com vários PDF anotados, junta-os num só, pela ordem.
  As coordenadas das anotações são as da página no ecrã (pdf.js, escala 1, origem em cima à esquerda);
  o pdf.js converte-as para as do PDF, também nas páginas rodadas.
*/
export const LARGURA_NOTA = 190
export const TAMANHO_LETRA = 9
const ENTRELINHA = 11.5

const corDe = (rgb, hex) => {
  const n = parseInt(String(hex || '#e53917').slice(1), 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

// linhas de um comentário com a largura da nota (medidas com a letra do PDF, ou no ecrã)
export function partirLinhas(texto, medir, largura = LARGURA_NOTA - 10) {
  const linhas = []
  for (const paragrafo of String(texto || '').split(/\r?\n/)) {
    let linha = ''
    for (const palavra of paragrafo.split(/\s+/).filter(Boolean)) {
      const tentativa = linha ? `${linha} ${palavra}` : palavra
      if (medir(tentativa) <= largura || !linha) linha = tentativa
      else { linhas.push(linha); linha = palavra }
    }
    linhas.push(linha)
  }
  return linhas
}
export const alturaNota = (linhas) => linhas.length * ENTRELINHA + 9

export async function gerarPdfCorrigido(ficheiros) {
  const { PDFDocument, StandardFonts, rgb, degrees, LineCapStyle } = await import('pdf-lib')
  const pdfjs = await carregarPdfjs()
  const saida = await PDFDocument.create()
  for (const f of ficheiros) {
    const doc = await PDFDocument.load(f.bytes, { ignoreEncryption: true })
    const tarefa = pdfjs.getDocument({ data: f.bytes.slice() })
    const js = await tarefa.promise
    const letra = await doc.embedFont(StandardFonts.Helvetica)
    // a letra do PDF só tem o alfabeto latino: o que não couber troca-se por "?"
    const seguro = (t) => [...t].map((ch) => { try { letra.encodeText(ch); return ch } catch { return '?' } }).join('')
    const vistas = {}
    const vista = async (n) => (vistas[n] ||= (await js.getPage(n)).getViewport({ scale: 1 }))
    for (const a of f.anotacoes) {
      if (a.pagina < 1 || a.pagina > doc.getPageCount()) continue
      const pagina = doc.getPage(a.pagina - 1)
      const vp = await vista(a.pagina)
      const P = (x, y) => { const [px, py] = vp.convertToPdfPoint(x, y); return { x: px, y: py } }
      const cor = corDe(rgb, a.cor)
      const rodar = degrees(pagina.getRotation().angle)
      const linha = (x1, y1, x2, y2, espessura) => pagina.drawLine({ start: P(x1, y1), end: P(x2, y2), thickness: espessura, color: cor, lineCap: LineCapStyle.Round, opacity: 0.95 })
      if (a.tipo === 'caneta') {
        for (let i = 1; i < a.pontos.length; i++) linha(a.pontos[i - 1][0], a.pontos[i - 1][1], a.pontos[i][0], a.pontos[i][1], a.espessura || 2)
      } else if (a.tipo === 'realce') {
        const c1 = P(a.x, a.y)
        const c2 = P(a.x + a.w, a.y + a.h)
        pagina.drawRectangle({ x: Math.min(c1.x, c2.x), y: Math.min(c1.y, c2.y), width: Math.abs(c2.x - c1.x), height: Math.abs(c2.y - c1.y), color: cor, opacity: 0.3 })
      } else if (a.tipo === 'certo') {
        linha(a.x - 7, a.y, a.x - 2, a.y + 6, 2.4)
        linha(a.x - 2, a.y + 6, a.x + 8, a.y - 7, 2.4)
      } else if (a.tipo === 'errado') {
        linha(a.x - 6, a.y - 6, a.x + 6, a.y + 6, 2.4)
        linha(a.x - 6, a.y + 6, a.x + 6, a.y - 6, 2.4)
      } else if (a.tipo === 'texto') {
        const linhas = partirLinhas(seguro(a.texto), (t) => letra.widthOfTextAtSize(t, TAMANHO_LETRA))
        const h = alturaNota(linhas)
        pagina.drawRectangle({ ...P(a.x, a.y + h), width: LARGURA_NOTA, height: h, rotate: rodar, color: rgb(1, 0.973, 0.769), borderColor: cor, borderWidth: 0.8 })
        linhas.forEach((t, k) => pagina.drawText(t, { ...P(a.x + 5, a.y + 4 + TAMANHO_LETRA + k * ENTRELINHA), size: TAMANHO_LETRA, font: letra, color: rgb(0.12, 0.12, 0.12), rotate: rodar }))
      }
    }
    for (const p of await saida.copyPages(doc, doc.getPageIndices())) saida.addPage(p)
    tarefa.destroy()
  }
  return saida.save()
}
