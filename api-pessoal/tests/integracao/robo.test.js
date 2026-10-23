import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { ADMIN, criarAmbiente } from '../apoio/ambiente.js'
import { resolverDesafio } from '../../src/dominio/seguranca/robo.js'

describe('Pessoal: «Não sou um robô» na entrada', () => {
  let amb
  before(async () => { amb = await criarAmbiente({ env: { VERIFICAR_ROBO: '1' } }) })
  after(() => amb.fechar())

  it('sem a prova é recusado; com ela entra; a mesma prova não serve duas vezes', async () => {
    assert.equal((await amb.http().post('/api/entrar').send(ADMIN)).body.codigo, 'prova_robo')
    const d = (await amb.http().get('/api/desafio').expect(200)).body
    assert.equal(d.ativo, true)
    const { ativo: _a, ...prova } = resolverDesafio(d)
    void _a
    assert.equal((await amb.http().post('/api/entrar').send({ ...ADMIN, prova })).status, 200)
    assert.equal((await amb.http().post('/api/entrar').send({ ...ADMIN, prova })).body.codigo, 'prova_robo')
  })
})
