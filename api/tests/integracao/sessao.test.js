import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import { criarAmbiente, relogioFalso, ADMIN, SENHA } from '../apoio/ambiente.js'

describe('sessão do painel', () => {
  let amb
  let relogio
  beforeEach(async () => {
    relogio = relogioFalso()
    amb = await criarAmbiente({ relogio })
  })
  afterEach(() => amb.fechar())

  it('entra com credenciais certas e devolve token e utilizador sem hash', async () => {
    const r = await amb.http().post('/api/admin/entrar').send({ email: ' ADMIN@teste.ao ', senha: ADMIN.senha })
    assert.equal(r.status, 200)
    assert.ok(r.body.token)
    assert.equal(r.body.utilizador.email, ADMIN.email)
    assert.ok(!('senha' in r.body.utilizador))
  })

  it('a mesma mensagem para e-mail inexistente e palavra-passe errada', async () => {
    const a = await amb.http().post('/api/admin/entrar').send({ email: 'ninguem@teste.ao', senha: 'x' })
    const b = await amb.http().post('/api/admin/entrar').send({ email: ADMIN.email, senha: 'errada' })
    assert.equal(a.status, 401)
    assert.equal(b.status, 401)
    assert.equal(a.body.erro, b.body.erro)
  })

  it('pedido sem corpo ou com tipos errados não rebenta', async () => {
    assert.equal((await amb.http().post('/api/admin/entrar')).status, 401)
    assert.equal((await amb.http().post('/api/admin/entrar').send({ email: ['a'], senha: { $ne: 1 } })).status, 400)
  })

  it('bloqueia a conta ao fim de 5 falhas (423) e desbloqueia passados 15 minutos', async () => {
    for (let i = 0; i < 4; i++) assert.equal((await amb.http().post('/api/admin/entrar').send({ email: ADMIN.email, senha: 'errada' })).status, 401)
    const bloqueio = await amb.http().post('/api/admin/entrar').send({ email: ADMIN.email, senha: 'errada' })
    assert.equal(bloqueio.status, 423)
    assert.equal(bloqueio.body.codigo, 'conta_bloqueada')
    assert.ok(bloqueio.body.ate)

    // mesmo com a palavra-passe certa continua bloqueada
    assert.equal((await amb.http().post('/api/admin/entrar').send(ADMIN)).status, 423)
    relogio.avancar(16)
    assert.equal((await amb.http().post('/api/admin/entrar').send(ADMIN)).status, 200)

    const acoes = amb.contentor.repositorios.atividades.listar({ acao: 'bloquear_conta' })
    assert.equal(acoes.total, 1)
  })

  it('conta desativada não entra (403)', async () => {
    await amb.criarUtilizador('redator', { email: 'inativo@teste.ao', ativo: false })
    const r = await amb.http().post('/api/admin/entrar').send({ email: 'inativo@teste.ao', senha: SENHA })
    assert.equal(r.status, 403)
  })

  it('limita tentativas por IP + e-mail (429)', async () => {
    const lim = await criarAmbiente({ limites: { entrar: { maximo: 3 } } })
    try {
      for (let i = 0; i < 3; i++) await lim.http().post('/api/admin/entrar').send({ email: 'x@teste.ao', senha: 'x' })
      const r = await lim.http().post('/api/admin/entrar').send({ email: 'x@teste.ao', senha: 'x' })
      assert.equal(r.status, 429)
      assert.ok(r.headers['retry-after'] || r.headers.ratelimit)
      // outro e-mail não é afetado
      assert.equal((await lim.http().post('/api/admin/entrar').send(ADMIN)).status, 200)
    } finally {
      lim.fechar()
    }
  })

  it('rotas protegidas exigem token válido', async () => {
    assert.equal((await amb.http().get('/api/admin/eu')).status, 401)
    assert.equal((await amb.http().get('/api/admin/eu').set('Authorization', 'Bearer lixo')).status, 401)
    const forjado = jwt.sign({ ver: 0 }, 'outro-segredo', { subject: '1', jwtid: 'x', issuer: 'esgfaa-api', audience: 'esgfaa-painel' })
    assert.equal((await amb.http().get('/api/admin/eu').set('Authorization', `Bearer ${forjado}`)).status, 401)
    const none = jwt.sign({ ver: 0 }, null, { algorithm: 'none', subject: '1', jwtid: 'x', issuer: 'esgfaa-api', audience: 'esgfaa-painel' })
    assert.equal((await amb.http().get('/api/admin/eu').set('Authorization', `Bearer ${none}`)).status, 401)
  })

  it('/eu devolve permissões, nome do papel e aviso de mudar senha', async () => {
    const t = await amb.entrar()
    const r = await amb.com(t).get('/api/admin/eu')
    assert.equal(r.status, 200)
    assert.equal(r.body.nomePapel, 'Administrador')
    assert.ok(r.body.permissoes.includes('papeis.gerir'))
    assert.equal(r.body.deveMudarSenha, false)
  })

  it('palavra-passe fraca antiga obriga a mudar', async () => {
    const u = await amb.criarUtilizador('redator', { email: 'fraca@teste.ao' })
    const conta = amb.contentor.repositorios.utilizadores.porId(u.id)
    conta.senha = await amb.contentor.cifra.cifrar('Mudar1234')
    amb.contentor.repositorios.utilizadores.guardar(conta)
    const t = await amb.entrar('fraca@teste.ao', 'Mudar1234')
    assert.equal((await amb.com(t).get('/api/admin/eu')).body.deveMudarSenha, true)
  })

  it('sair termina a sessão (o token deixa de valer)', async () => {
    const t = await amb.entrar()
    assert.equal((await amb.com(t).post('/api/admin/sair')).status, 204)
    assert.equal((await amb.com(t).get('/api/admin/eu')).status, 401)
  })

  it('mudar a palavra-passe: valida, termina outras sessões e devolve token novo', async () => {
    const t1 = await amb.entrar()
    const t2 = await amb.entrar()
    assert.equal((await amb.com(t1).put('/api/admin/eu/senha').send({ atual: 'errada', nova: 'NovaSenha2026x' })).status, 400)
    assert.equal((await amb.com(t1).put('/api/admin/eu/senha').send({ atual: ADMIN.senha, nova: 'curta1' })).status, 400)
    assert.equal((await amb.com(t1).put('/api/admin/eu/senha').send({ atual: ADMIN.senha, nova: ADMIN.senha })).status, 400)

    const r = await amb.com(t1).put('/api/admin/eu/senha').send({ atual: ADMIN.senha, nova: 'NovaSenha2026x' })
    assert.equal(r.status, 200)
    assert.ok(r.body.token)
    assert.equal((await amb.com(t1).get('/api/admin/eu')).status, 401)
    assert.equal((await amb.com(t2).get('/api/admin/eu')).status, 401)
    assert.equal((await amb.com(r.body.token).get('/api/admin/eu')).status, 200)
    assert.equal((await amb.http().post('/api/admin/entrar').send({ email: ADMIN.email, senha: 'NovaSenha2026x' })).status, 200)
  })
})
