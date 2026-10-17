import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ADMIN, criarAmbiente } from '../apoio/ambiente.js'

// cookie da resposta: { valor, atributos }
function cookie(r, nome) {
  const c = (r.headers['set-cookie'] ?? []).find((x) => x.startsWith(`${nome}=`))
  if (!c) return null
  const [par, ...attr] = c.split(';').map((x) => x.trim())
  return { valor: par.slice(nome.length + 1), atributos: attr.map((a) => a.toLowerCase()) }
}

describe('Sessão do navegador em cookie HttpOnly (sem token no JavaScript)', () => {
  let amb
  before(async () => { amb = await criarAmbiente() })
  after(() => amb.fechar())

  it('painel: ao entrar o token vai para o cookie (HttpOnly, SameSite=Strict, só /api/admin) e não para a resposta', async () => {
    const r = await amb.http().post('/api/admin/entrar').set('X-Sessao', 'cookie').send(ADMIN).expect(200)
    assert.equal(r.body.token, undefined)
    assert.equal(r.body.sessao, 'cookie')
    const c = cookie(r, 'esg_painel')
    assert.ok(c?.valor.length > 20)
    assert.ok(c.atributos.includes('httponly'))
    assert.ok(c.atributos.includes('samesite=strict'))
    assert.ok(c.atributos.includes('path=/api/admin'))
    // com o cookie e o cabeçalho, a sessão vale
    const eu = await amb.http().get('/api/admin/eu').set('Cookie', `esg_painel=${c.valor}`).set('X-Sessao', 'cookie').expect(200)
    assert.equal(eu.body.email, ADMIN.email)
  })

  it('CSRF: o cookie sozinho (sem o cabeçalho X-Sessao, como num pedido forjado por outro site) não vale', async () => {
    const r = await amb.http().post('/api/admin/entrar').set('X-Sessao', 'cookie').send(ADMIN)
    const c = cookie(r, 'esg_painel')
    assert.equal((await amb.http().get('/api/admin/eu').set('Cookie', `esg_painel=${c.valor}`)).status, 401)
    assert.equal((await amb.http().post('/api/admin/colecoes/noticias').set('Cookie', `esg_painel=${c.valor}`).send({ titulo: 'Forjada' })).status, 401)
  })

  it('CORS: só as origens da Escola podem mandar o cabeçalho e o cookie', async () => {
    const boa = await amb.http().options('/api/admin/eu').set('Origin', amb.config.origens[0]).set('Access-Control-Request-Method', 'GET').set('Access-Control-Request-Headers', 'x-sessao')
    assert.equal(boa.headers['access-control-allow-origin'], amb.config.origens[0])
    assert.equal(boa.headers['access-control-allow-credentials'], 'true')
    assert.match(boa.headers['access-control-allow-headers'], /X-Sessao/i)
    const ma = await amb.http().options('/api/admin/eu').set('Origin', 'https://site-malicioso.example').set('Access-Control-Request-Method', 'GET').set('Access-Control-Request-Headers', 'x-sessao')
    assert.equal(ma.headers['access-control-allow-origin'], undefined)
  })

  it('sair apaga o cookie e termina a sessão no servidor', async () => {
    const r = await amb.http().post('/api/admin/entrar').set('X-Sessao', 'cookie').send(ADMIN)
    const c = cookie(r, 'esg_painel')
    const s = await amb.http().post('/api/admin/sair').set('Cookie', `esg_painel=${c.valor}`).set('X-Sessao', 'cookie').expect(204)
    const apagado = cookie(s, 'esg_painel')
    assert.equal(apagado.valor, '')
    assert.ok(apagado.atributos.some((a) => a.startsWith('expires=thu, 01 jan 1970')))
    assert.equal((await amb.http().get('/api/admin/eu').set('Cookie', `esg_painel=${c.valor}`).set('X-Sessao', 'cookie')).status, 401)
  })

  it('outros clientes (integrações) continuam com Authorization: Bearer e recebem o token', async () => {
    const r = await amb.http().post('/api/admin/entrar').send(ADMIN).expect(200)
    assert.ok(r.body.token)
    assert.equal(cookie(r, 'esg_painel'), null)
    await amb.http().get('/api/admin/eu').set('Authorization', `Bearer ${r.body.token}`).expect(200)
  })

  it('o cookie do painel não abre o portal (nomes e caminhos diferentes)', async () => {
    const r = await amb.http().post('/api/admin/entrar').set('X-Sessao', 'cookie').send(ADMIN)
    const c = cookie(r, 'esg_painel')
    assert.equal((await amb.http().get('/api/portal/eu').set('Cookie', `esg_portal=${c.valor}`).set('X-Sessao', 'cookie')).status, 401)
  })
})
