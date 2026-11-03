import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente } from '../apoio/ambiente.js'

describe('o Comandante escolhe o que cada conta do painel pode fazer', () => {
  let amb, admin, cmd, redator
  before(async () => {
    amb = await criarAmbiente()
    admin = amb.com(await amb.entrar())
    cmd = await amb.oComandante()
    redator = await amb.criarUtilizador('redator')
  })
  after(() => amb.fechar())

  it('o redator não vê a biblioteca; o Comandante dá-lha e tira-lhe os eventos (vale logo)', async () => {
    const r = amb.com(redator.token)
    await r.get('/api/admin/biblioteca/obras').expect((x) => assert.equal(x.status, 403))
    const eu = (await r.get('/api/admin/eu').expect(200)).body
    const novas = [...eu.permissoes.filter((p) => !p.startsWith('eventos.')), 'biblioteca.ver', 'biblioteca.gerir']
    // o Administrador não usa este ecrã (é do Comandante)
    await admin.put(`/api/admin/utilizadores/${eu.id}/permissoes`).send({ permissoes: novas }).expect(403)
    const d = (await amb.com(cmd.token).put(`/api/admin/utilizadores/${eu.id}/permissoes`).send({ permissoes: [...novas, 'nao.existe'] }).expect(200)).body
    assert.ok(d.permissoesEfectivas.includes('biblioteca.gerir'))
    assert.ok(!d.permissoesEfectivas.includes('nao.existe'))
    const depois = (await r.get('/api/admin/eu').expect(200)).body.permissoes
    assert.ok(depois.includes('biblioteca.gerir'))
    assert.ok(!depois.some((p) => p.startsWith('eventos.')))
    // a lista mostra as próprias e as efectivas
    const l = (await amb.com(cmd.token).get('/api/admin/utilizadores').expect(200)).body.find((x) => x.id === eu.id)
    assert.ok(Array.isArray(l.permissoes) && l.permissoesEfectivas.includes('biblioteca.ver'))
  })

  it('voltar às do papel; o Comandante não tira a si próprio a escolha', async () => {
    const r = amb.com(redator.token)
    const eu = (await r.get('/api/admin/eu')).body
    await amb.com(cmd.token).put(`/api/admin/utilizadores/${eu.id}/permissoes`).send({ permissoes: null }).expect(200)
    const p = (await r.get('/api/admin/eu')).body.permissoes
    assert.ok(p.includes('eventos.ver') && !p.includes('biblioteca.gerir'))
    const c = (await amb.com(cmd.token).get('/api/admin/eu')).body
    await amb.com(cmd.token).put(`/api/admin/utilizadores/${c.id}/permissoes`).send({ permissoes: ['noticias.ver'] }).expect(400)
  })
})
