import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { limparTextoExtraido } from './extrair.js'

const correr = promisify(execFile)

/*
  Reconhecimento de texto (OCR) dos PDF digitalizados, com o Tesseract e o pdftoppm (Poppler), que correm no
  próprio servidor (nada sai da Escola). Sem os programas instalados, devolve texto vazio e diz que não há.
  As páginas vão para uma pasta temporária, apagada no fim.
*/
export function criarOcr({ linguas = 'por+eng+fra', maxPaginas = 60, resolucao = 200 } = {}) {
  let ha = null
  async function disponivel() {
    if (ha === null) {
      ha = true
      for (const [prog, args] of [['tesseract', ['--version']], ['pdftoppm', ['-v']]]) {
        try {
          await correr(prog, args, { timeout: 10_000 })
        } catch (e) {
          if (e.code === 'ENOENT') ha = false
        }
      }
    }
    return ha
  }
  async function ler(caminho, tipo) {
    if (tipo !== 'application/pdf' || !(await disponivel())) return ''
    const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'esg-ocr-'))
    try {
      await correr('pdftoppm', ['-r', String(resolucao), '-l', String(maxPaginas), '-gray', '-png', caminho, path.join(pasta, 'p')], { timeout: 600_000 })
      const partes = []
      for (const f of fs.readdirSync(pasta).filter((x) => x.endsWith('.png')).sort()) {
        const { stdout } = await correr('tesseract', [path.join(pasta, f), '-', '-l', linguas], { timeout: 180_000, maxBuffer: 20 * 1048576 })
        partes.push(stdout)
      }
      return limparTextoExtraido(partes.join('\n\n'))
    } finally {
      fs.rmSync(pasta, { recursive: true, force: true })
    }
  }
  return Object.assign(ler, { disponivel })
}

// quase nenhum texto num PDF (só números de página, um carimbo…): provavelmente uma digitalização em imagem
export const pareceDigitalizacao = (texto) => (String(texto ?? '').match(/\p{L}/gu) ?? []).length < 100
