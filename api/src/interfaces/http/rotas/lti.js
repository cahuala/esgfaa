import crypto from 'node:crypto'
import express, { Router } from 'express'
import { limitar } from '../middlewares/limites.js'
import { baseUrl } from '../apresentacao.js'

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

// /api/lti/… — o que as ferramentas LTI 1.3 usam: a chave pública do portal e o endereço de autorização (OIDC)
export function rotasLti({ servicos, config }) {
  const r = Router()
  r.use(limitar(config.limites.publico))
  r.get('/jwks', (req, res) => res.set('Cache-Control', 'public, max-age=3600').json(servicos.ensino.lti.jwks()))

  // a ferramenta envia o navegador para aqui (GET ou POST); responde-se com um formulário que segue sozinho
  const autorizar = async (req, res) => {
    const { acao, campos } = await servicos.ensino.lti.autorizar({ ...req.query, ...(req.body || {}) }, baseUrl(req, config))
    const nonce = crypto.randomBytes(16).toString('base64')
    res.set({
      'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
      'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; form-action ${new URL(acao).origin}`,
    })
    res.send(`<!doctype html><html lang="pt"><head><meta charset="utf-8"><title>A abrir a ferramenta…</title></head>
<body style="font-family:system-ui,sans-serif;padding:40px;color:#555"><form id="f" method="post" action="${esc(acao)}">
${Object.entries(campos).map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join('\n')}
<p>A abrir a ferramenta…</p><noscript><button type="submit">Continuar</button></noscript></form>
<script nonce="${nonce}">document.getElementById('f').submit()</script></body></html>`)
  }
  r.get('/autorizar', autorizar)
  r.post('/autorizar', express.urlencoded({ extended: false, limit: '20kb' }), autorizar)
  return r
}
