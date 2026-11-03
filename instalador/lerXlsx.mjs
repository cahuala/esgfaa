// Lê a primeira folha de um .xlsx em Node, sem bibliotecas: um ZIP com XML (texto partilhado + células).
import zlib from 'node:zlib'

function abrirZip(buf) {
  // fim do directório central
  let fim = buf.length - 22
  while (fim >= 0 && buf.readUInt32LE(fim) !== 0x06054b50) fim--
  if (fim < 0) throw new Error('O ficheiro não é um Excel (.xlsx) válido.')
  const n = buf.readUInt16LE(fim + 10)
  let p = buf.readUInt32LE(fim + 16)
  const ficheiros = {}
  for (let i = 0; i < n; i++) {
    const metodo = buf.readUInt16LE(p + 10)
    const tamanho = buf.readUInt32LE(p + 20)
    const lNome = buf.readUInt16LE(p + 28)
    const lExtra = buf.readUInt16LE(p + 30)
    const lComentario = buf.readUInt16LE(p + 32)
    const local = buf.readUInt32LE(p + 42)
    const nome = buf.toString('utf8', p + 46, p + 46 + lNome)
    const inicio = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
    const dados = buf.subarray(inicio, inicio + tamanho)
    ficheiros[nome] = () => (metodo === 8 ? zlib.inflateRawSync(dados) : dados)
    p += 46 + lNome + lExtra + lComentario
  }
  return ficheiros
}

const entidades = (t) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&amp;/g, '&')
const texto = (xml) => entidades([...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(''))
const coluna = (ref) => [...ref.replace(/\d+/g, '')].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1

export async function lerXlsx(buf) {
  const zip = abrirZip(buf)
  const partilhado = zip['xl/sharedStrings.xml'] ? [...zip['xl/sharedStrings.xml']().toString().matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texto(m[1])) : []
  const folha = Object.keys(zip).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))[0]
  if (!folha) throw new Error('O Excel não tem nenhuma folha.')
  const linhas = []
  for (const [, conteudo] of zip[folha]().toString().matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const l = []
    for (const [, atrib, corpo = ''] of conteudo.matchAll(/<c([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = /r="([A-Z]+\d+)"/.exec(atrib)?.[1]
      const tipo = /t="(\w+)"/.exec(atrib)?.[1]
      const v = /<v>([\s\S]*?)<\/v>/.exec(corpo)?.[1]
      const valor = tipo === 's' ? partilhado[Number(v)] : tipo === 'inlineStr' ? texto(corpo) : v != null ? entidades(v) : ''
      l[ref ? coluna(ref) : l.length] = valor ?? ''
    }
    linhas.push(Array.from(l, (x) => x ?? ''))
  }
  return linhas
}
