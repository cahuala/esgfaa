import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ADMIN, criarAmbiente } from '../apoio/ambiente.js'
import { codigoEm } from '../../src/dominio/totp.js'

const HOJE = '2026-10-17T10:00:00Z'

describe('Pessoal: verificação em dois passos', () => {
  let amb
  before(async () => { amb = await criarAmbiente({ hoje: HOJE, env: { DOIS_FATORES_PAPEIS: 'administrador' } }) })
  after(() => amb.fechar())

  it('exigida ao administrador: sem ela só o perfil; liga-se com o QR e o código; ao entrar pede o código', async () => {
    const t = await amb.entrar()
    const adm = amb.com(t)
    assert.equal((await adm.get('/api/eu').expect(200)).body.deveAtivar2fa, true)
    const bloqueado = await adm.get('/api/pessoas')
    assert.deepEqual([bloqueado.status, bloqueado.body.codigo], [403, 'ativar_2fa'])
    const { segredo, url } = (await adm.post('/api/eu/2fa/iniciar').expect(200)).body
    assert.match(url, /^otpauth:\/\/totp\//)
    const { codigos } = (await adm.post('/api/eu/2fa/confirmar').send({ codigo: codigoEm(segredo, new Date(HOJE)) }).expect(200)).body
    assert.equal(codigos.length, 8)
    await adm.get('/api/pessoas').expect(200)
    // o segredo fica cifrado
    assert.match((await amb.contentor.base.doisFatores.findFirst()).segredo, /^c1:/)

    const sem = await amb.http().post('/api/entrar').send({ email: ADMIN.email, senha: ADMIN.senha })
    assert.deepEqual([sem.status, sem.body.codigo, sem.body.token], [401, 'codigo_2fa', undefined])
    assert.equal((await amb.http().post('/api/entrar').send({ email: ADMIN.email, senha: ADMIN.senha, codigo: '000000' })).body.codigo, 'codigo_2fa')
    const seguinte = codigoEm(segredo, new Date(new Date(HOJE).getTime() + 30_000)) // o intervalo seguinte
    assert.ok((await amb.http().post('/api/entrar').send({ email: ADMIN.email, senha: ADMIN.senha, codigo: seguinte }).expect(200)).body.token)
    assert.equal((await amb.http().post('/api/entrar').send({ email: ADMIN.email, senha: ADMIN.senha, codigo: seguinte })).status, 401) // não se repete
    await amb.http().post('/api/entrar').send({ email: ADMIN.email, senha: ADMIN.senha, codigo: codigos[0] }).expect(200)
    assert.equal((await amb.http().post('/api/entrar').send({ email: ADMIN.email, senha: ADMIN.senha, codigo: codigos[0] })).status, 401)
    // o administrador não a desliga
    assert.equal((await adm.post('/api/eu/2fa/desligar').send({ senha: ADMIN.senha, codigo: codigos[1] })).status, 400)
  })
})
