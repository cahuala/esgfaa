import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { ADMIN, criarAmbiente, relogioFalso } from '../apoio/ambiente.js'
import { codigoEm, hotp, verificarCodigo, base32, deBase32 } from '../../src/dominio/identidade/totp.js'

describe('TOTP (RFC 6238)', () => {
  it('vectores de teste do RFC 6238 (SHA-1, 8 algarismos) e base32', () => {
    const segredo = Buffer.from('12345678901234567890')
    for (const [t, esperado] of [[59, '94287082'], [1111111109, '07081804'], [1111111111, '14050471'], [1234567890, '89005924'], [2000000000, '69279037']]) {
      assert.equal(hotp(segredo, Math.floor(t / 30), 8), esperado, String(t))
    }
    assert.equal(base32(Buffer.from('foobar')), 'MZXW6YTBOI')
    assert.equal(deBase32('MZXW6YTBOI').toString(), 'foobar')
  })

  it('aceita o intervalo vizinho (relógio desacertado) e nunca o mesmo intervalo duas vezes', () => {
    const s = base32(Buffer.from('segredo-de-teste-123'))
    const t = new Date('2026-10-10T12:00:00Z')
    const c = codigoEm(s, t)
    const k = verificarCodigo(s, c, t)
    assert.ok(k > 0)
    assert.equal(verificarCodigo(s, c, new Date(t.getTime() + 30_000)), k) // 30 s depois ainda serve
    assert.equal(verificarCodigo(s, c, t, { ultimo: k }), null) // já usado
    assert.equal(verificarCodigo(s, c, new Date(t.getTime() + 120_000)), null) // fora do prazo
    assert.equal(verificarCodigo(s, '12345', t), null)
  })
})

describe('Painel: verificação em dois passos', () => {
  let amb, relogio
  before(async () => {
    relogio = relogioFalso()
    amb = await criarAmbiente({ relogio, env: { DOIS_FATORES_PAPEIS: 'administrador' } })
  })
  after(() => amb.fechar())
  const passo = () => relogio.avancar(1) // um código novo (intervalo seguinte)
  const entrar = (extra = {}) => amb.http().post('/api/admin/entrar').send({ ...ADMIN, ...extra })

  let segredo, codigos
  it('papel que a exige: sem a ligar, o painel só deixa o perfil (403 ativar_2fa)', async () => {
    const t = (await entrar().expect(200)).body.token
    const eu = (await amb.com(t).get('/api/admin/eu').expect(200)).body
    assert.deepEqual([eu.doisFatores, eu.deveAtivar2fa], [false, true])
    const r = await amb.com(t).get('/api/admin/utilizadores')
    assert.equal(r.status, 403)
    assert.equal(r.body.codigo, 'ativar_2fa')
    // ligar: segredo + QR, e o primeiro código certo confirma
    const i = (await amb.com(t).post('/api/admin/eu/2fa/iniciar').expect(200)).body
    segredo = i.segredo
    assert.match(i.url, /^otpauth:\/\/totp\/.+secret=[A-Z2-7]+&issuer=/)
    assert.equal((await amb.com(t).post('/api/admin/eu/2fa/confirmar').send({ codigo: '000000' })).status, 400)
    const c = (await amb.com(t).post('/api/admin/eu/2fa/confirmar').send({ codigo: codigoEm(segredo, relogio.agora()) }).expect(200)).body
    codigos = c.codigos
    assert.equal(codigos.length, 8)
    await amb.com(t).get('/api/admin/utilizadores').expect(200)
    // o segredo fica cifrado na base de dados
    const bruto = await amb.contentor.prismaBase.doisFatores.findFirst()
    assert.match(bruto.segredo, /^c1:/)
    assert.ok(!bruto.recuperacao.includes(codigos[0])) // só os resumos
  })

  it('ao entrar: sem código pede-o; código errado recusa; código certo entra; o mesmo código não serve duas vezes', async () => {
    passo()
    const sem = await entrar()
    assert.equal(sem.status, 401)
    assert.equal(sem.body.codigo, 'codigo_2fa')
    assert.equal(sem.body.token, undefined)
    assert.equal((await entrar({ codigo: '123456' })).body.codigo, 'codigo_2fa')
    const c = codigoEm(segredo, relogio.agora())
    assert.ok((await entrar({ codigo: c }).expect(200)).body.token)
    assert.equal((await entrar({ codigo: c })).status, 401) // repetido
  })

  it('código de recuperação: serve uma vez', async () => {
    passo()
    await entrar({ codigo: codigos[0] }).expect(200)
    assert.equal((await entrar({ codigo: codigos[0] })).status, 401)
    const t = (await entrar({ codigo: codigos[1] }).expect(200)).body.token
    assert.equal((await amb.com(t).get('/api/admin/eu/2fa').expect(200)).body.codigosRestantes, 6)
  })

  it('o administrador não a pode desligar (o papel exige-a); outro administrador pode repô-la a quem perdeu o telemóvel', async () => {
    passo()
    const t = (await entrar({ codigo: codigoEm(segredo, relogio.agora()) }).expect(200)).body.token
    passo()
    const d = await amb.com(t).post('/api/admin/eu/2fa/desligar').send({ senha: ADMIN.senha, codigo: codigoEm(segredo, relogio.agora()) })
    assert.equal(d.status, 400)
    assert.match(d.body.erro, /exige/)
    const eu = (await amb.com(t).get('/api/admin/eu')).body
    await amb.com(t).post(`/api/admin/utilizadores/${eu.id}/2fa/repor`).expect(200)
    await entrar().expect(200) // sem código (terá de a ligar de novo)
  })
})
