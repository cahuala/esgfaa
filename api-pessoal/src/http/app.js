import fs from 'node:fs'
import path from 'node:path'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { criarVerificadorRedes } from '../infraestrutura/redes.js'
import { idPedido, semCache, tratarErros } from './middlewares.js'
import { rotas } from './rotas.js'

/*
  Aplicação do Sistema de Gestão de Pessoal (rede interna). Antes de tudo, recusa quem não vem das redes
  internas da Escola: este sistema nunca deve responder a pedidos da internet.
*/
export function criarApp(contentor, { registarErro } = {}) {
  const { config, servicos } = contentor
  const app = express()
  app.set('trust proxy', config.confiarProxy)
  app.disable('x-powered-by')
  app.set('etag', false)

  const interna = criarVerificadorRedes(config.redesInternas)
  app.use((req, res, next) => {
    if (interna(req.ip)) return next()
    servicos.auditoria.registar(null, 'acesso_recusado', req.originalUrl.slice(0, 200), {}, req.ip ?? '').catch(() => {})
    res.status(403).json({ erro: 'O Sistema de Gestão de Pessoal só está disponível na rede interna da Escola.', codigo: 'fora_da_rede' })
  })
  app.use(idPedido)
  app.use(helmet({
    contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], imgSrc: ["'self'", 'data:', 'blob:'], styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'], scriptSrc: ["'self'"], connectSrc: ["'self'"], frameAncestors: ["'none'"], objectSrc: ["'none'"] } },
    strictTransportSecurity: false,
  }))
  app.use(cors({ origin: (o, cb) => cb(null, !o || config.origens.includes(o)), methods: ['GET', 'POST', 'PUT', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization', 'X-Sessao'], credentials: true, maxAge: 600 }))
  app.use(express.json({ limit: '2mb', strict: true }))

  app.get('/api/saude', (req, res) => res.json({ ok: true }))
  app.use('/api', semCache, rotas({ servicos, config }))
  app.use('/api', (req, res) => res.status(404).json({ erro: 'Endereço não encontrado.', codigo: 'nao_encontrado' }))

  // a aplicação (dist/pessoal) servida no mesmo endereço; as rotas do navegador (#/...) caem no index.html
  if (config.pastaApp && fs.existsSync(path.join(config.pastaApp, 'index.html'))) {
    app.use(express.static(config.pastaApp, { index: 'index.html', dotfiles: 'deny', maxAge: '1h' }))
    app.get(/.*/, (req, res) => res.sendFile(path.join(config.pastaApp, 'index.html')))
  }
  app.use(tratarErros(registarErro ?? ((e) => console.error(JSON.stringify({ t: new Date().toISOString(), id: e.id, erro: e.erro?.stack || String(e.erro) })))))
  return app
}
