import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import '@fortawesome/fontawesome-free/css/all.min.css'
import '../admin/tema/color-admin.min.css'
import '../admin/admin.css'
import '../admin/identidade.css'
import './portal.css'
import { prepararLingua } from '../i18n/linguas'
import { ligarTraducaoDosDados } from '../i18n/tradutorPainel'
import { API_URL } from '../conteudo/api'
import { comSessao, temSessao } from './api'
import { registarServico } from './telemovel'
import { marcarAmbienteTeste } from '../utils/ambienteTeste'

// a aplicação só é carregada depois do dicionário da língua (fora do português): há textos
// traduzidos logo ao carregar os módulos (menus, listas de tipos), que não podem chegar antes dele
await prepararLingua()
const [{ SessaoPortal }, { default: App }] = await Promise.all([import('./sessao'), import('./App')])

// o portal usa o mesmo tema do painel (Color Admin) com a identidade da Escola;
// endereços com # (ex.: /portal/#/cadeiras/3) para funcionar no GitHub Pages sem configuração extra
marcarAmbienteTeste()
ReactDOM.createRoot(document.getElementById('raiz-portal')).render(
  <React.StrictMode>
    <HashRouter>
      <SessaoPortal>
        <App />
      </SessaoPortal>
    </HashRouter>
  </React.StrictMode>,
)

// a aplicação no telemóvel (abre mais depressa e recebe os avisos); em desenvolvimento só quando se ligam os avisos
if (import.meta.env.PROD) registarServico()

// fora do português, os dados que aparecem no ecrã (cadeiras, avisos, notificações…) vão ao tradutor do servidor
ligarTraducaoDosDados(async (corpo) => {
  if (!API_URL || !temSessao()) throw new Error('sem sessão')
  const r = await fetch(`${API_URL}/api/portal/traduzir`, { method: 'POST', ...comSessao({ 'Content-Type': 'application/json' }), body: JSON.stringify(corpo) })
  if (!r.ok) throw new Error(String(r.status))
  return r.json()
})
