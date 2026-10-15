import dns from 'node:dns/promises'
import net from 'node:net'
import http from 'node:http'
import https from 'node:https'
import { extrairDeBuffer, limparTextoExtraido } from '../texto/extrair.js'

/*
  Descarrega uma página pública (HTML ou PDF) e devolve o texto, para comparar com um trabalho.
  Proteções: só http(s) nas portas habituais, nunca endereços internos (rede local, localhost,
  metadados da nuvem), redirecionamentos verificados um a um, tempo e tamanho limitados.
*/
const MAX_BYTES = 3 * 1048576
const MAX_REDIRECIONAMENTOS = 3

function ipPrivado(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
      || (a === 100 && b >= 64 && b <= 127) || a >= 224
  }
  const x = ip.toLowerCase()
  if (x.startsWith('::ffff:')) return ipPrivado(x.slice(7))
  return x === '::1' || x === '::' || x.startsWith('fc') || x.startsWith('fd') || x.startsWith('fe80')
}

export async function enderecoPublico(url) {
  let u
  try { u = new URL(url) } catch { return false }
  if (!['http:', 'https:'].includes(u.protocol) || (u.port && !['80', '443'].includes(u.port)) || u.username || u.password) return false
  const host = u.hostname.replace(/^\[|\]$/g, '')
  if (net.isIP(host)) return !ipPrivado(host)
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(host)) return false
  try {
    const ips = await dns.lookup(host, { all: true })
    return ips.length > 0 && ips.every((x) => !ipPrivado(x.address))
  } catch {
    return false
  }
}

const entidades = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
export function htmlParaTexto(html) {
  const titulo = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim()
  const corpo = html
    .replace(/<head[\s\S]*?<\/head>/i, ' ')
    .replace(/<(script|style|noscript|svg|nav|footer|header|form|aside)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : entidades[e.toLowerCase()] ?? m))
  return { titulo, texto: limparTextoExtraido(corpo) }
}

// o endereço IP é verificado no momento da ligação (não há troca de DNS entre a verificação e o pedido)
function lookupSeguro(host, opcoes, cb) {
  dns.lookup(host, { all: true }).then((ips) => {
    const bons = ips.filter((x) => !ipPrivado(x.address))
    if (!bons.length || bons.length !== ips.length) return cb(new Error('Endereço interno recusado.'))
    if (opcoes.all) return cb(null, bons)
    cb(null, bons[0].address, bons[0].family)
  }, cb)
}

function pedir(url) {
  return new Promise((resolver, rejeitar) => {
    const u = new URL(url)
    const modulo = u.protocol === 'https:' ? https : http
    const req = modulo.get(u, {
      lookup: lookupSeguro, timeout: 10_000,
      headers: { 'User-Agent': 'ESGFAA-Integridade/1.0 (verificação de originalidade)', Accept: 'text/html,application/pdf;q=0.9' },
    }, (res) => {
      const partes = []
      let total = 0
      res.on('data', (c) => {
        total += c.length
        if (total > MAX_BYTES) { res.destroy(); return }
        partes.push(c)
      })
      res.on('close', () => resolver({ estado: res.statusCode, cabecalhos: res.headers, corpo: Buffer.concat(partes) }))
      res.on('error', rejeitar)
    })
    req.on('timeout', () => req.destroy(new Error('Tempo esgotado.')))
    req.on('error', rejeitar)
  })
}

export async function obterPagina(url) {
  let atual = url
  for (let k = 0; k <= MAX_REDIRECIONAMENTOS; k++) {
    if (!(await enderecoPublico(atual))) return null
    const r = await pedir(atual)
    if (r.estado >= 300 && r.estado < 400 && r.cabecalhos.location) {
      atual = new URL(r.cabecalhos.location, atual).toString()
      continue
    }
    if (r.estado !== 200) return null
    const tipo = String(r.cabecalhos['content-type'] || '').split(';')[0].trim().toLowerCase()
    if (tipo === 'application/pdf') return { url: atual, titulo: '', texto: await extrairDeBuffer(r.corpo, 'application/pdf').catch(() => '') }
    if (tipo.includes('html') || tipo === 'text/plain') {
      const html = r.corpo.toString('utf8')
      return { url: atual, ...(tipo === 'text/plain' ? { titulo: '', texto: limparTextoExtraido(html) } : htmlParaTexto(html)) }
    }
    return null
  }
  return null
}
