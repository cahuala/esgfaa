import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, militar } from '../apoio/ambiente.js'

describe('cargos civis: registar o cargo e colocar o pessoal civil', () => {
  let amb, adm, unidade, cargo, ana, rui
  before(async () => {
    amb = await criarAmbiente()
    adm = amb.com(await amb.entrar())
    unidade = (await adm.post('/api/unidades').send({ nome: 'Secretaria Civil de Teste', sigla: 'SCT', tipo: 'servico' }).expect(201)).body
    cargo = (await adm.post('/api/cargos').send({ nome: 'Técnico de Secretaria', unidadeId: unidade.id, funcao: 'execucao', tipo: 'civil', categoriaCivil: 'Técnico Médio', vagas: 1 }).expect(201)).body
    ana = (await adm.post('/api/pessoas').send({ tipo: 'civil', vinculo: 'funcionario', nome: 'Ana Civil Cargo Teste', carreiraCivil: 'tecnico_medio' }).expect(201)).body
    rui = (await adm.post('/api/pessoas').send({ tipo: 'civil', vinculo: 'funcionario', nome: 'Rui Civil Cargo Teste', carreiraCivil: 'tecnico_medio' }).expect(201)).body
  })
  after(() => amb.fechar())

  it('coloca o civil no cargo (fica na unidade do cargo e no histórico)', async () => {
    await adm.post(`/api/cargos/${cargo.id}/colocar`).send({ pessoaId: ana.id, data: '2026-10-01' }).expect(200)
    const f = (await adm.get(`/api/pessoas/${ana.id}`).expect(200)).body
    assert.deepEqual([f.cargoId, f.unidadeId], [cargo.id, unidade.id])
    assert.ok(f.eventos.some((e) => e.tipo === 'nomeacao' && /Técnico de Secretaria/.test(e.descricao)))
    const d = (await adm.get(`/api/organica/${unidade.id}`).expect(200)).body
    const c = d.cargos.find((x) => x.id === cargo.id)
    assert.deepEqual([c.ocupados, c.postoRequeridoNome], [1, 'Técnico Médio'])
  })

  it('sem lugar livre, recusa; militares e cargos de militares não passam por aqui', async () => {
    await adm.post(`/api/cargos/${cargo.id}/colocar`).send({ pessoaId: rui.id }).expect(409)
    const m = (await adm.post('/api/pessoas').send(militar({ nip: 'NIP6601' })).expect(201)).body
    await adm.post(`/api/cargos/${cargo.id}/colocar`).send({ pessoaId: m.id }).expect(400)
    const cm = (await adm.post('/api/cargos').send({ nome: 'Chefe Militar Teste', unidadeId: unidade.id, funcao: 'direccao_chefia', tipo: 'militar', postoRequerido: 'major', vagas: 1 }).expect(201)).body
    await adm.post(`/api/cargos/${cm.id}/colocar`).send({ pessoaId: rui.id }).expect(400)
  })

  it('retira do cargo (o lugar fica livre para outro)', async () => {
    await adm.post(`/api/cargos/${cargo.id}/retirar`).send({ pessoaId: ana.id }).expect(200)
    assert.equal((await adm.get(`/api/pessoas/${ana.id}`)).body.cargoId, null)
    await adm.post(`/api/cargos/${cargo.id}/colocar`).send({ pessoaId: rui.id }).expect(200)
    await adm.post(`/api/cargos/${cargo.id}/retirar`).send({ pessoaId: ana.id }).expect(404)
  })
})
