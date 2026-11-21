import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { criarAmbiente } from '../apoio/ambiente.js'

// O meu perfil no painel: nome, telefone, cargo e fotografia (a anterior apaga-se); as contas do Pessoal não mudam o nome
describe('O meu perfil (painel)', () => {
  let amb, adm
  before(async () => {
    amb = await criarAmbiente()
    adm = amb.com(await amb.entrar())
  })
  after(() => amb.fechar())

  it('muda o nome, o telefone e o cargo; recusa um telefone com letras', async () => {
    const r = (await adm.put('/api/admin/eu/perfil').send({ nome: 'Administrador do Sistema', telefone: '+244 923 000 000', cargo: 'Chefe do CPD' }).expect(200)).body
    assert.deepEqual([r.nome, r.telefone, r.cargo], ['Administrador do Sistema', '+244 923 000 000', 'Chefe do CPD'])
    assert.equal((await adm.put('/api/admin/eu/perfil').send({ telefone: 'liga-me' })).status, 400)
    assert.equal((await adm.get('/api/admin/eu').expect(200)).body.cargo, 'Chefe do CPD')
  })

  it('fotografia: põe-se (só imagem verdadeira), troca-se (a antiga apaga-se) e tira-se', async () => {
    const png = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#a3291a' } }).png().toBuffer()
    const a = (await adm.post('/api/admin/eu/foto').attach('foto', png, { filename: 'eu.png', contentType: 'image/png' }).expect(200)).body
    assert.match(a.foto, /^\/uploads\//)
    const caminhoA = amb.contentor.armazenamento.caminhoDeUrl(a.foto)
    const fs = await import('node:fs')
    assert.ok(fs.existsSync(caminhoA))
    const b = (await adm.post('/api/admin/eu/foto').attach('foto', png, { filename: 'outra.png', contentType: 'image/png' }).expect(200)).body
    assert.notEqual(b.foto, a.foto)
    assert.ok(!fs.existsSync(caminhoA))
    // um ficheiro que diz ser imagem mas não é
    assert.equal((await adm.post('/api/admin/eu/foto').attach('foto', Buffer.from('não sou imagem'), { filename: 'x.png', contentType: 'image/png' })).status, 400)
    const c = (await adm.delete('/api/admin/eu/foto').expect(200)).body
    assert.equal(c.foto, null)
    assert.ok(!fs.existsSync(amb.contentor.armazenamento.caminhoDeUrl(b.foto)))
  })

  it('conta que vem do Pessoal: o nome não se muda no painel', async () => {
    const u = await amb.contentor.prisma.utilizador.findFirst({ where: { papel: 'administrador' } })
    await amb.contentor.prisma.utilizador.update({ where: { id: u.id }, data: { pessoalRef: 'pessoal-9' } })
    const r = await adm.put('/api/admin/eu/perfil').send({ nome: 'Outro Nome' })
    assert.equal(r.status, 400)
    assert.match(r.body.erro, /Pessoal/)
    assert.equal((await adm.get('/api/admin/eu')).body.doPessoal, true)
    await amb.contentor.prisma.utilizador.update({ where: { id: u.id }, data: { pessoalRef: null } })
  })
})
