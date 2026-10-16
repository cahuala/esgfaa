import { API_URL } from '../conteudo/api'
import { t as tx } from '../i18n/linguas'
import { traduzirRotulos } from '../i18n/rotulos'

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
  if (!API_URL) throw new Error(tx('A API não está configurada (VITE_API_URL).'))
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
    throw new Error(tx('Não foi possível contactar o servidor. Verifique a ligação.'))
  }
  if (resposta.status === 204) return null
  const dados = await resposta.json().catch(() => ({}))
  if (resposta.status === 401 && caminho !== '/entrar') aoExpirar()
  if (!resposta.ok) throw new Error((dados.erro && tx(dados.erro)) || tx('Erro {0}', { 0: resposta.status }))
  return traduzirRotulos(dados)
}

// ficheiros pedidos com a sessão: descarregam-se (ou abrem-se num separador, com abrir) a partir da memória
export async function obterFicheiro(caminho, nome = 'documento', { abrir = false } = {}) {
  const r = await fetch(`${API_URL}/api/admin${caminho}`, { headers: { Authorization: `Bearer ${lerToken()}` } })
  if (!r.ok) throw new Error(r.status === 404 ? tx('Ficheiro não encontrado.') : tx('Erro {0}', { 0: r.status }))
  const url = URL.createObjectURL(await r.blob())
  if (abrir) {
    window.open(url, '_blank', 'noopener')
  } else {
    const a = document.createElement('a')
    a.href = url
    a.download = nome
    document.body.appendChild(a)
    a.click()
    a.remove()
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

// ficheiros privados do portal (documentos, entregas)
export function abrirFicheiro(id, nome = 'documento') {
  return obterFicheiro(`/academico/ficheiros/${id}`, nome)
}
