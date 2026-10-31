import { API_URL } from '../conteudo/api'
import { t as tx } from '../i18n/linguas'
import { traduzirRotulos } from '../i18n/rotulos'

/*
  A sessão fica num cookie HttpOnly posto pelo servidor: o JavaScript da página não lhe toca (nem um script
  injectado). Aqui guarda-se só o sinal «há sessão aberta» (não é segredo), para saber se vale a pena pedir /eu.
*/
const CHAVE = 'esgfaa-portal-sessao'

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
  const t = await fetch(`${API_URL}/api/portal/eu`, comSessao()).catch(() => null)
  if (!t?.ok) marcarSessao(true, r.tokenReserva)
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
  const cabecalhos = cabecalhosSessao()
  let body
  if (formulario) body = formulario
  else if (corpo !== undefined) {
    cabecalhos['Content-Type'] = 'application/json'
    body = JSON.stringify(corpo)
  }
  let r
  try {
    r = await fetch(`${API_URL}/api/portal${caminho}`, { method: metodo, headers: cabecalhos, body, credentials: 'include' })
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
  const r = await fetch(`${API_URL}/api/portal${caminho}${ver ? '?ver=1' : ''}`, comSessao())
  if (!r.ok) throw new Error(r.status === 404 ? tx('Ficheiro não encontrado.') : tx('Erro {0}', { 0: r.status }))
  return URL.createObjectURL(await r.blob())
}

// ficheiro para o mostrar na página: { url (blob:), tipo, bytes() }, com o progresso da descarga (0 a 1)
export async function carregarFicheiro(id, aoProgresso) {
  const blob = await blobDoFicheiro(id, aoProgresso)
  return { url: URL.createObjectURL(blob), tipo: blob.type, bytes: async () => new Uint8Array(await blob.arrayBuffer()) }
}

async function blobDoFicheiro(id, aoProgresso) {
  const r = await fetch(`${API_URL}/api/portal/ficheiros/${id}?ver=1`, comSessao())
  if (!r.ok) throw new Error(r.status === 404 ? tx('Ficheiro não encontrado.') : tx('Erro {0}', { 0: r.status }))
  const total = Number(r.headers.get('content-length')) || 0
  if (!r.body || !total || !aoProgresso) return r.blob()
  const leitor = r.body.getReader()
  const partes = []
  let recebidos = 0
  for (;;) {
    const { done, value } = await leitor.read()
    if (done) break
    partes.push(value)
    recebidos += value.length
    aoProgresso(Math.min(1, recebidos / total))
  }
  return new Blob(partes, { type: r.headers.get('content-type') || '' })
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
  Abre o ficheiro no leitor do próprio aparelho (no telemóvel, o leitor de PDF do sistema), num separador novo.
  A janela abre-se logo no clique (senão o Safari bloqueia-a) e recebe o ficheiro quando chegar.
*/
export async function abrirNoAparelho(id) {
  const janela = window.open('', '_blank')
  try {
    const url = await urlFicheiro(`/ficheiros/${id}`)
    if (janela) {
      janela.opener = null
      janela.location.href = url
    } else window.location.href = url
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000)
  } catch (e) {
    janela?.close()
    throw e
  }
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
    x.withCredentials = true
    for (const [k, v] of Object.entries(cabecalhosSessao())) x.setRequestHeader(k, v)
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
