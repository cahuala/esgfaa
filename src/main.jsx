import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import ConteudoProvider from './conteudo/ConteudoProvider'
import IdiomaProvider from './i18n/IdiomaProvider'
import './index.css'

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
