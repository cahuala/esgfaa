import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { criarAmbiente } from '../apoio/ambiente.js'

/*
  Cópias de segurança à mão (Configurações › Cópias de segurança): o administrador faz uma cópia quando quiser e
  descarrega o ficheiro cifrado. Aqui o programa das cópias é um de ensaio (escreve um .esgc), para não precisar
  do pg_dump.
*/
describe('Cópias de segurança feitas à mão', () => {
  let amb, adm, pasta
  before(async () => {
    pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'copias-'))
    const script = path.join(pasta, 'scripts', 'copias.mjs')
    fs.mkdirSync(path.dirname(script))
    fs.writeFileSync(script, `import fs from 'node:fs'\nif (process.argv[2] !== 'copiar' || process.argv[4] !== 'pessoal') process.exit(2)\nfs.writeFileSync(process.env.COPIAS_DIR + '/esg-' + Date.now() + '.esgc', 'cifrado')\nconsole.log('Cópia feita.')\n`)
    amb = await criarAmbiente({ copias: { script, env: { ...process.env, COPIAS_DIR: pasta, COPIAS_CHAVE: 'x'.repeat(64) } } })
    adm = amb.com(await amb.entrar())
  })
  after(() => amb.fechar())

  it('faz a cópia agora, mostra-a na lista e deixa descarregá-la', async () => {
    const antes = (await adm.get('/api/copias').expect(200)).body
    assert.deepEqual([antes.disponivel, antes.copias.length], [true, 0])
    const depois = (await adm.post('/api/copias').expect(200)).body
    assert.equal(depois.copias.length, 1)
    const r = await adm.get(`/api/copias/${depois.copias[0].nome}`).expect(200)
    assert.equal(String(r.body ?? r.text).length > 0, true)
    assert.equal((await adm.get('/api/copias/..%2F..%2Fetc%2Fpasswd')).status, 400)
    assert.equal((await adm.get('/api/copias/nao-existe.esgc')).status, 404)
  })

  it('sem a COPIAS_CHAVE não se faz (e diz porquê)', async () => {
    const outro = await criarAmbiente({ copias: { script: path.join(pasta, 'scripts', 'copias.mjs'), env: { COPIAS_DIR: pasta } } })
    try {
      const a = outro.com(await outro.entrar())
      assert.equal((await a.get('/api/copias').expect(200)).body.disponivel, false)
      assert.equal((await a.post('/api/copias')).status, 409)
    } finally { await outro.fechar() }
  })
})
