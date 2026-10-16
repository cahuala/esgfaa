import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import ConteudoProvider from './conteudo/ConteudoProvider'
import IdiomaProvider from './i18n/IdiomaProvider'
import { prepararLingua } from './i18n/linguas'
import './index.css'

// a aplicação só é carregada depois do dicionário da língua (fora do português): há textos
// traduzidos logo ao carregar os módulos (menus, listas de tipos), que não podem chegar antes dele
await prepararLingua()
const { default: App } = await import('./App.jsx')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <IdiomaProvider>
        <ConteudoProvider>
          <App />
        </ConteudoProvider>
      </IdiomaProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
