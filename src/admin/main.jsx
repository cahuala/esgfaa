import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createHashRouter } from 'react-router-dom'
import '@fortawesome/fontawesome-free/css/all.min.css'
import './tema/color-admin.min.css'
import './admin.css'
import './identidade.css'
import './editor/editor.css'
import { prepararLingua } from '../i18n/linguas'
import { ligarTraducaoDosDados } from '../i18n/tradutorPainel'
import { API_URL } from '../conteudo/api'
import { lerToken } from './api'

// a aplicação só é carregada depois do dicionário da língua (fora do português): há textos
// traduzidos logo ao carregar os módulos (menus, listas de tipos), que não podem chegar antes dele
await prepararLingua()
const [{ SessaoProvider }, { default: App }] = await Promise.all([import('./sessao'), import('./App')])

// O painel usa endereços com # (ex.: /admin/#/colecao/noticias) para funcionar no GitHub Pages
// sem configuração extra. Router "de dados" para poder avisar antes de sair com alterações por guardar.
const router = createHashRouter([
  { path: '*', element: <SessaoProvider><App /></SessaoProvider> },
])

ReactDOM.createRoot(document.getElementById('raiz-admin')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)

// fora do português, os dados que aparecem no ecrã (cadeiras, avisos, notificações…) vão ao tradutor do servidor
ligarTraducaoDosDados(async (corpo) => {
  const token = lerToken()
  if (!API_URL || !token) throw new Error('sem sessão')
  const r = await fetch(`${API_URL}/api/admin/traduzir`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(corpo) })
  if (!r.ok) throw new Error(String(r.status))
  return r.json()
})
