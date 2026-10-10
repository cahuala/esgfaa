import { ErroValidacao } from './erros.js'

// campos que guardam endereços (imagens, ficheiros, ligações)
const CAMPOS_URL = new Set(['src', 'capa', 'imagem', 'foto', 'pdf', 'poster', 'ligacao', 'href'])

// endereço seguro: vazio, caminho do próprio site (/…) ou http(s)://… — nunca javascript:, data:, //…
export function urlSegura(valor) {
  if (valor === '' || valor == null) return true
  if (typeof valor !== 'string' || valor.length > 2000) return false
  if (valor.startsWith('/') && !valor.startsWith('//')) return true
  try {
    const u = new URL(valor)
    return u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'mailto:'
  } catch {
    return false
  }
}

// percorre os dados e rejeita endereços perigosos em qualquer campo de URL
export function validarUrls(valor, caminho = '') {
  if (Array.isArray(valor)) {
    valor.forEach((v, i) => validarUrls(v, `${caminho}[${i}]`))
  } else if (valor && typeof valor === 'object') {
    for (const [k, v] of Object.entries(valor)) {
      if (CAMPOS_URL.has(k) && !urlSegura(v)) {
        throw new ErroValidacao(`Endereço inválido no campo "${k}".`, { campo: `${caminho}${caminho ? '.' : ''}${k}` })
      }
      validarUrls(v, `${caminho}${caminho ? '.' : ''}${k}`)
    }
  }
}

// guarda sempre /uploads/… em vez do endereço completo da API
export function relativizar(valor) {
  if (typeof valor === 'string') {
    const i = valor.indexOf('/uploads/')
    return i > 0 && /^https?:\/\//.test(valor) ? valor.slice(i) : valor
  }
  if (Array.isArray(valor)) return valor.map(relativizar)
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, relativizar(v)]))
  }
  return valor
}
