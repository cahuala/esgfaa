import { API_URL } from '../conteudo/api'

const CHAVE = 'esgfaa-admin-sessao'

export function lerToken() {
  try { return sessionStorage.getItem(CHAVE) } catch { return null }
}

export function guardarToken(token) {
  try {
    if (token) sessionStorage.setItem(CHAVE, token)
    else sessionStorage.removeItem(CHAVE)
  } catch { /* armazenamento indisponível */ }
}

// chamado quando a API responde 401 (sessão expirada ou conta desativada)
let aoExpirar = () => {}
export function definirAoExpirar(fn) {
  aoExpirar = fn
}

export async function api(caminho, { metodo = 'GET', corpo, ficheiros, formulario } = {}) {
  if (!API_URL) throw new Error('A API não está configurada (VITE_API_URL).')
  const token = lerToken()
  const cabecalhos = token ? { Authorization: `Bearer ${token}` } : {}
  let body
  if (formulario) {
    body = formulario
  } else if (ficheiros) {
    body = new FormData()
    for (const f of ficheiros) body.append('ficheiros', f)
  } else if (corpo !== undefined) {
    cabecalhos['Content-Type'] = 'application/json'
    body = JSON.stringify(corpo)
  }

  let resposta
  try {
    resposta = await fetch(`${API_URL}/api/admin${caminho}`, { method: metodo, headers: cabecalhos, body })
  } catch {
    throw new Error('Não foi possível contactar o servidor. Verifique a ligação.')
  }
  if (resposta.status === 204) return null
  const dados = await resposta.json().catch(() => ({}))
  if (resposta.status === 401 && caminho !== '/entrar') aoExpirar()
  if (!resposta.ok) throw new Error(dados.erro || `Erro ${resposta.status}`)
  return dados
}

// ficheiros privados do portal (documentos, entregas): pedem-se com a sessão e abrem-se a partir da memória
export async function abrirFicheiro(id, nome = 'documento') {
  const r = await fetch(`${API_URL}/api/admin/academico/ficheiros/${id}`, { headers: { Authorization: `Bearer ${lerToken()}` } })
  if (!r.ok) throw new Error(r.status === 404 ? 'Ficheiro não encontrado.' : `Erro ${r.status}`)
  const url = URL.createObjectURL(await r.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
