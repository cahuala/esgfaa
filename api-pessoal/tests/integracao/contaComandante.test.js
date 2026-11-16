import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, militar } from '../apoio/ambiente.js'

/*
  O militar posto no cargo de Comandante (quadro orgânico) tem logo conta de Comandante: entra com o NIP e a
  palavra-passe inicial é o NIP. Quem sai do cargo deixa de ser Comandante.
*/
describe('Conta do Comandante pelo cargo do quadro orgânico', () => {
  let amb, adm, cargo, unidade
  before(async () => {
    amb = await criarAmbiente()
    adm = amb.com(await amb.entrar())
    unidade = (await adm.post('/api/unidades').send({ nome: 'Comando' }).expect(201)).body
    cargo = (await adm.post('/api/cargos').send({ nome: 'Comandante da Escola Superior de Guerra', unidadeId: unidade.id, funcao: 'comando', tipo: 'militar', postoRequerido: 'general', vagas: 1 }).expect(201)).body
  })
  after(() => amb.fechar())

  const entrar = (email, senha) => amb.http().post('/api/entrar').send({ email, senha })

  it('posto no cargo pela ficha: conta criada, entra com o NIP e a palavra-passe é o NIP (muda-a logo)', async () => {
    const a = (await adm.post('/api/pessoas').send(militar({ nome: 'General Primeiro Teste', nip: 'NIPCMD1', posto: 'general' })).expect(201)).body
    const r = await adm.put(`/api/pessoas/${a.id}`).send({ cargoId: cargo.id })
    assert.equal(r.status, 200, r.body.erro)
    const c = await amb.contentor.bd.utilizador.findFirst({ where: { pessoaId: a.id } })
    assert.deepEqual([c.papel, c.ativo, c.aguardaDespacho, c.deveMudar], ['comandante', true, false, true])
    const e = await entrar('NIPCMD1', 'NIPCMD1')
    assert.equal(e.status, 200, e.body.erro)
    assert.equal(e.body.utilizador.papel, 'comandante')
    // não se repete
    assert.equal((await amb.contentor.servicos.sessao.garantirContaDoComandante()).estado, 'ok')
  })

  it('um novo Comandante (já com conta de utente) passa a Comandante; o anterior deixa de o ser', async () => {
    const a = await amb.contentor.bd.pessoa.findFirst({ where: { nip: 'NIPCMD1' } })
    const b = (await adm.post('/api/pessoas').send(militar({ nome: 'General Segundo Teste', nip: 'NIPCMD2', posto: 'general' })).expect(201)).body
    const conta = (await adm.post('/api/utilizadores').send({ pessoaId: b.id, papel: 'utente' }).expect(201)).body
    await amb.contentor.bd.pessoa.update({ where: { id: a.id }, data: { cargoId: null } })
    await amb.contentor.bd.pessoa.update({ where: { id: b.id }, data: { cargoId: cargo.id, dataCargo: new Date() } })
    // o extracto ou a importação mudam o cargo sem passar pela ficha: apanha-se de minuto a minuto
    const r = await amb.contentor.servicos.sessao.garantirContaDoComandante()
    assert.deepEqual([r.estado, r.utilizadorId, r.saidas], ['promovida', conta.id, 1])
    assert.equal((await amb.contentor.bd.utilizador.findUnique({ where: { id: conta.id } })).papel, 'comandante')
    assert.equal((await amb.contentor.bd.utilizador.findFirst({ where: { pessoaId: a.id } })).papel, 'utente')
  })

  it('cargo vago: a conta de Comandante feita à mão fica como está', async () => {
    await amb.contentor.bd.pessoa.updateMany({ where: { cargoId: cargo.id }, data: { cargoId: null } })
    assert.deepEqual(await amb.contentor.servicos.sessao.garantirContaDoComandante(), { estado: 'vago', saidas: 0 })
    assert.equal((await amb.contentor.bd.utilizador.findFirst({ where: { pessoa: { nip: 'NIPCMD2' } } })).papel, 'comandante')
  })
})
