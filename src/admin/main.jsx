import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createHashRouter } from 'react-router-dom'
import '@fortawesome/fontawesome-free/css/all.min.css'
import './tema/color-admin.min.css'
import './admin.css'
import './identidade.css'
import './editor/editor.css'
import { prepararLingua } from '../i18n/linguas'

// a aplicação só é carregada depois do dicionário da língua (fora do português)
const [{ SessaoProvider }, { default: App }] = await Promise.all([import('./sessao'), import('./App'), prepararLingua()])

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
