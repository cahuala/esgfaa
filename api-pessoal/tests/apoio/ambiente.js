import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import pg from 'pg'
import request from 'supertest'
import { RAIZ, criarConfig } from '../../src/config.js'
import { criarContentor } from '../../src/contentor.js'
import { criarApp } from '../../src/http/app.js'

export const URL_TESTE = process.env.PESSOAL_DATABASE_URL_TESTE || 'postgresql://pessoal:pessoal_dev@localhost:5434/esgfaa_pessoal_teste'
export const ADMIN = { email: 'admin@pessoal.ao', senha: 'Comando2026seguro' }
const pasta = path.join(RAIZ, 'prisma', 'migrations')
const MIGRACOES = fs.readdirSync(pasta).filter((d) => fs.existsSync(path.join(pasta, d, 'migration.sql'))).sort().map((d) => fs.readFileSync(path.join(pasta, d, 'migration.sql'), 'utf8'))

async function sql(fn) {
  const c = new pg.Client({ connectionString: URL_TESTE })
  await c.connect()
  try { return await fn(c) } finally { await c.end() }
}

// API completa com um esquema próprio; nada é partilhado entre testes
export async function criarAmbiente({ env = {}, enviar, enviarBi, hoje = '2026-10-17T10:00:00Z' } = {}) {
  const esquema = `t_${crypto.randomBytes(6).toString('hex')}`
  await sql(async (c) => {
    await c.query(`CREATE SCHEMA "${esquema}"`)
    await c.query(`SET search_path TO "${esquema}"`)
    for (const m of MIGRACOES) await c.query(m)
  })
  const dados = fs.mkdtempSync(path.join(os.tmpdir(), 'pessoal-'))
  const config = criarConfig({ NODE_ENV: 'test', DATABASE_URL: URL_TESTE, JWT_SECRET: 'segredo-de-teste-com-mais-de-trinta-e-dois-caracteres', ADMIN_EMAIL: ADMIN.email, ADMIN_PASSWORD: ADMIN.senha, DATA_DIR: dados, ...env })
  const contentor = criarContentor(config, { esquema, agora: () => new Date(hoje), enviar, enviarBi })
  await contentor.servicos.sessao.garantirAdministrador(config.admin)
  const erros = []
  const app = criarApp(contentor, { registarErro: (e) => erros.push(e) })
  const http = () => request(app)
  const entrar = async (email = ADMIN.email, senha = ADMIN.senha) => {
    const r = await http().post('/api/entrar').send({ email, senha })
    if (r.status !== 200) throw new Error(`Falha ao entrar (${r.status}): ${r.body.erro}`)
    return r.body.token
  }
  const com = (token) => Object.fromEntries(['get', 'post', 'put', 'delete'].map((m) => [m, (url) => http()[m](url).set('Authorization', `Bearer ${token}`)]))
  async function fechar() {
    await contentor.fechar()
    await sql((c) => c.query(`DROP SCHEMA IF EXISTS "${esquema}" CASCADE`))
    fs.rmSync(dados, { recursive: true, force: true })
  }
  // o despacho do Comandante nos testes: uma conta de Comandante (a primeira não precisa de despacho) defere tudo
  let comandante = null
  async function deferirTudo() {
    if (!comandante) {
      const adm = com(await entrar())
      const dados = { nome: 'Comandante dos Testes', email: 'comandante.testes@pessoal.ao', papel: 'comandante', senha: 'Comandante2026x' }
      const r = await adm.post('/api/utilizadores').send(dados)
      if (r.status !== 201) throw new Error(`Não criou o Comandante dos testes (${r.status}): ${r.body.erro}`)
      const t = await entrar(dados.email, dados.senha)
      const m = await com(t).post('/api/mudar-senha').send({ atual: dados.senha, nova: 'Comandante2027y' })
      comandante = com(m.body.token)
    }
    const l = (await comandante.get('/api/pedidos-despacho?estado=pendente')).body
    for (const x of l) await comandante.post(`/api/pedidos-despacho/${x.id}/decidir`).send({ decisao: 'deferido' })
    return l.length
  }
  // cria uma conta do sistema e, se ficar à espera do despacho, defere-a
  async function criarConta(cliente, dados) {
    const r = await cliente.post('/api/utilizadores').send(dados).expect(201)
    if (r.body.aDespacho) await deferirTudo()
    return r
  }
  return { app, http, entrar, com, contentor, erros, fechar, deferirTudo, criarConta }
}

export const militar = (extra = {}) => ({
  tipo: 'militar', vinculo: 'funcionario', nome: 'António Manuel Kiala', nip: `NIP${Math.random().toString().slice(2, 9)}`, genero: 'M',
  dataNascimento: '1982-04-12', ramo: 'EXE', posto: 'capitao', fps: 'QP', quadroEspecial: 'INF', dataIngresso: '2003-02-01', dataAntiguidadePosto: '2019-09-01', ...extra,
})
