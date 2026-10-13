import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import '../index.css'
import './portal.css'
import { SessaoPortal } from './sessao'
import App from './App'

// endereços com # (ex.: /portal/#/cadeiras/3) para funcionar no GitHub Pages sem configuração extra
ReactDOM.createRoot(document.getElementById('raiz-portal')).render(
  <React.StrictMode>
    <HashRouter>
      <SessaoPortal>
        <App />
      </SessaoPortal>
    </HashRouter>
  </React.StrictMode>,
)
