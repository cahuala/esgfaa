import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ADMIN, criarAmbiente } from '../apoio/ambiente.js'

const cookieDe = (r) => (r.headers['set-cookie'] ?? []).find((x) => x.startsWith('esg_pessoal='))

describe('Pessoal: sessão do navegador em cookie HttpOnly', () => {
  let amb
  before(async () => { amb = await criarAmbiente() })
  after(() => amb.fechar())

  it('entrar põe o token num cookie HttpOnly/SameSite=Strict; sem o cabeçalho X-Sessao o cookie não vale; sair apaga-o', async () => {
    const r = await amb.http().post('/api/entrar').set('X-Sessao', 'cookie').send({ email: ADMIN.email, senha: ADMIN.senha }).expect(200)
    assert.equal(r.body.token, undefined)
    const c = cookieDe(r)
    assert.match(c, /HttpOnly/)
    assert.match(c, /SameSite=Strict/)
    const valor = c.split(';')[0]
    await amb.http().get('/api/eu').set('Cookie', valor).set('X-Sessao', 'cookie').expect(200)
    assert.equal((await amb.http().get('/api/pessoas').set('Cookie', valor)).status, 401) // pedido forjado (CSRF)
    const s = await amb.http().post('/api/sair').set('Cookie', valor).set('X-Sessao', 'cookie').expect(204)
    assert.match(cookieDe(s), /esg_pessoal=;/)
    assert.equal((await amb.http().get('/api/eu').set('Cookie', valor).set('X-Sessao', 'cookie')).status, 401)
  })
})
