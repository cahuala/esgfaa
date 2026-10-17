import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { XMLParser } from 'fast-xml-parser'
import { ErroValidacao } from '../../dominio/comum/erros.js'
import { lerZip } from '../copias/arquivo.js'

/*
  Pacotes de conteúdo interativo (SCORM 1.2 / 2004 e H5P): o .zip é aberto para uma pasta privada
  (pacotes/<id>/…), de onde a API serve os ficheiros a quem tem acesso. Os caminhos de dentro do zip
  nunca saem dessa pasta.
*/
export const TIPOS_FICHEIRO_PACOTE = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.xsd': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.vtt': 'text/vtt; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf', '.eot': 'application/vnd.ms-fontobject',
  '.pdf': 'application/pdf',
}
export const tipoDoFicheiro = (nome) => TIPOS_FICHEIRO_PACOTE[path.extname(nome).toLowerCase()] || 'application/octet-stream'

// caminho seguro dentro do pacote: sem "..", sem caminhos absolutos nem caracteres de controlo
export function caminhoSeguro(nome) {
  const n = String(nome).replace(/\\/g, '/')
  if (!n || n.length > 400 || [...n].some((ch) => ch.charCodeAt(0) < 32) || n.startsWith('/') || /^[a-z]:/i.test(n)) return null
  const partes = n.split('/').filter((p) => p && p !== '.')
  if (!partes.length || partes.some((p) => p === '..')) return null
  return partes.join('/')
}

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', removeNSPrefix: true, parseTagValue: false })
const lista = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v])

// SCORM: a página inicial é a do primeiro item da organização por omissão (imsmanifest.xml)
function lerScorm(entradas) {
  const b = entradas['imsmanifest.xml']
  if (!b) throw new ErroValidacao('Este zip não é um pacote SCORM (falta o imsmanifest.xml na raiz).', { campo: 'ficheiro' })
  const m = xml.parse(new TextDecoder().decode(b)).manifest
  if (!m) throw new ErroValidacao('O imsmanifest.xml do pacote SCORM está danificado.', { campo: 'ficheiro' })
  const versaoTxt = `${m.metadata?.schemaversion ?? ''}`
  const versao = /2004|cam 1\.3/i.test(versaoTxt) ? '2004' : '1.2'
  const orgs = m.organizations || {}
  const org = lista(orgs.organization).find((o) => o['@_identifier'] === orgs['@_default']) || lista(orgs.organization)[0]
  const itens = []
  const andar = (i) => { for (const x of lista(i)) { if (x['@_identifierref']) itens.push(x); andar(x.item) } }
  andar(org?.item)
  const recursos = lista(m.resources?.resource)
  const recurso = recursos.find((r) => r['@_identifier'] === itens[0]?.['@_identifierref']) || recursos.find((r) => r['@_href'])
  const inicio = caminhoSeguro(`${recurso?.['@_href'] ?? ''}`.split('?')[0])
  if (!inicio || !entradas[inicio]) throw new ErroValidacao('Não encontrei no pacote SCORM a página inicial indicada no imsmanifest.xml.', { campo: 'ficheiro' })
  return { versao, inicio, titulo: `${org?.title ?? ''}`.trim() }
}

function lerH5p(entradas) {
  const b = entradas['h5p.json']
  if (!b) throw new ErroValidacao('Este ficheiro não é um conteúdo H5P (falta o h5p.json).', { campo: 'ficheiro' })
  let h
  try { h = JSON.parse(new TextDecoder().decode(b)) } catch { throw new ErroValidacao('O h5p.json está danificado.', { campo: 'ficheiro' }) }
  if (!entradas['content/content.json']) throw new ErroValidacao('O conteúdo H5P não tem o content/content.json.', { campo: 'ficheiro' })
  const principal = lista(h.preloadedDependencies).find((d) => d.machineName === h.mainLibrary)
  const pasta = principal && `${principal.machineName}-${principal.majorVersion}.${principal.minorVersion}`
  if (pasta && !Object.keys(entradas).some((k) => k.startsWith(`${pasta}/`))) {
    throw new ErroValidacao('Este H5P não traz as bibliotecas. No sítio onde o criou, exporte-o com "Descarregar" (que inclui as bibliotecas).', { campo: 'ficheiro' })
  }
  return { titulo: `${h.title ?? ''}`.trim(), biblioteca: `${h.mainLibrary ?? ''}` }
}

// abre o zip para a pasta privada e devolve { pasta, inicio?, versao?, titulo }
export function extrairPacote(privados, dadosZip, tipo) {
  const entradas = lerZip(new Uint8Array(dadosZip))
  // um zip criado com uma pasta à volta de tudo (pacote/imsmanifest.xml) também serve
  const chaves = Object.keys(entradas)
  const marca = tipo === 'scorm' ? 'imsmanifest.xml' : 'h5p.json'
  if (!entradas[marca]) {
    const comPasta = chaves.find((k) => k.endsWith(`/${marca}`) && k.split('/').length === 2)
    if (comPasta) {
      const prefixo = comPasta.slice(0, -marca.length)
      for (const k of chaves) { if (k.startsWith(prefixo)) entradas[k.slice(prefixo.length)] = entradas[k]; delete entradas[k] }
    }
  }
  const info = tipo === 'scorm' ? lerScorm(entradas) : lerH5p(entradas)
  const pasta = `pacotes/${crypto.randomUUID()}`
  const raiz = path.join(privados.pasta, pasta)
  for (const [nome, dados] of Object.entries(entradas)) {
    const c = caminhoSeguro(nome)
    if (!c) continue
    const destino = path.join(raiz, c)
    if (!destino.startsWith(raiz + path.sep)) continue
    fs.mkdirSync(path.dirname(destino), { recursive: true, mode: 0o750 })
    fs.writeFileSync(destino, dados, { mode: 0o640 })
  }
  return { pasta, ...info }
}

// caminho absoluto de um ficheiro dentro de um pacote já aberto (ou null)
export function ficheiroDoPacote(privados, pasta, nome) {
  const c = caminhoSeguro(nome)
  if (!c || !/^pacotes\/[0-9a-f-]{36}$/.test(pasta)) return null
  const raiz = path.join(privados.pasta, pasta)
  const f = path.join(raiz, c)
  if (!f.startsWith(raiz + path.sep)) return null
  try { return fs.statSync(f).isFile() ? f : null } catch { return null }
}

export const pacoteExiste = (privados, pasta) => /^pacotes\/[0-9a-f-]{36}$/.test(pasta || '') && fs.existsSync(path.join(privados.pasta, pasta))
