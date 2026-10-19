import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, militar } from '../apoio/ambiente.js'

describe('Documentos pessoais emitidos (declarações numeradas, guias, fichas) e assinaturas', () => {
  let amb, adm, p
  before(async () => {
    amb = await criarAmbiente()
    adm = amb.com(await amb.entrar())
    p = (await adm.post('/api/pessoas').send(militar({ nip: 'DOC001', vencimento: 410945.74, conjuge: 'Ana Kiala', agregado: [{ nome: 'Pedro Kiala', parentesco: 'Filho', dataNascimento: '2012-05-01' }], grupoSanguineo: 'O+', bairro: 'Talatona' })).expect(201)).body
  })
  after(() => amb.fechar())

  it('a ficha guarda os campos novos (agregado, vencimento cifrados) e devolve-os', async () => {
    const f = (await adm.get(`/api/pessoas/${p.id}`)).body
    assert.equal(f.vencimento, 410945.74)
    assert.deepEqual(f.agregado.map((a) => a.nome), ['Pedro Kiala'])
    assert.deepEqual([f.conjuge, f.grupoSanguineo, f.bairro], ['Ana Kiala', 'O+', 'Talatona'])
    const bruto = await amb.contentor.base.pessoa.findUnique({ where: { id: p.id }, select: { vencimento: true, agregado: true, conjuge: true } })
    for (const k of ['vencimento', 'agregado', 'conjuge']) assert.match(bruto[k], /^c1:/, k)
    assert.equal((await adm.post('/api/pessoas').send(militar({ nip: 'DOC002', grupoSanguineo: 'Z+' }))).status, 400)
  })

  it('as declarações têm número seguido por ano (série única); guias e fichas não', async () => {
    const r = (await adm.post(`/api/pessoas/${p.id}/documentos-emitidos`).send({ documentos: [
      { tipo: 'declaracao_efectividade', dados: { finalidade: 'Actualização de Conta Bancária' } },
      { tipo: 'guia_ferias', dados: { dias: 30, inicio: '2026-11-02' } },
      { tipo: 'declaracao_salario', dados: { valor: 410945.74 } },
      { tipo: 'ficha_individual' },
    ] }).expect(201)).body
    assert.deepEqual(r.map((x) => [x.tipo, x.numero]), [['declaracao_efectividade', 1], ['guia_ferias', null], ['declaracao_salario', 2], ['ficha_individual', null]])
    const r2 = (await adm.post(`/api/pessoas/${p.id}/documentos-emitidos`).send({ documentos: [{ tipo: 'declaracao_efectividade' }] }).expect(201)).body
    assert.equal(r2[0].numero, 3)
    const h = (await adm.get(`/api/pessoas/${p.id}/documentos-emitidos`).expect(200)).body
    assert.equal(h.length, 5)
    assert.equal(h.find((x) => x.tipo === 'guia_ferias').dados.dias, 30)
    assert.equal((await adm.post(`/api/pessoas/${p.id}/documentos-emitidos`).send({ documentos: [{ tipo: 'inventado' }] })).status, 400)
  })

  it('as assinaturas definem-se uma vez (só o administrador)', async () => {
    const vazio = (await adm.get('/api/definicoes/assinaturas').expect(200)).body
    assert.equal(vazio.comandante.cargo, 'O COMANDANTE DA ESG')
    const novo = { comandante: { cargo: 'O COMANDANTE DA ESG', nome: 'Nome Fictício do Comandante', posto: 'Tenente General' }, chefeRpq: { cargo: 'O CHEFE DA REPARTIÇÃO DE PESSOAL E QUADROS', nome: 'Nome do Chefe', posto: 'Coronel' }, local: 'Luanda' }
    assert.deepEqual((await adm.put('/api/definicoes/assinaturas').send(novo).expect(200)).body.comandante, novo.comandante)
  })
})
