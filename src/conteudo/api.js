// Endereço da API (definido no build: VITE_API_URL). Sem ele, o site usa só os conteúdos locais.
export const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

export async function pedido(caminho, opcoes = {}) {
  if (!API_URL) throw new Error('API não configurada')
  const resposta = await fetch(`${API_URL}${caminho}`, {
    ...opcoes,
    headers: { 'Content-Type': 'application/json', ...opcoes.headers },
  })
  if (resposta.status === 204) return null
  const dados = await resposta.json().catch(() => ({}))
  if (!resposta.ok) throw new Error(dados.erro || `Erro ${resposta.status}`)
  return dados
}

// identificador anónimo e persistente deste navegador (para os gostos)
export function idVisitante() {
  try {
    let id = localStorage.getItem('esgfaa-visitante')
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem('esgfaa-visitante', id)
    }
    return id
  } catch {
    return 'anonimo-sem-armazenamento'
  }
}
