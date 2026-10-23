import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { ADMIN, criarAmbiente } from '../apoio/ambiente.js'
import { resolverDesafio } from '../../src/dominio/seguranca/robo.js'

describe('«Não sou um robô» na entrada do painel e do portal', () => {
  let amb
  before(async () => { amb = await criarAmbiente({ env: { VERIFICAR_ROBO: '1', TRUST_PROXY: '1' } }) })
  after(() => amb.fechar())
  const prova = async (base, ip = '198.51.100.30') => {
    const d = (await amb.http().get(`${base}/desafio`).set('X-Forwarded-For', ip).expect(200)).body
    assert.equal(d.ativo, true)
    const { ativo: _a, ...p } = resolverDesafio(d)
    void _a
    return p
  }

  it('sem a prova, a entrada é recusada; com ela, entra; a mesma prova não serve duas vezes', async () => {
    const sem = await amb.http().post('/api/admin/entrar').send({ email: ADMIN.email, senha: ADMIN.senha })
    assert.equal(sem.status, 400)
    assert.equal(sem.body.codigo, 'prova_robo')
    const p = await prova('/api/admin')
    assert.equal((await amb.http().post('/api/admin/entrar').send({ email: ADMIN.email, senha: ADMIN.senha, prova: p })).status, 200)
    assert.equal((await amb.http().post('/api/admin/entrar').send({ email: ADMIN.email, senha: ADMIN.senha, prova: p })).body.codigo, 'prova_robo')
  })

  it('o portal também pede a prova', async () => {
    assert.equal((await amb.http().post('/api/portal/entrar').send({ email: 'x@teste.ao', senha: 'qualquer123' })).body.codigo, 'prova_robo')
    const r = await amb.http().post('/api/portal/entrar').send({ email: 'x@teste.ao', senha: 'qualquer123', prova: await prova('/api/portal') })
    assert.notEqual(r.body.codigo, 'prova_robo') // passou a verificação; a palavra-passe é que está errada
  })

  it('quem já errou a palavra-passe várias vezes recebe um desafio mais difícil', async () => {
    const ip = '198.51.100.31'
    const facil = (await amb.http().get('/api/admin/desafio').set('X-Forwarded-For', ip)).body.maximo
    for (let i = 0; i < 3; i++) await amb.http().post('/api/admin/entrar').set('X-Forwarded-For', ip).send({ email: ADMIN.email, senha: 'errada123456', prova: await prova('/api/admin', ip) })
    assert.ok((await amb.http().get('/api/admin/desafio').set('X-Forwarded-For', ip)).body.maximo > facil)
  })
})
