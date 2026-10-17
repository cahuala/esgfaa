import { gunzipSync, unzipSync, zipSync } from 'fflate'
import { ErroValidacao } from '../../dominio/comum/erros.js'

/*
  Arquivos das cópias de segurança: o ZIP do ESGFAA (cadeira.json + ficheiros/<id>) e as cópias do Moodle
  (.mbz: tar.gz ou zip, com moodle_backup.xml). Os arquivos vêm de fora: limita-se o número de entradas e o
  tamanho depois de descomprimido (contra "bombas" de compressão), e nunca se escreve nada pelo nome de dentro.
*/
const MAX_ENTRADAS = 20_000
const MAX_TOTAL = 1024 * 1024 * 1024 // 1 GB descomprimido

const eZip = (b) => b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04
const eGzip = (b) => b.length > 18 && b[0] === 0x1f && b[1] === 0x8b

const grande = () => new ErroValidacao('A cópia é demasiado grande depois de descomprimida (máximo 1 GB).', { campo: 'ficheiro' })

// ZIP -> { "caminho": Uint8Array }, verificando os tamanhos antes de descomprimir
export function lerZip(dados) {
  let total = 0
  let n = 0
  return unzipSync(dados, {
    filter: (f) => {
      n += 1
      total += f.originalSize
      if (n > MAX_ENTRADAS) throw new ErroValidacao('A cópia tem ficheiros a mais.', { campo: 'ficheiro' })
      if (total > MAX_TOTAL) throw grande()
      return !f.name.endsWith('/')
    },
  })
}

// tar (ustar, com nomes longos GNU "L" e pax "x") -> { "caminho": Uint8Array }
function lerTar(b) {
  const r = {}
  let pos = 0
  let nomeLongo = null
  let n = 0
  const texto = (i, t) => new TextDecoder().decode(b.subarray(i, i + t)).replace(/\0.*$/s, '')
  while (pos + 512 <= b.length) {
    if (b.subarray(pos, pos + 512).every((x) => x === 0)) break
    const tamanho = parseInt(texto(pos + 124, 12).trim() || '0', 8)
    const tipo = String.fromCharCode(b[pos + 156] || 48)
    const prefixo = texto(pos + 345, 155)
    let nome = nomeLongo || (prefixo ? `${prefixo}/${texto(pos, 100)}` : texto(pos, 100))
    nomeLongo = null
    const inicio = pos + 512
    if (!Number.isFinite(tamanho) || tamanho < 0 || inicio + tamanho > b.length) throw new ErroValidacao('A cópia do Moodle está danificada.', { campo: 'ficheiro' })
    const conteudo = b.subarray(inicio, inicio + tamanho)
    if (tipo === 'L') nomeLongo = new TextDecoder().decode(conteudo).replace(/\0.*$/s, '')
    else if (tipo === 'x') {
      const m = new TextDecoder().decode(conteudo).match(/\d+ path=([^\n]*)\n/)
      if (m) nomeLongo = m[1]
    } else if (tipo === '0' || tipo === '\0') {
      if (++n > MAX_ENTRADAS) throw new ErroValidacao('A cópia tem ficheiros a mais.', { campo: 'ficheiro' })
      nome = nome.replace(/^\.\//, '')
      r[nome] = conteudo
    }
    pos = inicio + Math.ceil(tamanho / 512) * 512
  }
  return r
}

// lê qualquer cópia aceite: { entradas: { caminho: Uint8Array }, formato: 'esgfaa' | 'moodle' }
export function lerArquivo(dados) {
  const b = dados instanceof Uint8Array ? dados : new Uint8Array(dados)
  let entradas
  if (eZip(b)) entradas = lerZip(b)
  else if (eGzip(b)) {
    // o tamanho descomprimido vem nos últimos 4 bytes (até 4 GB): confirma-se antes de descomprimir
    const tamanho = (b[b.length - 4] | (b[b.length - 3] << 8) | (b[b.length - 2] << 16) | (b[b.length - 1] << 24)) >>> 0
    if (tamanho > MAX_TOTAL) throw grande()
    entradas = lerTar(gunzipSync(b))
  } else throw new ErroValidacao('Este ficheiro não é uma cópia de segurança (use o .zip do ESGFAA ou o .mbz do Moodle).', { campo: 'ficheiro' })
  if (entradas['cadeira.json']) return { formato: 'esgfaa', entradas }
  if (entradas['moodle_backup.xml']) return { formato: 'moodle', entradas }
  throw new ErroValidacao('Não encontrei nesta cópia uma cadeira do ESGFAA nem um curso do Moodle.', { campo: 'ficheiro' })
}

// cria o ZIP de uma cópia: { "caminho": Uint8Array | string }
export function criarZip(entradas) {
  const r = {}
  for (const [k, v] of Object.entries(entradas)) r[k] = typeof v === 'string' ? new TextEncoder().encode(v) : v
  return Buffer.from(zipSync(r, { level: 6 }))
}
