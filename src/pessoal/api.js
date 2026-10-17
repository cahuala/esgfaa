// endereço da API interna: em desenvolvimento a porta 3002; no servidor da Escola a aplicação é servida pela própria API
export const API = import.meta.env.VITE_PESSOAL_API ?? (import.meta.env.DEV ? 'http://localhost:3002' : '')
const CHAVE = 'esg-pessoal-sessao'

export function lerToken() {
  try { return sessionStorage.getItem(CHAVE) } catch { return null }
}
export function guardarToken(t) {
  try { if (t) sessionStorage.setItem(CHAVE, t); else sessionStorage.removeItem(CHAVE) } catch { /* sem armazenamento */ }
}

let aoExpirar = () => {}
export const definirAoExpirar = (fn) => { aoExpirar = fn }

export async function api(caminho, { metodo = 'GET', corpo, formulario, consulta } = {}) {
  const t = lerToken()
  const cab = t ? { Authorization: `Bearer ${t}` } : {}
  let body
  if (formulario) body = formulario
  else if (corpo !== undefined) {
    cab['Content-Type'] = 'application/json'
    body = JSON.stringify(corpo)
  }
  const q = consulta ? `?${new URLSearchParams(Object.entries(consulta).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString()}` : ''
  let r
  try {
    r = await fetch(`${API}/api${caminho}${q}`, { method: metodo, headers: cab, body })
  } catch {
    throw new Error('Não foi possível contactar o servidor do pessoal. Verifique a ligação à rede interna.')
  }
  if (r.status === 204) return null
  const d = await r.json().catch(() => ({}))
  if (r.status === 401 && caminho !== '/entrar') aoExpirar()
  if (!r.ok) {
    const e = new Error(d.erro || `Erro ${r.status}`)
    e.codigo = d.codigo
    e.campo = d.campo
    throw e
  }
  return d
}

// fotografia (pedida com a sessão) como endereço local para <img>
export async function urlFoto(pessoaId) {
  const r = await fetch(`${API}/api/pessoas/${pessoaId}/foto`, { headers: { Authorization: `Bearer ${lerToken()}` } })
  return r.ok ? URL.createObjectURL(await r.blob()) : null
}
