import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente } from '../apoio/ambiente.js'
import { abrirEventos } from '../apoio/eventos.js'

describe('Pessoal: avisos instantâneos às páginas abertas', () => {
  let amb, token
  before(async () => {
    amb = await criarAmbiente()
    token = await amb.entrar()
  })
  after(() => amb.fechar())

  it('qualquer gravação avisa as páginas abertas (que voltam a pedir o que mudou); sem sessão, nada', async () => {
    assert.equal((await amb.http().get('/api/eventos')).status, 401)
    const ev = await abrirEventos(amb.app, '/api/eventos', token)
    try {
      assert.equal(ev.estado, 200)
      await amb.com(token).post('/api/utilizadores').send({ nome: 'Operador Teste', email: 'op.tempo@pessoal.ao', papel: 'operador', senha: 'Operador2026x' }).expect(201)
      assert.equal((await ev.esperar('atualizar')).length, 1)
    } finally {
      ev.fechar()
    }
  })
})
