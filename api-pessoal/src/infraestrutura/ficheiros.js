import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { invalido } from '../erros.js'

// tipos aceites, reconhecidos pelo conteúdo (não pelo nome): PDF, imagens, Word e Excel
const ASSINATURAS = [
  ['pdf', 'application/pdf', [0x25, 0x50, 0x44, 0x46]],
  ['jpg', 'image/jpeg', [0xff, 0xd8, 0xff]],
  ['png', 'image/png', [0x89, 0x50, 0x4e, 0x47]],
  ['webp', 'image/webp', [0x52, 0x49, 0x46, 0x46]],
]
const ZIP = [0x50, 0x4b, 0x03, 0x04]

export function tipoDoFicheiro(buffer, nome = '') {
  const a = ASSINATURAS.find(([, , m]) => m.every((x, i) => buffer[i] === x))
  if (a) return { ext: a[0], mime: a[1] }
  // .docx e .xlsx são ZIP: aceita-se pelo nome, o conteúdo é sempre descarregado (nunca mostrado no navegador)
  if (ZIP.every((x, i) => buffer[i] === x)) {
    if (/\.docx$/i.test(nome)) return { ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
    if (/\.xlsx$/i.test(nome)) return { ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
  }
  return null
}

// pasta privada (fora de qualquer endereço público); os ficheiros só se lêem com sessão e permissão
export class Ficheiros {
  constructor(pasta) {
    this.pasta = pasta
    fs.mkdirSync(pasta, { recursive: true })
  }

  async guardar(ficheiro) {
    if (!ficheiro?.buffer?.length) throw invalido('Escolha um ficheiro.', 'ficheiro')
    const t = tipoDoFicheiro(ficheiro.buffer, ficheiro.originalname)
    if (!t) throw invalido('Tipo de ficheiro não aceite: use PDF, JPG, PNG, WEBP, Word (.docx) ou Excel (.xlsx).', 'ficheiro')
    const nome = `${crypto.randomUUID()}.${t.ext}`
    await fs.promises.writeFile(path.join(this.pasta, nome), ficheiro.buffer)
    return { ficheiro: nome, mime: t.mime, tamanho: ficheiro.buffer.length, nomeOriginal: String(ficheiro.originalname || nome).slice(0, 200) }
  }

  caminho(nome) {
    return path.join(this.pasta, path.basename(String(nome)))
  }

  apagar(nome) {
    if (nome) fs.rm(this.caminho(nome), { force: true }, () => {})
  }
}
