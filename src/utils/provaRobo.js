/*
  «Não sou um robô»: resolve o desafio do servidor (o número n tal que SHA-256(sal + n) = desafio).
  Usa o SHA-256 do navegador; sem ele (páginas sem HTTPS, como o Pessoal na rede interna), um SHA-256 em
  JavaScript. Vai devolvendo o controlo ao navegador para a página não parar.
*/

// SHA-256 em JavaScript (só para quando o navegador não o dá)
const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]
export function sha256Js(texto) {
  const b = new TextEncoder().encode(texto)
  const l = b.length
  const n = ((l + 9 + 63) >> 6) << 6
  const m = new Uint8Array(n)
  m.set(b)
  m[l] = 0x80
  const v = new DataView(m.buffer)
  v.setUint32(n - 4, l * 8)
  v.setUint32(n - 8, Math.floor((l * 8) / 2 ** 32))
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]
  const w = new Uint32Array(64)
  const r = (x, k) => (x >>> k) | (x << (32 - k))
  for (let i = 0; i < n; i += 64) {
    for (let t = 0; t < 16; t++) w[t] = v.getUint32(i + t * 4)
    for (let t = 16; t < 64; t++) w[t] = (r(w[t - 2], 17) ^ r(w[t - 2], 19) ^ (w[t - 2] >>> 10)) + w[t - 7] + (r(w[t - 15], 7) ^ r(w[t - 15], 18) ^ (w[t - 15] >>> 3)) + w[t - 16]
    let [a, bb, c, d, e, f, g, hh] = h
    for (let t = 0; t < 64; t++) {
      const t1 = (hh + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[t] + w[t]) >>> 0
      const t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) >>> 0
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = bb; bb = a; a = (t1 + t2) >>> 0
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + bb) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0
  }
  return h.map((x) => x.toString(16).padStart(8, '0')).join('')
}

const hex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('')
const pausa = () => new Promise((ok) => setTimeout(ok, 0))

// d = { sal, desafio, maximo, ... } → a prova ({ ...d, numero }) ou null
export async function resolverDesafio(d, aoProgresso) {
  const nativo = globalThis.crypto?.subtle
  const cod = new TextEncoder()
  for (let n = 0; n <= d.maximo; n++) {
    const h = nativo ? hex(await nativo.digest('SHA-256', cod.encode(`${d.sal}${n}`))) : sha256Js(`${d.sal}${n}`)
    if (h === d.desafio) return { ...d, numero: n }
    if (n % 2000 === 0) { aoProgresso?.(n / d.maximo); await pausa() }
  }
  return null
}

// pede o desafio à API desta aplicação e resolve-o; null = o servidor não pede a verificação
export async function obterProva(api, aoProgresso) {
  const d = await api('/desafio')
  if (!d?.ativo) return null
  const p = await resolverDesafio(d, aoProgresso)
  if (!p) throw new Error('Não foi possível confirmar que não é um robô. Tente outra vez.')
  const { ativo: _a, ...prova } = p
  void _a
  return prova
}
