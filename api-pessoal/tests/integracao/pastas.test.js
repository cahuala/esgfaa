import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente } from '../apoio/ambiente.js'

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF')

describe('Secretária digital de cada conta: os documentos guardados por pastas', () => {
  let amb, adm, op
  before(async () => {
    amb = await criarAmbiente()
    adm = amb.com(await amb.entrar())
    await amb.criarConta(adm, { nome: 'Consulta Pastas', email: 'consulta.pastas@pessoal.ao', papel: 'consulta', senha: 'Inicial2026x' })
    const t = await amb.entrar('consulta.pastas@pessoal.ao', 'Inicial2026x')
    op = amb.com((await amb.com(t).post('/api/mudar-senha').send({ atual: 'Inicial2026x', nova: 'Pastas#2026y' }).expect(200)).body.token)
  })
  after(() => amb.fechar())

  it('qualquer conta guarda, abre, muda de pasta e apaga os seus documentos', async () => {
    const d = (await op.post('/api/pastas').field('titulo', '  Ofício   n.º 120 ').field('pasta', 'Ofícios 2026').attach('ficheiro', PDF, 'oficio.pdf').expect(201)).body
    assert.deepEqual([d.titulo, d.pasta, d.nomeOriginal, d.mime, d.ficheiro], ['Ofício n.º 120', 'Ofícios 2026', 'oficio.pdf', 'application/pdf', undefined])
    // sem título fica o nome do ficheiro
    assert.equal((await op.post('/api/pastas').attach('ficheiro', PDF, 'escala.pdf').expect(201)).body.titulo, 'escala.pdf')
    // nomes com acentos chegam inteiros
    const acentos = (await op.post('/api/pastas').attach('ficheiro', PDF, 'Ofício (pág. 3-4).pdf').expect(201)).body
    assert.equal(acentos.nomeOriginal, 'Ofício (pág. 3-4).pdf')
    await op.delete(`/api/pastas/${acentos.id}`).expect(204)
    assert.equal((await op.post('/api/pastas').attach('ficheiro', Buffer.from('<html>'), 'x.html')).status, 400)
    assert.equal((await op.get('/api/pastas').expect(200)).body.length, 2)
    const f = await op.get(`/api/pastas/${d.id}/ficheiro`).expect(200)
    assert.match(f.headers['content-type'], /application\/pdf/)
    assert.equal((await op.put(`/api/pastas/${d.id}`).send({ pasta: 'Arquivo' }).expect(200)).body.pasta, 'Arquivo')
    assert.equal((await op.put(`/api/pastas/${d.id}`).send({ titulo: '  ' })).status, 400)
    await op.delete(`/api/pastas/${d.id}`).expect(204)
    assert.deepEqual((await op.get('/api/pastas')).body.map((x) => x.titulo), ['escala.pdf'])
  })

  it('os documentos de uma conta não aparecem nem abrem noutra', async () => {
    const [d] = (await op.get('/api/pastas')).body
    assert.deepEqual((await adm.get('/api/pastas').expect(200)).body, [])
    await adm.get(`/api/pastas/${d.id}/ficheiro`).expect(404)
    await adm.put(`/api/pastas/${d.id}`).send({ pasta: 'x' }).expect(404)
    await adm.delete(`/api/pastas/${d.id}`).expect(404)
  })
})
