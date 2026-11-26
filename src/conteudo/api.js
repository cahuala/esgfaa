// Endereço da API (definido no build: VITE_API_URL). Sem ele, o site usa só os conteúdos locais.
// «mesma-origem»: a API está no mesmo endereço das páginas (/api), seja qual for o domínio — é o que leva o
// pacote de instalação da Escola, que só conhece o domínio na instalação.
const URL_BUILD = import.meta.env.VITE_API_URL || ''
export const API_URL = (URL_BUILD === 'mesma-origem' ? (typeof window === 'undefined' ? '' : window.location.origin) : URL_BUILD).replace(/\/$/, '')

export async function pedido(caminho, opcoes = {}) {
  if (!API_URL) throw new Error('API não configurada')
  const resposta = await fetch(`${API_URL}${caminho}`, {
    ...opcoes,
    headers: { 'Content-Type': 'application/json', ...opcoes.headers },
  })
  if (resposta.status === 204) return null
  const dados = await resposta.json().catch(() => ({}))
  if (!resposta.ok) {
    const erro = new Error(dados.erro || `Erro ${resposta.status}`)
    erro.estado = resposta.status
    erro.campo = dados.campo // campo do formulário com o problema (quando a API o indica)
    throw erro
  }
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
