import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import request from 'supertest'
import { criarConfig } from '../../src/infraestrutura/config.js'
import { criarContentor } from '../../src/contentor.js'
import { criarApp } from '../../src/interfaces/http/app.js'
import { prepararSistema } from '../../src/aplicacao/arranque.js'
import { Utilizador } from '../../src/dominio/identidade/utilizador.js'

export const ADMIN = { email: 'admin@teste.ao', senha: 'Comando2026seguro' }
export const SENHA = 'Teste2026valida'

// relógio controlável (para bloqueios de conta e datas de banners)
export function relogioFalso(inicio = '2026-10-10T12:00:00Z') {
  let atual = new Date(inicio)
  return {
    agora: () => new Date(atual),
    avancar: (minutos) => { atual = new Date(atual.getTime() + minutos * 60_000) },
  }
}

/*
  API completa com base de dados em memória e pasta de uploads temporária.
  Cada teste cria o seu ambiente: nada é partilhado entre testes.
*/
export async function criarAmbiente({ limites = {}, relogio, env = {} } = {}) {
  const pastaUploads = fs.mkdtempSync(path.join(os.tmpdir(), 'esgfaa-teste-'))
  const config = criarConfig({
    NODE_ENV: 'test', DATA_DIR: ':memory:', JWT_SECRET: 'segredo-de-teste-com-mais-de-trinta-e-dois-caracteres',
    ADMIN_EMAIL: ADMIN.email, ADMIN_PASSWORD: ADMIN.senha, ADMIN_NAME: 'Administrador Teste', ...env,
  }, { pastaUploads })
  // limites altos por omissão; os testes de limites baixam-nos
  for (const k of Object.keys(config.limites)) config.limites[k] = { janelaMs: 60_000, maximo: 10_000, ...limites[k] }

  const contentor = criarContentor(config, relogio ? { relogio } : {})
  await prepararSistema(contentor)
  const erros = []
  const app = criarApp(contentor, { registarErro: (e) => erros.push(e) })
  const http = () => request(app)

  async function entrar(email = ADMIN.email, senha = ADMIN.senha) {
    const r = await http().post('/api/admin/entrar').send({ email, senha })
    if (r.status !== 200) throw new Error(`Falha ao entrar (${r.status}): ${r.body.erro}`)
    return r.body.token
  }

  // cria um utilizador diretamente na base (mais rápido que pela API)
  async function criarUtilizador(papel, { email = `${papel}.${Math.random().toString(36).slice(2, 8)}@teste.ao`, senha = SENHA, ativo = true } = {}) {
    const u = Utilizador.novo({ nome: `Utilizador ${papel}`, email, papel, senhaCifrada: await contentor.cifra.cifrar(senha) })
    u.ativo = ativo
    const criado = contentor.repositorios.utilizadores.criar(u)
    return { ...criado, senha, token: ativo ? await entrar(email, senha) : null }
  }

  // pedido autenticado: com(token).get('/api/admin/eu')
  const com = (token) => {
    const ag = {}
    for (const m of ['get', 'post', 'put', 'delete']) ag[m] = (url) => http()[m](url).set('Authorization', `Bearer ${token}`)
    return ag
  }

  function fechar() {
    contentor.fechar()
    fs.rmSync(pastaUploads, { recursive: true, force: true })
  }

  return { app, http, contentor, config, entrar, criarUtilizador, com, fechar, erros, pastaUploads }
}

export const noticia = (extra = {}) => ({
  titulo: 'Abertura do ano académico',
  categoria: 'Institucional',
  data: '2026-10-01',
  resumo: 'Resumo da notícia.',
  conteudo: [{ tipo: 'texto', html: '<p>Texto da notícia.</p>' }],
  ...extra,
})
