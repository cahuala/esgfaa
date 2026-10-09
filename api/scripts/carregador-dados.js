// Ganchos de carregamento do Node para importar os ficheiros de src/data do site:
//  - "import Foto from '../assets/Foto.png'" passa a valer "/uploads/seed/foto.png"
//  - importações sem extensão ("./contactos") resolvem para ".js", como no Vite
import path from 'node:path'
import { nomeSemente } from './nomes.js'

const IMAGENS = /\.(png|jpe?g|gif|webp|svg)$/i

export async function resolve(especificador, contexto, seguinte) {
  try {
    return await seguinte(especificador, contexto)
  } catch (erro) {
    if (erro.code === 'ERR_MODULE_NOT_FOUND' && especificador.startsWith('.') && !path.extname(especificador)) {
      return seguinte(`${especificador}.js`, contexto)
    }
    throw erro
  }
}

export async function load(url, contexto, seguinte) {
  if (IMAGENS.test(new URL(url).pathname)) {
    const ficheiro = decodeURIComponent(path.basename(new URL(url).pathname))
    return { format: 'module', shortCircuit: true, source: `export default ${JSON.stringify(`/uploads/seed/${nomeSemente(ficheiro)}`)}` }
  }
  return seguinte(url, contexto)
}
