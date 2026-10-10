import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { idPedido, registoPedidos, semCache } from './middlewares/pedido.js'
import { naoEncontrado, tratarErros } from './middlewares/erros.js'
import { rotasAdmin } from './rotas/admin.js'
import { rotasPublicas } from './rotas/publico.js'

// Aplicação Express (sem arrancar o servidor: os testes usam-na diretamente)
export function criarApp(contentor, { registarErro } = {}) {
  const { config, servicos, armazenamento } = contentor
  const app = express()

  // atrás de um proxy (Render, Nginx…) o IP real vem no cabeçalho X-Forwarded-For
  app.set('trust proxy', config.confiarProxy)
  app.disable('x-powered-by')
  app.set('etag', false)

  app.use(idPedido)
  if (config.registos === 'json') app.use(registoPedidos())

  app.use(helmet({
    // as imagens/vídeos carregados são mostrados pelo site, que está noutro domínio
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], imgSrc: ["'self'"], mediaSrc: ["'self'"], frameAncestors: ["'none'"] } },
    strictTransportSecurity: config.producao ? { maxAge: 31536000, includeSubDomains: true } : false,
  }))

  app.use(cors({
    origin: (origem, cb) => cb(null, !origem || config.origens.includes(origem)),
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'Retry-After'],
    maxAge: 600,
  }))
  app.use(express.json({ limit: '2mb', strict: true }))

  // ficheiros carregados (imagens, vídeos, PDF)
  if (config.pastaUploads) {
    app.use('/uploads', express.static(config.pastaUploads, { maxAge: '30d', immutable: true, index: false, dotfiles: 'deny', redirect: false }))
  }

  app.get('/api/saude', (req, res) => res.json({ ok: true }))
  app.use('/api/publico', rotasPublicas({ servicos, config }))
  app.use('/api/admin', semCache, rotasAdmin({ servicos, config, armazenamento }))

  app.use(naoEncontrado)
  app.use(tratarErros(registarErro ?? ((e) => console.error(JSON.stringify({ t: new Date().toISOString(), id: e.id, erro: e.erro?.stack || String(e.erro) })))))
  return app
}
