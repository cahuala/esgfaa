import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, militar } from '../apoio/ambiente.js'
import { eSobrecarga } from '../../src/infraestrutura/bd.js'

// 30 pessoas a carregar no mesmo botão ao mesmo tempo
describe('Pedidos ao mesmo tempo (números seguidos, sem repetir nem falhar)', () => {
  let amb, adm, pessoas
  before(async () => {
    amb = await criarAmbiente()
    adm = amb.com(await amb.entrar())
    pessoas = []
    for (let i = 0; i < 30; i++) pessoas.push((await adm.post('/api/pessoas').send(militar({ nip: `CONC${String(i).padStart(3, '0')}` })).expect(201)).body)
  })
  after(() => amb.fechar())

  it('30 processos abertos ao mesmo tempo têm 30 números diferentes', async () => {
    const r = await Promise.all(pessoas.map((p) => adm.put(`/api/processos/${p.id}`).send({ estado: 'activo' })))
    assert.deepEqual(r.map((x) => x.status), r.map(() => 200))
    const numeros = r.map((x) => x.body.numero)
    assert.equal(new Set(numeros).size, 30)
    assert.deepEqual([...numeros].sort(), Array.from({ length: 30 }, (_, i) => `PI-${String(i + 1).padStart(5, '0')}`))
  })

  it('30 declarações ao mesmo tempo: números seguidos e cada uma com o seu protocolo no expediente', async () => {
    const r = await Promise.all(pessoas.map((p) => adm.post(`/api/pessoas/${p.id}/documentos-emitidos`).send({ documentos: [{ tipo: 'declaracao_efectividade', dados: { finalidade: 'Banco' } }] })))
    assert.deepEqual(r.map((x) => x.status), r.map(() => 201))
    assert.deepEqual(r.map((x) => x.body[0].numero).sort((a, b) => a - b), Array.from({ length: 30 }, (_, i) => i + 1))
    const protocolos = await amb.contentor.base.expediente.findMany({ select: { protocolo: true } })
    assert.equal(new Set(protocolos.map((x) => x.protocolo)).size, 30)
  })

  it('dois cliques na mesma declaração ao mesmo tempo: sai uma só', async () => {
    const p = pessoas[0]
    const pedido = () => adm.post(`/api/pessoas/${p.id}/documentos-emitidos`).send({ documentos: [{ tipo: 'declaracao_efectividade', dados: { finalidade: 'Visto' } }] })
    const r = await Promise.all([pedido(), pedido()])
    assert.deepEqual(r.map((x) => x.status).sort(), [201, 409])
  })

  it('sem ligação livre à base de dados responde «ocupado» (503), não erro interno', () => {
    assert.ok(eSobrecarga(new Error('timeout exceeded when trying to connect')))
    assert.ok(eSobrecarga({ message: 'falhou', cause: { code: '53300', message: 'sorry, too many clients already' } }))
    assert.ok(!eSobrecarga(new Error('outra coisa')))
  })
})
