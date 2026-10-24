import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createHashRouter } from 'react-router-dom'
import '@fortawesome/fontawesome-free/css/all.min.css'
import '../admin/tema/color-admin.min.css'
import '../admin/admin.css'
import '../admin/identidade.css'
import './pessoal.css'
import App from './App'
import { marcarAmbienteTeste } from '../utils/ambienteTeste'

// endereços com # (ex.: /pessoal/#/pessoas): funciona servido por qualquer servidor, sem configuração
const router = createHashRouter([{ path: '*', element: <App /> }])

marcarAmbienteTeste()
ReactDOM.createRoot(document.getElementById('raiz-pessoal')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
