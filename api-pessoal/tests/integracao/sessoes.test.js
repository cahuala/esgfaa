import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, ADMIN } from '../apoio/ambiente.js'

const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36'
const FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0'

describe('sessões: inactividade, outro navegador, terminar uma a uma', () => {
  let amb
  before(async () => { amb = await criarAmbiente() })
  after(() => amb.fechar())

  const entrarCom = async (ua) => (await amb.http().post('/api/entrar').set('User-Agent', ua).send({ email: ADMIN.email, senha: ADMIN.senha }).expect(200)).body.token
  const pedir = (token, ua, metodo = 'get', url = '/api/eu') => amb.http()[metodo](url).set('Authorization', `Bearer ${token}`).set('User-Agent', ua)

  it('o token copiado para outro navegador não serve, e a sessão fica terminada', async () => {
    const t = await entrarCom(CHROME)
    await pedir(t, CHROME).expect(200)
    const r = await pedir(t, FIREFOX)
    assert.equal(r.status, 401)
    // nem o navegador original a recupera: tem de entrar de novo
    assert.equal((await pedir(t, CHROME)).status, 401)
    const aud = (await amb.com(await amb.entrar()).get('/api/auditoria')).body
    assert.ok(JSON.stringify(aud).includes('sessao_recusada'))
  })

  it('termina ao fim do tempo sem uso', async () => {
    const t = await entrarCom(CHROME)
    await pedir(t, CHROME).expect(200)
    // 31 minutos depois do último uso
    const s = await amb.contentor.bd.sessao.findMany()
    for (const x of s) await amb.contentor.bd.sessao.update({ where: { id: x.id }, data: { usadaEm: new Date(x.usadaEm.getTime() - 31 * 60_000) } })
    const r = await pedir(t, CHROME)
    assert.equal(r.status, 401)
    assert.match(r.body.erro, /sem uso/)
  })

  it('lista as sessões abertas, termina as outras e sair só fecha esta', async () => {
    const a = await entrarCom(CHROME)
    const b = await entrarCom(FIREFOX)
    const l = (await pedir(a, CHROME, 'get', '/api/eu/sessoes').expect(200)).body
    assert.equal(l.length, 2)
    assert.deepEqual(l.map((x) => x.navegador).sort(), ['Chrome no Windows', 'Firefox no Linux'])
    assert.equal(l.find((x) => x.atual).navegador, 'Chrome no Windows')
    assert.ok((await pedir(a, CHROME, 'post', '/api/eu/sessoes/terminar-outras').expect(200)).body.terminadas >= 1)
    assert.equal((await pedir(b, FIREFOX)).status, 401)
    await pedir(a, CHROME).expect(200)
    // terminar uma sessão de outra conta não é possível
    const c = await entrarCom(FIREFOX)
    const outra = (await pedir(c, FIREFOX, 'get', '/api/eu/sessoes')).body.find((x) => x.atual).id
    await pedir(a, CHROME, 'post', '/api/sair').expect(204)
    assert.equal((await pedir(a, CHROME)).status, 401)
    // a do Firefox continua aberta e termina-se a si própria pela lista
    await pedir(c, FIREFOX, 'delete', `/api/eu/sessoes/${outra}`).expect(204)
    assert.equal((await pedir(c, FIREFOX)).status, 401)
  })
})
