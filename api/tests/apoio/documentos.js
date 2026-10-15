import zlib from 'node:zlib'

// PDF mínimo, mas verdadeiro, com o texto dado (só ASCII)
export function pdfComTexto(texto) {
  // linhas de até 90 caracteres (o texto fora da página não conta)
  const linhas = (texto.match(/.{1,90}(\s|$)/g) || []).map((l) => `(${l.trim().replace(/[\\()]/g, (c) => `\\${c}`)}) Tj T*`).join('\n')
  const conteudo = `BT /F1 10 Tf 14 TL 50 800 Td\n${linhas}\nET`
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(conteudo)} >>\nstream\n${conteudo}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let out = '%PDF-1.4\n'
  const pos = []
  objs.forEach((o, k) => { pos.push(Buffer.byteLength(out)); out += `${k + 1} 0 obj\n${o}\nendobj\n` })
  const xref = Buffer.byteLength(out)
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${pos.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('')}`
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out)
}

// .docx mínimo (um ZIP com word/document.xml), um parágrafo por frase
export function docxComTexto(texto) {
  const corpo = texto.split(/(?<=\.)\s+/).map((p) => `<w:p><w:r><w:t>${p.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</w:t></w:r></w:p>`).join('')
  const ficheiros = [
    ['[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'],
    ['word/document.xml', `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${corpo}</w:body></w:document>`],
  ]
  const locais = []
  const centrais = []
  let p = 0
  for (const [nome, dados] of ficheiros) {
    const bruto = Buffer.from(dados)
    const comp = zlib.deflateRawSync(bruto)
    const l = Buffer.alloc(30)
    l.writeUInt32LE(0x04034b50, 0); l.writeUInt16LE(20, 4); l.writeUInt16LE(8, 8); l.writeUInt32LE(zlib.crc32(bruto), 14)
    l.writeUInt32LE(comp.length, 18); l.writeUInt32LE(bruto.length, 22); l.writeUInt16LE(nome.length, 26)
    const c = Buffer.alloc(46)
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(8, 10); c.writeUInt32LE(zlib.crc32(bruto), 16)
    c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(bruto.length, 24); c.writeUInt16LE(nome.length, 28); c.writeUInt32LE(p, 42)
    const local = Buffer.concat([l, Buffer.from(nome), comp])
    locais.push(local)
    centrais.push(Buffer.concat([c, Buffer.from(nome)]))
    p += local.length
  }
  const cd = Buffer.concat(centrais)
  const fim = Buffer.alloc(22)
  fim.writeUInt32LE(0x06054b50, 0); fim.writeUInt16LE(ficheiros.length, 8); fim.writeUInt16LE(ficheiros.length, 10); fim.writeUInt32LE(cd.length, 12); fim.writeUInt32LE(p, 16)
  return Buffer.concat([...locais, cd, fim])
}

export const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
