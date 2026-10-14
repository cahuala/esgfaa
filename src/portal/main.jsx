import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import '@fortawesome/fontawesome-free/css/all.min.css'
import '../admin/tema/color-admin.min.css'
import '../admin/admin.css'
import '../admin/identidade.css'
import './portal.css'
import { SessaoPortal } from './sessao'
import App from './App'

// o portal usa o mesmo tema do painel (Color Admin) com a identidade da Escola;
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
