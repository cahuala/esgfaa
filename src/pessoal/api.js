// endereço da API interna: em desenvolvimento a porta 3002; no servidor da Escola a aplicação é servida pela própria API
export const API = import.meta.env.VITE_PESSOAL_API ?? (import.meta.env.DEV ? 'http://localhost:3002' : '')
/*
  A sessão fica num cookie HttpOnly posto pelo servidor: o JavaScript da página não lhe toca (nem um script
  injectado). Aqui guarda-se só o sinal «há sessão aberta» (não é segredo), para saber se vale a pena pedir /eu.
*/
const CHAVE = 'esg-pessoal-sessao'

export function temSessao() {
  try { return localStorage.getItem(CHAVE) } catch { return null }
}
export function marcarSessao(aberta) {
  try { if (aberta) localStorage.setItem(CHAVE, '1'); else localStorage.removeItem(CHAVE) } catch { /* sem armazenamento */ }
}
// cada pedido leva o cookie e o cabeçalho que o servidor exige para o aceitar (protecção contra CSRF)
export const comSessao = (cabecalhos = {}) => ({ credentials: 'include', headers: { ...cabecalhos, 'X-Sessao': 'cookie' } })

let aoExpirar = () => {}
export const definirAoExpirar = (fn) => { aoExpirar = fn }

export async function api(caminho, { metodo = 'GET', corpo, formulario, consulta } = {}) {
  const cab = { 'X-Sessao': 'cookie' }
  let body
  if (formulario) body = formulario
  else if (corpo !== undefined) {
    cab['Content-Type'] = 'application/json'
    body = JSON.stringify(corpo)
  }
  const q = consulta ? `?${new URLSearchParams(Object.entries(consulta).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString()}` : ''
  let r
  try {
    r = await fetch(`${API}/api${caminho}${q}`, { method: metodo, headers: cab, body, credentials: 'include' })
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
  const r = await fetch(`${API}/api/pessoas/${pessoaId}/foto`, comSessao())
  return r.ok ? URL.createObjectURL(await r.blob()) : null
}

// abre (PDF/imagem) ou descarrega um ficheiro protegido pela sessão
export async function abrirFicheiro(caminho, nome = 'documento') {
  const r = await fetch(`${API}/api${caminho}`, comSessao())
  if (!r.ok) throw new Error(r.status === 404 ? 'Ficheiro não encontrado.' : `Erro ${r.status}`)
  const blob = await r.blob()
  const url = URL.createObjectURL(blob)
  if (/^(application\/pdf|image\/)/.test(blob.type)) window.open(url, '_blank', 'noopener')
  else {
    const a = document.createElement('a')
    a.href = url
    a.download = nome
    a.click()
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

// texto de um PDF (para o sistema procurar os militares num extracto); vazio se for digitalização sem texto
export async function textoDoPdf(ficheiro) {
  const { carregarPdfjs } = await import('../leitor/pdfjs')
  const pdfjs = await carregarPdfjs()
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await ficheiro.arrayBuffer()) }).promise
  const partes = []
  for (let i = 1; i <= Math.min(doc.numPages, 200); i++) {
    const c = await (await doc.getPage(i)).getTextContent()
    partes.push(c.items.map((x) => x.str).join(' '))
  }
  return partes.join('\n')
}

// envio com barra de progresso (o fetch não diz quanto já foi): devolve a resposta como o api()
export function enviarComProgresso(caminho, formulario, aoProgresso, metodo = 'POST') {
  return new Promise((ok, falha) => {
    const x = new XMLHttpRequest()
    x.open(metodo, `${API}/api${caminho}`)
    x.withCredentials = true
    x.setRequestHeader('X-Sessao', 'cookie')
    x.upload.onprogress = (e) => { if (e.lengthComputable) aoProgresso?.((e.loaded / e.total) * 100) }
    x.onload = () => {
      let d = {}
      try { d = x.responseText ? JSON.parse(x.responseText) : {} } catch { /* resposta sem JSON */ }
      if (x.status === 401) aoExpirar()
      if (x.status >= 200 && x.status < 300) ok(x.status === 204 ? null : d)
      else falha(Object.assign(new Error(d.erro || `Erro ${x.status}`), { codigo: d.codigo, campo: d.campo }))
    }
    x.onerror = () => falha(new Error('Não foi possível contactar o servidor do pessoal. Verifique a ligação à rede interna.'))
    x.send(formulario)
  })
}
