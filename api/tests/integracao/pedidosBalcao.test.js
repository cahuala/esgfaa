import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente } from '../apoio/ambiente.js'

// a Administração Escolar regista um pedido de documento em nome do estudante (feito ao balcão ou por ofício)
describe('Pedidos de documentos registados pela Repartição', () => {
  let amb, rae, est
  before(async () => {
    amb = await criarAmbiente()
    const tudo = amb.com((await amb.criarUtilizador('administrador')).token)
    rae = amb.com((await amb.criarUtilizador('secretaria')).token)
    await amb.com(await amb.entrar()).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Estado-Maior' })
    const t = (await tudo.post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM 1' })).body
    est = (await amb.registarEMatricular(tudo, t.id, { nome: 'Estudante Pedido Balcao', email: 'pedido.balcao@esgfaa.gov.ao' })).body
  })
  after(() => amb.fechar())

  it('os tipos, o pedido em nome do estudante e a lista; quem só vê não regista', async () => {
    const tipos = (await rae.get('/api/admin/academico/pedidos/tipos').expect(200)).body
    assert.ok(tipos.includes('Declaração de matrícula'))
    const p = (await rae.post('/api/admin/academico/pedidos').send({ estudanteId: est.id, tipo: 'Declaração de matrícula', motivo: 'Pedido ao balcão' }).expect(201)).body
    assert.equal(p.tipo, 'Declaração de matrícula')
    assert.ok((await rae.get('/api/admin/academico/pedidos').expect(200)).body.some((x) => x.id === p.id && x.estudante.nome === 'Estudante Pedido Balcao'))
    assert.equal((await rae.post('/api/admin/academico/pedidos').send({ estudanteId: est.id, tipo: 'Inventado' })).status, 400)
    const ve = amb.com((await amb.criarUtilizador('director_ensino')).token)
    assert.equal((await ve.post('/api/admin/academico/pedidos').send({ estudanteId: est.id, tipo: 'Declaração de matrícula' })).status, 403)
  })
})
