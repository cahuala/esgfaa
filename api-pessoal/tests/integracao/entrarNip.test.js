import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, militar } from '../apoio/ambiente.js'

describe('os militares entram com o NIP (e a palavra-passe inicial é o NIP)', () => {
  let amb, adm, rpq
  before(async () => {
    amb = await criarAmbiente()
    adm = amb.com(await amb.entrar())
    rpq = (await adm.post('/api/unidades').send({ nome: 'Repartição de Pessoal e Quadros' }).expect(201)).body
  })
  after(() => amb.fechar())

  it('conta ligada a um militar da Repartição: entra com o NIP, tem de mudar a palavra-passe e não pode ficar com o NIP', async () => {
    const p = (await adm.post('/api/pessoas').send(militar({ nip: 'RPQ0042', nome: 'Joana Maria Tchissola', unidadeId: rpq.id })).expect(201)).body
    const c = (await adm.post('/api/utilizadores').send({ pessoaId: p.id, papel: 'operador' }).expect(201)).body
    assert.equal(c.nome, 'Joana Maria Tchissola')
    assert.equal(c.unidadeId, rpq.id)
    assert.equal(c.deveMudar, true)
    // a mesma pessoa não tem duas contas
    assert.equal((await adm.post('/api/utilizadores').send({ pessoaId: p.id, papel: 'consulta' })).status, 409)
    // a conta de operador só entra depois do despacho do Comandante
    await amb.deferirTudo()
    assert.equal((await amb.http().post('/api/entrar').send({ email: 'RPQ0042', senha: 'errada123x' })).status, 401)
    const t = await amb.entrar('RPQ0042', 'RPQ0042')
    // antes de mudar a palavra-passe, só pode mudá-la
    assert.equal((await amb.com(t).get('/api/pessoas')).status, 403)
    assert.equal((await amb.com(t).post('/api/mudar-senha').send({ atual: 'RPQ0042', nova: 'rpq0042' })).status, 400)
    const nova = (await amb.com(t).post('/api/mudar-senha').send({ atual: 'RPQ0042', nova: 'Quadros2026seguro' }).expect(200)).body
    assert.equal(nova.utilizador.deveMudar, false)
    // o NIP já não serve de palavra-passe
    assert.equal((await amb.http().post('/api/entrar').send({ email: 'RPQ0042', senha: 'RPQ0042' })).status, 401)
    await amb.entrar('rpq0042', 'Quadros2026seguro')
    // o administrador repõe: volta ao NIP e tem de mudar outra vez
    const lista = (await adm.get('/api/utilizadores').expect(200)).body
    assert.equal(lista.find((x) => x.id === c.id).nip, 'RPQ0042')
    await adm.put(`/api/utilizadores/${c.id}`).send({ reporNip: true }).expect(200)
    const t2 = await amb.entrar('RPQ0042', 'RPQ0042')
    assert.equal((await amb.com(t2).get('/api/eu')).body.deveMudar, true)
  })

  it('«Criar contas para todos»: o militar fica com o NIP; o civil, com uma palavra-passe gerada', async () => {
    await adm.post('/api/pessoas').send(militar({ nip: 'RPQ0077', nome: 'Paulo Domingos Ngola', unidadeId: rpq.id })).expect(201)
    const contas = (await adm.post('/api/utilizadores/contas-pessoas').send({}).expect(200)).body
    assert.equal(contas.find((x) => x.identificacao === 'RPQ0077').senha, 'RPQ0077')
    await amb.entrar('RPQ0077', 'RPQ0077')
    // só a conta de um militar volta ao NIP
    const admin = (await adm.get('/api/utilizadores').expect(200)).body.find((x) => x.email === 'admin@pessoal.ao')
    assert.equal(admin.nip, null)
    assert.equal((await adm.put(`/api/utilizadores/${admin.id}`).send({ reporNip: true })).status, 400)
  })
})
