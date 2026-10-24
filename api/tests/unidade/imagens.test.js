import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { LADO_MAXIMO, otimizarImagem } from '../../src/infraestrutura/ficheiros/imagens.js'

describe('imagens leves: as fotografias pesadas ficam em WebP', () => {
  let pasta
  const ficheiro = async (nome, largura, altura, formato) => {
    const caminho = path.join(pasta, nome)
    // ruído desfocado: parece uma fotografia (não se comprime sem perdas)
    const ruido = await sharp(crypto.randomBytes(largura * altura * 3), { raw: { width: largura, height: altura, channels: 3 } }).blur(1.5).png().toBuffer()
    await sharp(ruido)[formato]().toFile(caminho)
    return { caminho, tipo: `image/${formato === 'jpeg' ? 'jpeg' : formato}`, tamanho: fs.statSync(caminho).size }
  }
  before(() => { pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'esg-imagens-')) })
  after(() => fs.rmSync(pasta, { recursive: true, force: true }))

  it('um PNG grande passa a WebP, com 2000 px no máximo, e o original apaga-se', async () => {
    const f = await ficheiro('grande.png', 3000, 1800, 'png')
    const r = await otimizarImagem(f)
    assert.equal(r.tipo, 'image/webp')
    assert.match(r.caminho, /grande\.webp$/)
    assert.ok(r.tamanho < f.tamanho / 3, `${r.tamanho} não é bem menor que ${f.tamanho}`)
    const m = await sharp(r.caminho).metadata()
    assert.equal(Math.max(m.width, m.height), LADO_MAXIMO)
    assert.equal(fs.existsSync(f.caminho), false)
  })

  it('uma imagem já leve fica como está', async () => {
    const f = await ficheiro('pequena.jpg', 300, 200, 'jpeg')
    assert.deepEqual(await otimizarImagem(f), f)
    assert.ok(fs.existsSync(f.caminho))
  })

  it('se o WebP ficasse mais pesado, fica a original', async () => {
    // um desenho de poucas cores: o PNG já é pequeno
    const caminho = path.join(pasta, 'desenho.png')
    await sharp({ create: { width: 2400, height: 1600, channels: 3, background: '#cc092f' } }).png().toFile(caminho)
    const f = { caminho, tipo: 'image/png', tamanho: fs.statSync(caminho).size }
    const r = await otimizarImagem({ ...f, tamanho: 10 })
    assert.equal(r.caminho, caminho)
    assert.ok(fs.existsSync(caminho))
  })

  it('um ficheiro que diz ser imagem e não é fica como chegou (a verificação do tipo recusa-o)', async () => {
    const caminho = path.join(pasta, 'falso.png')
    fs.writeFileSync(caminho, Buffer.alloc(400 * 1024, 'x'))
    const f = { caminho, tipo: 'image/png', tamanho: 400 * 1024 }
    assert.deepEqual(await otimizarImagem(f), f)
  })

  it('GIF, PDF e vídeos não se tocam', async () => {
    const f = { caminho: path.join(pasta, 'animado.gif'), tipo: 'image/gif', tamanho: 5_000_000 }
    assert.deepEqual(await otimizarImagem(f), f)
  })
})
