import dns from 'node:dns'
import https from 'node:https'

/*
  Pedidos HTTPS a serviços do Estado (ex.: api.gov.ao, a API do BI). A rede local muitas vezes não resolve
  os domínios .gov.ao: como o SIGP, se o DNS do sistema falhar, o endereço resolve-se por DNS-over-HTTPS
  (Cloudflare e, se falhar, Google). O certificado continua a ser verificado com o nome verdadeiro.
*/
const RESOLVEDORES = ['https://cloudflare-dns.com/dns-query', 'https://dns.google/resolve']
const cache = new Map() // host -> { ip, ate }

function getJson(url, headers = {}, timeout = 8000) {
  return new Promise((ok, falha) => {
    const r = https.get(url, { headers, timeout }, (res) => {
      let corpo = ''
      res.setEncoding('utf8')
      res.on('data', (c) => { corpo += c; if (corpo.length > 1_000_000) r.destroy(new Error('Resposta demasiado grande.')) })
      res.on('end', () => { try { ok(JSON.parse(corpo)) } catch { falha(new Error('Resposta inválida.')) } })
    })
    r.on('timeout', () => r.destroy(new Error('Sem resposta.')))
    r.on('error', falha)
  })
}

export async function resolverDoh(host) {
  const c = cache.get(host)
  if (c && c.ate > Date.now()) return c.ip
  for (const base of RESOLVEDORES) {
    try {
      const j = await getJson(`${base}?name=${encodeURIComponent(host)}&type=A`, { accept: 'application/dns-json' })
      const a = (j.Answer ?? []).find((x) => x.type === 1 && /^\d+\.\d+\.\d+\.\d+$/.test(x.data))
      if (a) {
        cache.set(host, { ip: a.data, ate: Date.now() + Math.max(60, a.TTL ?? 60) * 1000 })
        return a.data
      }
    } catch {
      // tenta o resolvedor seguinte
    }
  }
  throw new Error(`Não foi possível resolver ${host}.`)
}

// primeiro o DNS do sistema; se não conhecer o nome, DNS-over-HTTPS
function procurar(host, opcoes, cb) {
  dns.lookup(host, { family: 4 }, (erro, endereco) => {
    const responder = (ip) => (opcoes?.all ? cb(null, [{ address: ip, family: 4 }]) : cb(null, ip, 4))
    if (!erro) return responder(endereco)
    resolverDoh(host).then(responder, (e) => cb(Object.assign(e, { code: 'ENOTFOUND' })))
  })
}

// GET com a mesma forma que o fetch usa nos serviços: { ok, status, json() }
export function pedirJson(url, { headers = {}, timeout = 15_000 } = {}) {
  return new Promise((ok, falha) => {
    const r = https.get(url, { headers, timeout, lookup: procurar }, (res) => {
      let corpo = ''
      res.setEncoding('utf8')
      res.on('data', (c) => { corpo += c; if (corpo.length > 2_000_000) r.destroy(new Error('Resposta demasiado grande.')) })
      res.on('end', () => ok({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, json: async () => JSON.parse(corpo) }))
    })
    r.on('timeout', () => r.destroy(new Error('Sem resposta do serviço.')))
    r.on('error', falha)
  })
}
