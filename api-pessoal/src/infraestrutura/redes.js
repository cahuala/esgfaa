/*
  O sistema de pessoal só responde dentro da rede da Escola: cada pedido tem de vir de um endereço
  das redes internas configuradas (IPv4 em CIDR, ex.: 10.0.0.0/8). IPv6 só se aceita o da própria máquina.
*/
const numero = (ip) => ip.split('.').reduce((n, p) => (n << 8) + Number(p), 0) >>> 0

export function criarVerificadorRedes(redes) {
  const lista = redes.map((r) => {
    const [base, bits = '32'] = r.split('/')
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(base) || !(Number(bits) >= 0 && Number(bits) <= 32)) throw new Error(`Rede interna inválida: ${r}`)
    const mascara = Number(bits) === 0 ? 0 : (~0 << (32 - Number(bits))) >>> 0
    return { rede: (numero(base) & mascara) >>> 0, mascara }
  })
  return (ip = '') => {
    let v = String(ip)
    if (v === '::1') v = '127.0.0.1'
    if (v.startsWith('::ffff:')) v = v.slice(7)
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(v)) return false
    const n = numero(v)
    return lista.some((r) => ((n & r.mascara) >>> 0) === r.rede)
  }
}
