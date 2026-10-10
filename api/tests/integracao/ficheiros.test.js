import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { criarAmbiente } from '../apoio/ambiente.js'

// PNG mínimo válido (1x1)
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')

const ficheirosNoDisco = (pasta) => fs.readdirSync(pasta, { recursive: true }).filter((f) => fs.statSync(path.join(pasta, f)).isFile())

describe('envio de ficheiros', () => {
  let amb, admin
  before(async () => {
    amb = await criarAmbiente()
    admin = await amb.entrar()
  })
  after(() => amb.fechar())

  it('aceita imagens e PDF verdadeiros e serve-os em /uploads', async () => {
    const r = await amb.com(admin).post('/api/admin/ficheiros')
      .attach('ficheiros', PNG, { filename: 'Fotografia à noite.png', contentType: 'image/png' })
      .attach('ficheiros', PDF, { filename: 'regulamento.pdf', contentType: 'application/pdf' })
    assert.equal(r.status, 201)
    assert.equal(r.body.length, 2)
    assert.equal(r.body[0].nome, 'Fotografia à noite.png')
    assert.match(r.body[0].url, /\/uploads\/\d{4}-\d{2}\/[0-9a-f-]{36}\.png$/)

    const caminho = new URL(r.body[0].url).pathname
    const servido = await amb.http().get(caminho)
    assert.equal(servido.status, 200)
    assert.equal(servido.headers['content-type'], 'image/png')
    assert.equal(servido.headers['cross-origin-resource-policy'], 'cross-origin')
    assert.equal(servido.headers['x-content-type-options'], 'nosniff')
  })

  it('recusa ficheiros disfarçados e apaga tudo o que foi enviado nesse pedido', async () => {
    const antes = ficheirosNoDisco(amb.pastaUploads).length
    const r = await amb.com(admin).post('/api/admin/ficheiros')
      .attach('ficheiros', PNG, { filename: 'boa.png', contentType: 'image/png' })
      .attach('ficheiros', Buffer.from('<html><script>alert(1)</script></html>'), { filename: 'foto.png', contentType: 'image/png' })
    assert.equal(r.status, 400)
    assert.match(r.body.erro, /foto\.png/)
    assert.equal(ficheirosNoDisco(amb.pastaUploads).length, antes)
  })

  it('ignora tipos não permitidos (SVG, HTML, executáveis)', async () => {
    const r = await amb.com(admin).post('/api/admin/ficheiros')
      .attach('ficheiros', Buffer.from('<svg onload="alert(1)"/>'), { filename: 'x.svg', contentType: 'image/svg+xml' })
    assert.equal(r.status, 400)
  })

  it('exige permissão e sessão', async () => {
    const analista = await amb.criarUtilizador('analista')
    const r = await amb.com(analista.token).post('/api/admin/ficheiros').attach('ficheiros', PNG, { filename: 'a.png', contentType: 'image/png' })
    assert.equal(r.status, 403)
    assert.equal((await amb.http().post('/api/admin/ficheiros').attach('ficheiros', PNG, { filename: 'a.png', contentType: 'image/png' })).status, 401)
  })

  it('respeita o tamanho máximo', async () => {
    const pequeno = await criarAmbiente({ env: { MAX_UPLOAD_MB: '1' } })
    try {
      const t = await pequeno.entrar()
      const grande = Buffer.concat([PNG, Buffer.alloc(1024 * 1024 + 10)])
      const r = await pequeno.com(t).post('/api/admin/ficheiros').attach('ficheiros', grande, { filename: 'g.png', contentType: 'image/png' })
      assert.equal(r.status, 400)
      assert.match(r.body.erro, /demasiado grande \(máximo 1 MB\)/)
      assert.equal(ficheirosNoDisco(pequeno.pastaUploads).length, 0)
    } finally {
      pequeno.fechar()
    }
  })

  it('não serve ficheiros fora da pasta de uploads', async () => {
    assert.equal((await amb.http().get('/uploads/..%2F..%2Fpackage.json')).status, 404)
    assert.equal((await amb.http().get('/uploads/.env')).status, 404)
  })
})
