import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, militar } from '../apoio/ambiente.js'
import { CifraDados, cifrarExistentes } from '../../src/infraestrutura/cifraDados.js'

describe('Dados pessoais cifrados na base de dados (AES-256-GCM)', () => {
  let amb, adm
  before(async () => {
    amb = await criarAmbiente()
    adm = amb.com(await amb.entrar())
  })
  after(() => amb.fechar())

  const emBruto = (id) => amb.contentor.base.pessoa.findUnique({ where: { id }, select: { bi: true, biIndice: true, pai: true, mae: true, telefone: true, morada: true, nome: true } })

  it('na base de dados só fica o cifrado; a API devolve o texto', async () => {
    const p = (await adm.post('/api/pessoas').send(militar({ nip: 'CIF001', bi: '001234567LA041', pai: 'Pedro Kiala', mae: 'Ana Santos', telefone: '+244 923 000 111', morada: 'Talatona, Luanda' })).expect(201)).body
    assert.deepEqual([p.bi, p.pai, p.telefone, p.morada], ['001234567LA041', 'Pedro Kiala', '+244 923 000 111', 'Talatona, Luanda'])
    assert.equal(p.biIndice, undefined) // o índice não sai do servidor
    const b = await emBruto(p.id)
    for (const c of ['bi', 'pai', 'mae', 'telefone', 'morada']) {
      assert.match(b[c], /^c1:[A-Za-z0-9+/=]+$/, c)
      assert.ok(!b[c].includes('Kiala') && !b[c].includes('001234567'), c)
    }
    assert.match(b.biIndice, /^[0-9a-f]{64}$/)
    assert.equal(b.nome, 'António Manuel Kiala') // o nome não é cifrado (lista, pesquisa e ordenação)
    // a ficha completa e as listas
    assert.equal((await adm.get(`/api/pessoas/${p.id}`)).body.telefone, '+244 923 000 111')
    assert.equal((await adm.get('/api/pessoas')).body.find((x) => x.id === p.id).bi, '001234567LA041')
  })

  it('o mesmo BI não se repete (pelo índice), mesmo escrito com espaços ou minúsculas', async () => {
    await adm.post('/api/pessoas').send(militar({ nip: 'CIF002', bi: '009999999LA011' })).expect(201)
    const r = await adm.post('/api/pessoas').send(militar({ nip: 'CIF003', bi: '009999999la011' }))
    assert.equal(r.status, 409)
    assert.match(r.body.erro, /bilhete de identidade/)
  })

  it('decifra também quando a pessoa vem dentro de outro registo (domiciliares do oficial)', async () => {
    const cor = (await adm.post('/api/pessoas').send(militar({ nip: 'CIF004', posto: 'coronel' })).expect(201)).body
    await adm.post('/api/pessoas').send({ tipo: 'civil', vinculo: 'domiciliar', nome: 'Domingas Ventura Bumba', genero: 'F', numeroAgente: 'DC1', militarAlocadoId: cor.id, telefone: '+244 931 222 333', bi: '004444444LA044' }).expect(201)
    const l = (await adm.get('/api/domiciliares')).body
    const o = (Array.isArray(l) ? l : l.oficiais ?? []).find((x) => x.id === cor.id)
    const d = o.domiciliares[0]
    assert.deepEqual([d.telefone, d.bi], ['+244 931 222 333', '004444444LA044'])
  })

  it('cifra as fichas antigas em texto e não volta a cifrar as que já estão', async () => {
    const p = (await adm.post('/api/pessoas').send(militar({ nip: 'CIF005' })).expect(201)).body
    await amb.contentor.base.pessoa.update({ where: { id: p.id }, data: { bi: '007777777LA077', telefone: '+244 900 000 000', biIndice: null } })
    const n = await cifrarExistentes(amb.contentor.base, amb.contentor.cifraDados)
    assert.ok(n >= 1)
    const b = await emBruto(p.id)
    assert.ok(CifraDados.cifrado(b.bi) && CifraDados.cifrado(b.telefone))
    assert.equal(b.biIndice, amb.contentor.cifraDados.indice('007777777LA077'))
    assert.equal(await cifrarExistentes(amb.contentor.base, amb.contentor.cifraDados), 0)
    assert.equal((await adm.get(`/api/pessoas/${p.id}`)).body.bi, '007777777LA077')
  })

  it('outra chave não decifra, e um cifrado alterado é recusado', () => {
    const a = new CifraDados('a'.repeat(64))
    const b = new CifraDados('b'.repeat(64))
    const c = a.cifrar('001234567LA041')
    assert.notEqual(c, a.cifrar('001234567LA041')) // iv aleatório
    assert.equal(a.decifrar(c), '001234567LA041')
    assert.throws(() => b.decifrar(c))
    const mexido = `${c.slice(0, -4)}${c.slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA'}`
    assert.throws(() => a.decifrar(mexido))
    assert.throws(() => new CifraDados('curta'), /32 bytes/)
  })
})
