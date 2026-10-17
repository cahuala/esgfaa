import crypto from 'node:crypto'

/*
  Códigos de uso único por tempo (TOTP, RFC 6238), como no Google Authenticator ou Microsoft Authenticator:
  6 algarismos que mudam de 30 em 30 segundos, calculados com um segredo partilhado (HMAC-SHA1).
  Aceita-se o código do intervalo actual e o anterior/seguinte (relógios ligeiramente desacertados) e
  nunca o mesmo intervalo duas vezes (quem vir o código não o volta a usar).
*/
export const PASSO = 30
const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32(buf) {
  let bits = 0
  let valor = 0
  let r = ''
  for (const b of buf) {
    valor = (valor << 8) | b
    bits += 8
    while (bits >= 5) {
      r += ALFABETO[(valor >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) r += ALFABETO[(valor << (5 - bits)) & 31]
  return r
}

export function deBase32(s) {
  const limpo = String(s).toUpperCase().replace(/[\s=-]/g, '')
  let bits = 0
  let valor = 0
  const r = []
  for (const c of limpo) {
    const i = ALFABETO.indexOf(c)
    if (i < 0) throw new Error('Segredo inválido.')
    valor = (valor << 5) | i
    bits += 5
    if (bits >= 8) {
      r.push((valor >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(r)
}

export const gerarSegredo = () => base32(crypto.randomBytes(20))

// código para um contador (HOTP, RFC 4226)
export function hotp(segredo, contador, digitos = 6) {
  const c = Buffer.alloc(8)
  c.writeBigUInt64BE(BigInt(contador))
  const h = crypto.createHmac('sha1', Buffer.isBuffer(segredo) ? segredo : deBase32(segredo)).update(c).digest()
  const o = h[h.length - 1] & 15
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]
  return String(n % 10 ** digitos).padStart(digitos, '0')
}

export const contadorDe = (data) => Math.floor(new Date(data).getTime() / 1000 / PASSO)
export const codigoEm = (segredo, data) => hotp(segredo, contadorDe(data))

// devolve o contador do código aceite (para não o aceitar de novo) ou null
export function verificarCodigo(segredo, codigo, data, { ultimo = -1, janela = 1 } = {}) {
  const c = String(codigo ?? '').replace(/\s/g, '')
  if (!/^\d{6}$/.test(c)) return null
  const agora = contadorDe(data)
  for (let d = -janela; d <= janela; d++) {
    const k = agora + d
    if (k <= ultimo) continue
    const esperado = hotp(segredo, k)
    if (crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(c))) return k
  }
  return null
}

// endereço para o QR code das aplicações de autenticação
export const urlOtpauth = ({ segredo, conta, emissor }) => `otpauth://totp/${encodeURIComponent(`${emissor}:${conta}`)}?secret=${segredo}&issuer=${encodeURIComponent(emissor)}&algorithm=SHA1&digits=6&period=${PASSO}`

// códigos de recuperação (para quem perder o telemóvel): mostram-se uma vez, guardam-se só os resumos
export function gerarCodigosRecuperacao(n = 8) {
  return Array.from({ length: n }, () => {
    const s = base32(crypto.randomBytes(7)).slice(0, 10).toLowerCase()
    return `${s.slice(0, 5)}-${s.slice(5)}`
  })
}
export const resumoCodigo = (c) => crypto.createHash('sha256').update(String(c).trim().toLowerCase().replace(/\s/g, '')).digest('hex')
