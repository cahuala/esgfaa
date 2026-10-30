import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import request from 'supertest'
import { criarConfig } from '../../src/infraestrutura/config.js'
import { criarContentor } from '../../src/contentor.js'
import { criarApp } from '../../src/interfaces/http/app.js'
import { prepararSistema } from '../../src/aplicacao/arranque.js'
import { Utilizador } from '../../src/dominio/identidade/utilizador.js'
import { URL_TESTE, criarEsquema, apagarEsquema } from './esquema.js'

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
  API completa com um esquema PostgreSQL próprio e uma pasta de uploads temporária.
  Cada teste cria o seu ambiente: nada é partilhado entre testes.
*/
export async function criarAmbiente({ limites = {}, relogio, env = {}, externos = {} } = {}) {
  const pastaUploads = fs.mkdtempSync(path.join(os.tmpdir(), 'esgfaa-teste-'))
  const pastaPrivada = fs.mkdtempSync(path.join(os.tmpdir(), 'esgfaa-privado-'))
  const config = criarConfig({
    NODE_ENV: 'test', DATABASE_URL: URL_TESTE, JWT_SECRET: 'segredo-de-teste-com-mais-de-trinta-e-dois-caracteres',
    ADMIN_EMAIL: ADMIN.email, ADMIN_PASSWORD: ADMIN.senha, ADMIN_NAME: 'Administrador Teste', ...env,
  }, { pastaUploads, pastaPrivada })
  // limites altos por omissão; os testes de limites baixam-nos
  for (const k of Object.keys(config.limites)) config.limites[k] = { janelaMs: 60_000, maximo: 10_000, ...limites[k] }

  const esquema = await criarEsquema()
  const contentor = criarContentor(config, { esquema, externos: { push: null, ...externos }, ...(relogio ? { relogio } : {}) })
  await prepararSistema(contentor)
  const erros = []
  const app = criarApp(contentor, { registarErro: (e) => erros.push(e) })
  const http = () => request(app)

  // a palavra-passe inicial (aleatória) de cada conta do portal, como na ficha de acesso que a Repartição entrega
  const senhas = new Map()
  const registo = contentor.servicos.pessoal.registo
  const gerar = registo.gerarSenha
  registo.gerarSenha = (email) => {
    const s = gerar(email)
    senhas.set(email, s)
    return s
  }
  const senhaInicial = (email) => senhas.get(String(email).trim().toLowerCase()) ?? 'sem-ficha-de-acesso'

  async function entrar(email = ADMIN.email, senha = ADMIN.senha) {
    const r = await http().post('/api/admin/entrar').send({ email, senha })
    if (r.status !== 200) throw new Error(`Falha ao entrar (${r.status}): ${r.body.erro}`)
    return r.body.token
  }

  // cria um utilizador diretamente na base (mais rápido que pela API)
  async function criarUtilizador(papel, { email = `${papel}.${Math.random().toString(36).slice(2, 8)}@teste.ao`, senha = SENHA, ativo = true } = {}) {
    const u = Utilizador.novo({ nome: `Utilizador ${papel}`, email, papel, senhaCifrada: await contentor.cifra.cifrar(senha) })
    u.ativo = ativo
    const criado = await contentor.repositorios.utilizadores.criar(u)
    return { ...criado, senha, token: ativo ? await entrar(email, senha) : null }
  }

  // o Comandante aprova uma publicação do site (nada chega ao público sem ele)
  let comandante = null
  const oComandante = async () => (comandante ??= await criarUtilizador('comandante'))
  async function aprovar(colecao, id) {
    await oComandante()
    const r = await http().post(`/api/admin/publicacoes/${colecao}/${encodeURIComponent(id)}/decisao`).set('Authorization', `Bearer ${comandante.token}`).send({ decisao: 'aprovar' })
    if (r.status !== 200) throw new Error(`Falha ao aprovar ${colecao}/${id} (${r.status}): ${r.body.erro}`)
    return r.body
  }

  // pedido autenticado: com(token).get('/api/admin/eu')
  const com = (token) => {
    const ag = {}
    for (const m of ['get', 'post', 'put', 'patch', 'delete']) ag[m] = (url) => http()[m](url).set('Authorization', `Bearer ${token}`)
    return ag
  }

  async function fechar() {
    await contentor.fechar()
    await apagarEsquema(esquema)
    fs.rmSync(pastaUploads, { recursive: true, force: true })
    fs.rmSync(pastaPrivada, { recursive: true, force: true })
  }

  /*
    Estudante novo como na Escola: o Pessoal e Quadros regista a conta e a Administração Escolar
    matricula-o na turma. agente: pedido autenticado com as duas permissões. Devolve a resposta do registo.
  */
  async function registarEMatricular(agente, turmaId, dados) {
    const r = await agente.post('/api/admin/academico/contas').send({ tipo: 'estudante', ...dados })
    if (r.status === 201) {
      const m = await agente.post(`/api/admin/academico/turmas/${turmaId}/matriculas`).send({ estudanteId: r.body.id })
      if (m.status !== 201) return m
    }
    return r
  }

  return { registarEMatricular, senhaInicial, oComandante, app, http, contentor, config, entrar, criarUtilizador, com, aprovar, fechar, erros, pastaUploads, pastaPrivada, esquema }
}

export const noticia = (extra = {}) => ({
  titulo: 'Abertura do ano académico',
  categoria: 'Institucional',
  data: '2026-10-01',
  resumo: 'Resumo da notícia.',
  conteudo: [{ tipo: 'texto', html: '<p>Texto da notícia.</p>' }],
  ...extra,
})
