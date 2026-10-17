import { API_URL } from '../conteudo/api'
import { t as tx } from '../i18n/linguas'
import { traduzirRotulos } from '../i18n/rotulos'

/*
  A sessão fica num cookie HttpOnly posto pelo servidor: o JavaScript da página não lhe toca (nem um script
  injectado). Aqui guarda-se só o sinal «há sessão aberta» (não é segredo), para saber se vale a pena pedir /eu.
*/
const CHAVE = 'esgfaa-admin-sessao'

export function temSessao() {
  try { return localStorage.getItem(CHAVE) } catch { return null }
}
/*
  API noutro domínio (SESSAO_ENTRE_SITES): o cookie é «partitioned» e o servidor manda também um token de
  reserva. Só se usa se o navegador não guardar o cookie (Safari bloqueia os cookies de outros sites): fica
  na memória do separador e vai no cabeçalho Authorization.
*/
const RESERVA = `${CHAVE}-reserva`
let reserva = null
try { reserva = sessionStorage.getItem(RESERVA) } catch { /* sem armazenamento */ }

export function marcarSessao(aberta, tokenReserva = null) {
  try { if (aberta) localStorage.setItem(CHAVE, '1'); else localStorage.removeItem(CHAVE) } catch { /* sem armazenamento */ }
  reserva = aberta ? tokenReserva : null
  try { if (reserva) sessionStorage.setItem(RESERVA, reserva); else sessionStorage.removeItem(RESERVA) } catch { /* sem armazenamento */ }
}
// os cabeçalhos da sessão: o que o servidor exige ao cookie (protecção contra CSRF) ou, sem cookie, o token de reserva
export const cabecalhosSessao = () => (reserva ? { Authorization: `Bearer ${reserva}` } : { 'X-Sessao': 'cookie' })
export const comSessao = (cabecalhos = {}) => ({ credentials: 'include', headers: { ...cabecalhos, ...cabecalhosSessao() } })

// depois de entrar (ou mudar a palavra-passe): o cookie chegou? se não (Safari, API noutro domínio), usa a reserva
export async function confirmarSessao(r) {
  // já sem cookie (reserva): a resposta traz o token novo, que passa a ser a reserva
  if (reserva && r?.token) return marcarSessao(true, r.token)
  marcarSessao(true)
  if (!r?.tokenReserva) return
  const t = await fetch(`${API_URL}/api/admin/eu`, comSessao()).catch(() => null)
  if (!t?.ok) marcarSessao(true, r.tokenReserva)
}

// chamado quando a API responde 401 (sessão expirada ou conta desativada)
let aoExpirar = () => {}
export function definirAoExpirar(fn) {
  aoExpirar = fn
}

export async function api(caminho, { metodo = 'GET', corpo, ficheiros, formulario } = {}) {
  if (!API_URL) throw new Error(tx('A API não está configurada (VITE_API_URL).'))
  const cabecalhos = cabecalhosSessao()
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
    resposta = await fetch(`${API_URL}/api/admin${caminho}`, { method: metodo, headers: cabecalhos, body, credentials: 'include' })
  } catch {
    throw new Error(tx('Não foi possível contactar o servidor. Verifique a ligação.'))
  }
  if (resposta.status === 204) return null
  const dados = await resposta.json().catch(() => ({}))
  if (resposta.status === 401 && caminho !== '/entrar') aoExpirar()
  if (!resposta.ok) throw Object.assign(new Error((dados.erro && tx(dados.erro)) || tx('Erro {0}', { 0: resposta.status })), { codigo: dados.codigo, estado: resposta.status })
  return traduzirRotulos(dados)
}

// ficheiros pedidos com a sessão: descarregam-se (ou abrem-se num separador, com abrir) a partir da memória
export async function obterFicheiro(caminho, nome = 'documento', { abrir = false } = {}) {
  const r = await fetch(`${API_URL}/api/admin${caminho}`, comSessao())
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
