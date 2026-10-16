import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente } from '../apoio/ambiente.js'

describe('tradução dos dados nos painéis: o tradutor do servidor traduz cada texto uma vez e os nomes com posto ficam', () => {
  let amb, admin
  const pedidos = []
  before(async () => {
    const tradutor = {
      nome: 'falso',
      traduzirMapa: async (mapa, lingua) => {
        pedidos.push({ lingua, textos: Object.values(mapa) })
        return Object.fromEntries(Object.entries(mapa).map(([k, v]) => [k, `[${lingua}] ${v}`]))
      },
    }
    amb = await criarAmbiente({ externos: { tradutor } })
    admin = await amb.entrar()
  })
  after(() => amb.fechar())

  it('traduz, guarda e não volta a pedir', async () => {
    const corpo = { lingua: 'en', textos: ['Bem-vindos à cadeira', 'Bem-vindos à cadeira', 'Cap.-Ten. Pedro Neto respondeu no fórum', 'Maj. João Fernandes', 'ana@esgfaa.gov.ao', '2026'] }
    const r = await amb.com(admin).post('/api/admin/traduzir').send(corpo)
    assert.equal(r.status, 200)
    assert.deepEqual(r.body.traducoes, { 'Bem-vindos à cadeira': '[en] Bem-vindos à cadeira', 'Cap.-Ten. Pedro Neto respondeu no fórum': '[en] Cap.-Ten. Pedro Neto respondeu no fórum' })
    assert.deepEqual(r.body.pendentes, [])
    // o nome nunca chegou ao tradutor
    assert.equal(pedidos.length, 1)
    assert.ok(pedidos[0].textos.every((t) => !t.includes('Pedro Neto')))
    // segunda vez: vem da memória
    const r2 = await amb.com(admin).post('/api/admin/traduzir').send(corpo)
    assert.deepEqual(r2.body.traducoes, r.body.traducoes)
    assert.equal(pedidos.length, 1)
  })

  it('só com sessão e só em en, fr ou es', async () => {
    assert.equal((await amb.http().post('/api/admin/traduzir').send({ lingua: 'en', textos: ['Olá'] })).status, 401)
    assert.equal((await amb.com(admin).post('/api/admin/traduzir').send({ lingua: 'de', textos: ['Olá'] })).status, 400)
  })
})
