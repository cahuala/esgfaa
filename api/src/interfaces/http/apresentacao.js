// "/uploads/x.jpg" -> "https://api…/uploads/x.jpg" (na base guardam-se caminhos relativos)
export function absolutizar(valor, base) {
  if (typeof valor === 'string') return valor.startsWith('/uploads/') ? base + valor : valor
  if (Array.isArray(valor)) return valor.map((v) => absolutizar(v, base))
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, absolutizar(v, base)]))
  }
  return valor
}

export function baseUrl(req, config) {
  return config.urlPublico || `${req.protocol}://${req.get('host')}`
}
