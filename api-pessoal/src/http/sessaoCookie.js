/*
  Sessão do navegador em cookie HttpOnly (o JavaScript da página não o consegue ler, nem um script injectado).
  - o navegador pede-o com o cabeçalho "X-Sessao: cookie": ao entrar (ou mudar a palavra-passe) o token vai
    para o cookie e não para a resposta; ao sair, o cookie apaga-se;
  - o cookie só vale com esse cabeçalho: um site alheio não o consegue juntar sem passar pela verificação CORS
    (que só aceita as origens da Escola), o que impede pedidos forjados (CSRF); e é SameSite=Strict;
  - outros clientes (integrações, testes) continuam com "Authorization: Bearer".
*/
export const CABECALHO_SESSAO = 'X-Sessao'

export function lerCookie(req, nome) {
  for (const parte of String(req.headers.cookie ?? '').split(';')) {
    const i = parte.indexOf('=')
    if (i > 0 && parte.slice(0, i).trim() === nome) return decodeURIComponent(parte.slice(i + 1).trim())
  }
  return null
}

export function tokenDoPedido(req, nome) {
  const cab = req.get('authorization') || ''
  if (cab.startsWith('Bearer ')) return cab.slice(7).trim() || null
  if (req.get(CABECALHO_SESSAO) === 'cookie') return lerCookie(req, nome)
  return null
}

// caminhos: as rotas que emitem sessão (entrar, mudar a palavra-passe); seguro: só por HTTPS (produção)
export function sessaoEmCookie({ nome, caminho, caminhos, seguro }) {
  return (req, res, next) => {
    if (req.get(CABECALHO_SESSAO) !== 'cookie') return next()
    const opcoes = { httpOnly: true, sameSite: 'strict', secure: Boolean(seguro || req.secure), path: caminho }
    if (req.method === 'POST' && req.path === '/sair') res.clearCookie(nome, opcoes)
    if (caminhos.includes(req.path)) {
      const json = res.json.bind(res)
      res.json = (corpo) => {
        if (res.statusCode < 400 && corpo && typeof corpo.token === 'string') {
          res.cookie(nome, corpo.token, opcoes)
          const { token, ...resto } = corpo
          void token
          return json({ ...resto, sessao: 'cookie' })
        }
        return json(corpo)
      }
    }
    next()
  }
}
