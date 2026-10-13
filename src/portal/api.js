import { API_URL } from '../conteudo/api'

const CHAVE = 'esgfaa-portal-sessao'

export function lerToken() {
  try { return sessionStorage.getItem(CHAVE) } catch { return null }
}

export function guardarToken(token) {
  try {
    if (token) sessionStorage.setItem(CHAVE, token)
    else sessionStorage.removeItem(CHAVE)
  } catch { /* armazenamento indisponível */ }
}

// avisos da API para a sessão: 401 (sessão terminada) e 403 "mudar_senha"
const ouvintes = { expirou: () => {}, mudarSenha: () => {} }
export function definirOuvintes(o) {
  Object.assign(ouvintes, o)
}

/*
  Pedido à API do portal. corpo: objeto (JSON); formulario: FormData (envio de ficheiros).
  Os erros trazem .estado, .codigo e .campo (campo do formulário com o problema).
*/
export async function api(caminho, { metodo = 'GET', corpo, formulario } = {}) {
  if (!API_URL) throw new Error('O portal não está ligado ao servidor (VITE_API_URL).')
  const token = lerToken()
  const cabecalhos = token ? { Authorization: `Bearer ${token}` } : {}
  let body
  if (formulario) body = formulario
  else if (corpo !== undefined) {
    cabecalhos['Content-Type'] = 'application/json'
    body = JSON.stringify(corpo)
  }
  let r
  try {
    r = await fetch(`${API_URL}/api/portal${caminho}`, { method: metodo, headers: cabecalhos, body })
  } catch {
    throw new Error('Não foi possível contactar o servidor. Verifique a ligação.')
  }
  if (r.status === 204) return null
  const dados = await r.json().catch(() => ({}))
  if (!r.ok) {
    if (r.status === 401 && caminho !== '/entrar') ouvintes.expirou()
    if (r.status === 403 && dados.codigo === 'mudar_senha') ouvintes.mudarSenha()
    const erro = new Error(dados.erro || `Erro ${r.status}`)
    Object.assign(erro, { estado: r.status, codigo: dados.codigo, campo: dados.campo })
    throw erro
  }
  return dados
}

// ficheiros privados: pedem-se com a sessão e abrem-se (ou descarregam-se) a partir da memória
export async function abrirFicheiro(id, { nome = 'ficheiro', ver = false } = {}) {
  const r = await fetch(`${API_URL}/api/portal/ficheiros/${id}${ver ? '?ver=1' : ''}`, { headers: { Authorization: `Bearer ${lerToken()}` } })
  if (!r.ok) throw new Error(r.status === 404 ? 'Ficheiro não encontrado.' : `Erro ${r.status}`)
  const url = URL.createObjectURL(await r.blob())
  if (ver) {
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
