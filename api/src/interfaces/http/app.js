import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { idPedido, registoPedidos, semCache } from './middlewares/pedido.js'
import { naoEncontrado, tratarErros } from './middlewares/erros.js'
import { rotasAdmin } from './rotas/admin.js'
import { rotasPublicas } from './rotas/publico.js'
import { rotasPortal } from './rotas/portal.js'
import { rotasPacotes } from './rotas/pacotes.js'
import { rotasLti } from './rotas/lti.js'
import { rotasIntegracao } from './rotas/integracao.js'
import { criarCacheConteudo } from './cacheConteudo.js'

// Aplicação Express (sem arrancar o servidor: os testes usam-na diretamente)
export function criarApp(contentor, { registarErro } = {}) {
  const { config, servicos, armazenamento, privados } = contentor
  const app = express()

  // atrás de um proxy (Render, Nginx…) o IP real vem no cabeçalho X-Forwarded-For
  app.set('trust proxy', config.confiarProxy)
  app.disable('x-powered-by')
  app.set('etag', false)

  app.use(idPedido)

  // Centro de segurança: endereços bloqueados ficam por aqui; os outros pedidos são contados e classificados à saída
  const seguranca = servicos.seguranca
  app.use((req, res, next) => {
    if (seguranca.estaBloqueado(req.ip)) {
      seguranca.registarBloqueado(req.ip, req.originalUrl)
      return res.status(403).json({ erro: 'Este endereço está bloqueado por motivos de segurança. Se for um engano, contacte a Escola.', codigo: 'bloqueado' })
    }
    const inicio = process.hrtime.bigint()
    res.on('finish', () => seguranca.registarPedido({ ip: req.ip, metodo: req.method, url: req.originalUrl, estado: res.statusCode, ms: Number((process.hrtime.bigint() - inicio) / 1_000_000n) }))
    next()
  })
  if (config.registos === 'json') app.use(registoPedidos())

  app.use(helmet({
    // as imagens/vídeos carregados são mostrados pelo site, que está noutro domínio
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], imgSrc: ["'self'"], mediaSrc: ["'self'"], frameAncestors: ["'none'"] } },
    strictTransportSecurity: config.producao ? { maxAge: 31536000, includeSubDomains: true } : false,
  }))

  app.use(cors({
    origin: (origem, cb) => cb(null, !origem || config.origens.includes(origem)),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Sessao'],
    credentials: true, // o cookie da sessão (HttpOnly) vai nos pedidos das páginas da Escola
    exposedHeaders: ['X-Request-Id', 'Retry-After'],
    maxAge: 600,
  }))
  // defesa activa: os serviços desligados (pelo nível de protecção ou à mão) respondem 503 — depois do CORS,
  // para o navegador mostrar a mensagem (e a verificação OPTIONS do navegador passa sempre)
  app.use((req, res, next) => {
    const fechado = req.method === 'OPTIONS' ? null : seguranca.decidir({ metodo: req.method, caminho: req.path, ip: req.ip })
    if (!fechado) return next()
    res.status(fechado.estado).set('Retry-After', '600').json({ erro: fechado.erro, codigo: fechado.codigo, servico: fechado.servico })
  })
  // o Sistema de Gestão de Pessoal assina o corpo tal como vem: esta rota lê-o antes do express.json
  app.use('/api/integracao', semCache, rotasIntegracao({ servicos, config }))
  app.use(express.json({ limit: '2mb', strict: true }))
  // ataques no conteúdo dos pedidos: ferramentas de ataque, robôs de IA, injecções no corpo, phishing
  app.use((req, res, next) => {
    const recusa = seguranca.inspecionar({ metodo: req.method, caminho: req.path, ip: req.ip, agente: req.get('user-agent'), corpo: req.body, consulta: req.query })
    if (!recusa) return next()
    res.status(recusa.estado).json({ erro: recusa.erro, codigo: recusa.codigo })
  })

  // ficheiros carregados (imagens, vídeos, PDF)
  if (config.pastaUploads) {
    app.use('/uploads', express.static(config.pastaUploads, { maxAge: '30d', immutable: true, index: false, dotfiles: 'deny', redirect: false }))
  }

  app.get('/api/saude', (req, res) => res.json({ ok: true }))
  // o conteúdo do site fica alguns segundos em memória; uma alteração no painel apaga-o (e os comentários e gostos também)
  const cache = criarCacheConteudo()
  const apagarSeMudou = (req, res, next) => {
    if (req.method !== 'GET') res.on('finish', () => { if (res.statusCode < 400) cache.limpar() })
    next()
  }
  app.use('/api/publico', apagarSeMudou, rotasPublicas({ servicos, config, cache }))
  app.use('/api/admin', semCache, apagarSeMudou, rotasAdmin({ servicos, config, armazenamento, privados }))
  app.use('/api/pacotes', rotasPacotes({ servicos, config }))
  app.use('/api/lti', semCache, rotasLti({ servicos, config }))
  app.use('/api/portal', semCache, rotasPortal({ servicos, config, privados }))

  app.use(naoEncontrado)
  app.use(tratarErros(registarErro ?? ((e) => console.error(JSON.stringify({ t: new Date().toISOString(), id: e.id, erro: e.erro?.stack || String(e.erro) })))))
  return app
}
