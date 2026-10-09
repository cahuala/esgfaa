// leitura e escrita de caminhos "a.b.c" em objetos (sem mutar o original)

export function ler(obj, caminho) {
  return caminho.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)
}

export function escrever(obj, caminho, valor) {
  const [k, ...resto] = caminho.split('.')
  const base = Array.isArray(obj) ? [...obj] : { ...(obj || {}) }
  base[k] = resto.length ? escrever(base[k], resto.join('.'), valor) : valor
  return base
}
