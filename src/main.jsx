import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import ConteudoProvider from './conteudo/ConteudoProvider'
import IdiomaProvider from './i18n/IdiomaProvider'
import { prepararLingua } from './i18n/linguas'
import './index.css'

// a aplicação só é carregada depois do dicionário da língua (fora do português)
const [{ default: App }] = await Promise.all([import('./App.jsx'), prepararLingua()])

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
