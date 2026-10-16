import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { assinaturaValida } from './armazenamento.js'

// tipos aceites no portal (materiais, entregas, documentos) e a extensão no disco
export const TIPOS_PRIVADOS = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/msword': '.doc',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.ms-excel': '.xls',
  'application/zip': '.zip',
}

const ZIP = (b) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04
const OLE = (b) => b.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))

// confirma pelo conteúdo que o ficheiro é do tipo declarado (Office moderno e ZIP são "PK…")
export function assinaturaPrivadaValida(cabeca, tipo) {
  if (tipo.includes('openxmlformats') || tipo === 'application/zip') return cabeca.length >= 4 && ZIP(cabeca)
  if (['application/msword', 'application/vnd.ms-powerpoint', 'application/vnd.ms-excel'].includes(tipo)) return cabeca.length >= 8 && OLE(cabeca)
  return assinaturaValida(cabeca, tipo)
}

/*
  Ficheiros do portal: ficam fora da pasta pública /uploads e só são entregues pela API,
  depois de verificar que quem pede tem acesso (inscrito na cadeira, dono da entrega, …).
*/
export class ArmazenamentoPrivado {
  constructor({ pasta, relogio = () => new Date() }) {
    this.pasta = path.resolve(pasta)
    this.relogio = relogio
  }

  pastaDoMes() {
    const p = path.join(this.pasta, this.relogio().toISOString().slice(0, 7))
    fs.mkdirSync(p, { recursive: true, mode: 0o750 })
    return p
  }

  nomeNovo(tipo) {
    return `${crypto.randomUUID()}${TIPOS_PRIVADOS[tipo] || ''}`
  }

  confirmarTipo(caminho, tipo) {
    const fd = fs.openSync(caminho, 'r')
    try {
      const b = Buffer.alloc(16)
      const n = fs.readSync(fd, b, 0, 16, 0)
      return assinaturaPrivadaValida(b.subarray(0, n), tipo)
    } finally {
      fs.closeSync(fd)
    }
  }

  relativo(caminho) {
    const r = path.relative(this.pasta, path.resolve(caminho))
    if (r.startsWith('..') || path.isAbsolute(r)) throw new Error('Ficheiro fora da pasta privada.')
    return r.split(path.sep).join('/')
  }

  // caminho absoluto a partir do relativo guardado na base (nunca sai da pasta privada)
  absoluto(relativo) {
    const c = path.resolve(this.pasta, relativo)
    if (!c.startsWith(this.pasta + path.sep)) throw new Error('Caminho inválido.')
    return c
  }

  apagar(caminho) {
    fs.rmSync(caminho, { force: true })
  }

  // guarda um ficheiro que chegou em memória (ex.: de dentro de uma cópia de segurança); devolve { id, caminho } relativos
  guardar(dados, tipo) {
    const nome = this.nomeNovo(tipo)
    const destino = path.join(this.pastaDoMes(), nome)
    fs.writeFileSync(destino, dados, { flag: 'wx', mode: 0o640 })
    return { id: nome.split('.')[0], caminho: this.relativo(destino) }
  }

  ler(relativo) {
    return fs.readFileSync(this.absoluto(relativo))
  }

  // cópia independente de um ficheiro (ao copiar uma cadeira para o novo ano); devolve { id, caminho } relativos
  copiar(relativo, tipo) {
    const origem = this.absoluto(relativo)
    const nome = this.nomeNovo(tipo)
    const destino = path.join(this.pastaDoMes(), nome)
    fs.copyFileSync(origem, destino, fs.constants.COPYFILE_EXCL)
    return { id: nome.split('.')[0], caminho: this.relativo(destino) }
  }
}
