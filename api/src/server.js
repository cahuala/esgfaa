import express from 'express'
import cors from 'cors'
import config from './config.js'
import db from './db.js'
import { cifrarSenha } from './auth.js'
import { PAPEIS_PADRAO, TODAS } from './rbac.js'
import rotasPublicas from './rotas/publico.js'
import rotasAdmin from './rotas/admin.js'
import { semear } from '../scripts/semear.js'

const app = express()

// atrás de um proxy (Render, Nginx…) o IP real vem no cabeçalho X-Forwarded-For
app.set('trust proxy', process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY : false)
app.disable('x-powered-by')

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
  })
  next()
})

app.use(cors({
  origin: (origem, cb) => cb(null, !origem || config.origens.includes(origem)),
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  maxAge: 600,
}))
app.use(express.json({ limit: '2mb' }))

// ficheiros carregados (imagens, vídeos, PDF)
app.use('/uploads', express.static(config.pastaUploads, {
  maxAge: '30d',
  immutable: true,
  setHeaders: (res) => res.set('Cross-Origin-Resource-Policy', 'cross-origin'),
}))

app.get('/api/saude', (req, res) => res.json({ ok: true }))
app.use('/api/publico', rotasPublicas)
app.use('/api/admin', rotasAdmin)

app.use((req, res) => res.status(404).json({ erro: 'Endereço não encontrado.' }))
app.use((erro, req, res, next) => {
  void next
  if (erro.type === 'entity.parse.failed') return res.status(400).json({ erro: 'Pedido mal formado.' })
  if (erro.type === 'entity.too.large') return res.status(413).json({ erro: 'Conteúdo demasiado grande.' })
  console.error(erro)
  res.status(500).json({ erro: 'Erro interno do servidor.' })
})

// ---------- arranque ----------

// papéis por omissão (os editados no painel mantêm-se); o administrador tem sempre todas as permissões
for (const p of PAPEIS_PADRAO) {
  db.prepare('INSERT OR IGNORE INTO papeis (id, nome, descricao, permissoes, sistema) VALUES (?, ?, ?, ?, ?)')
    .run(p.id, p.nome, p.descricao, JSON.stringify(p.permissoes), p.sistema)
}
db.prepare("UPDATE papeis SET permissoes = ?, sistema = 1 WHERE id = 'administrador'").run(JSON.stringify(TODAS))

// 1.º arranque: carrega os conteúdos atuais do site para a base de dados
if (db.prepare('SELECT COUNT(*) n FROM itens').get().n === 0) {
  await semear()
}

// 1.º arranque: cria o administrador inicial
if (db.prepare('SELECT COUNT(*) n FROM utilizadores').get().n === 0) {
  const email = process.env.ADMIN_EMAIL || 'admin@esgfaa.gov.ao'
  const senha = process.env.ADMIN_PASSWORD || 'Mudar1234'
  db.prepare("INSERT INTO utilizadores (nome, email, senha, papel) VALUES (?, ?, ?, 'administrador')")
    .run(process.env.ADMIN_NAME || 'Administrador', email, cifrarSenha(senha))
  console.log(`\nAdministrador inicial criado: ${email} / ${process.env.ADMIN_PASSWORD ? '(palavra-passe definida em ADMIN_PASSWORD)' : senha}`)
  if (!process.env.ADMIN_PASSWORD) console.log('Altere esta palavra-passe no painel depois de entrar.\n')
}

app.listen(config.porta, () => {
  console.log(`API ESGFAA a correr em http://localhost:${config.porta}`)
})
