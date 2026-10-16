import { API_URL } from '../conteudo/api'
import { t as tx } from '../i18n/linguas'
import { traduzirRotulos } from '../i18n/rotulos'

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
  if (!API_URL) throw new Error(tx('O portal não está ligado ao servidor (VITE_API_URL).'))
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
    throw new Error(tx('Não foi possível contactar o servidor. Verifique a ligação.'))
  }
  if (r.status === 204) return null
  const dados = await r.json().catch(() => ({}))
  if (!r.ok) {
    if (r.status === 401 && caminho !== '/entrar') ouvintes.expirou()
    if (r.status === 403 && dados.codigo === 'mudar_senha') ouvintes.mudarSenha()
    const erro = new Error((dados.erro && tx(dados.erro)) || tx('Erro {0}', { 0: r.status }))
    Object.assign(erro, { estado: r.status, codigo: dados.codigo, campo: dados.campo })
    throw erro
  }
  return traduzirRotulos(dados)
}

// ficheiros privados: pedem-se com a sessão e abrem-se (ou descarregam-se) a partir da memória
export function abrirFicheiro(id, opcoes) {
  return abrirCaminho(`/ficheiros/${id}`, opcoes)
}

// ficheiro pedido com a sessão, como endereço local (blob:) para mostrar na página; revogar depois de usar
export async function urlFicheiro(caminho, { ver = true } = {}) {
  const r = await fetch(`${API_URL}/api/portal${caminho}${ver ? '?ver=1' : ''}`, { headers: { Authorization: `Bearer ${lerToken()}` } })
  if (!r.ok) throw new Error(r.status === 404 ? tx('Ficheiro não encontrado.') : tx('Erro {0}', { 0: r.status }))
  return URL.createObjectURL(await r.blob())
}

export async function abrirCaminho(caminho, { nome = 'ficheiro', ver = false } = {}) {
  const url = await urlFicheiro(caminho, { ver })
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

/*
  Envio de ficheiros com progresso (XMLHttpRequest dá o avanço do envio, o fetch não).
  aoProgresso(0..100) é chamado durante o envio.
*/
export function enviarComProgresso(caminho, formulario, { metodo = 'POST', aoProgresso } = {}) {
  if (!API_URL) return Promise.reject(new Error(tx('O portal não está ligado ao servidor (VITE_API_URL).')))
  return new Promise((resolver, rejeitar) => {
    const x = new XMLHttpRequest()
    x.open(metodo, `${API_URL}/api/portal${caminho}`)
    const token = lerToken()
    if (token) x.setRequestHeader('Authorization', `Bearer ${token}`)
    x.upload.onprogress = (e) => { if (e.lengthComputable) aoProgresso?.(Math.round((e.loaded / e.total) * 100)) }
    x.onerror = () => rejeitar(new Error(tx('Não foi possível contactar o servidor. Verifique a ligação.')))
    x.onload = () => {
      let dados = {}
      try { dados = JSON.parse(x.responseText || '{}') } catch { /* resposta vazia */ }
      if (x.status >= 200 && x.status < 300) return resolver(dados)
      if (x.status === 401) ouvintes.expirou()
      const erro = new Error((dados.erro && tx(dados.erro)) || tx('Erro {0}', { 0: x.status }))
      Object.assign(erro, { estado: x.status, codigo: dados.codigo, campo: dados.campo })
      rejeitar(erro)
    }
    x.send(formulario)
  })
}
