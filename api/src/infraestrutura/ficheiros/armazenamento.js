import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

// tipos aceites e a extensão com que se guardam
export const TIPOS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'application/pdf': '.pdf',
}

const ascii = (b, inicio, texto) => b.subarray(inicio, inicio + texto.length).toString('latin1') === texto

// confirma pelo conteúdo (primeiros bytes) que o ficheiro é mesmo do tipo declarado
const ASSINATURAS = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/gif': (b) => ascii(b, 0, 'GIF87a') || ascii(b, 0, 'GIF89a'),
  'image/webp': (b) => ascii(b, 0, 'RIFF') && ascii(b, 8, 'WEBP'),
  'video/mp4': (b) => ascii(b, 4, 'ftyp'),
  'video/webm': (b) => b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3,
  'application/pdf': (b) => ascii(b, 0, '%PDF-'),
}

export function assinaturaValida(cabeca, tipo) {
  const verificar = ASSINATURAS[tipo]
  return Boolean(verificar && cabeca.length >= 12 && verificar(cabeca))
}

// ficheiros carregados no disco: DATA_DIR/uploads/AAAA-MM/<uuid>.<ext>
export class ArmazenamentoLocal {
  constructor({ pasta, relogio = () => new Date() }) {
    this.pasta = path.resolve(pasta)
    this.relogio = relogio
  }

  pastaDoMes() {
    const p = path.join(this.pasta, this.relogio().toISOString().slice(0, 7))
    fs.mkdirSync(p, { recursive: true })
    return p
  }

  // nome aleatório: nunca se usa o nome enviado pelo utilizador no disco
  nomeNovo(tipo) {
    return `${crypto.randomUUID()}${TIPOS[tipo]}`
  }

  lerCabeca(caminho) {
    const fd = fs.openSync(caminho, 'r')
    try {
      const b = Buffer.alloc(16)
      const n = fs.readSync(fd, b, 0, 16, 0)
      return b.subarray(0, n)
    } finally {
      fs.closeSync(fd)
    }
  }

  confirmarTipo(caminho, tipo) {
    return assinaturaValida(this.lerCabeca(caminho), tipo)
  }

  urlRelativa(caminho) {
    const relativo = path.relative(this.pasta, path.resolve(caminho))
    if (relativo.startsWith('..') || path.isAbsolute(relativo)) throw new Error('Ficheiro fora da pasta de uploads.')
    return `/uploads/${relativo.split(path.sep).join('/')}`
  }

  apagar(caminho) {
    fs.rmSync(caminho, { force: true })
  }
}
