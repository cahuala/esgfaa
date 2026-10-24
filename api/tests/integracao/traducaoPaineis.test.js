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
    // «cadeira» vem do glossário da Escola (o tradutor nunca o vê)
    assert.deepEqual(r.body.traducoes, { 'Bem-vindos à cadeira': '[en] Bem-vindos to the course unit', 'Cap.-Ten. Pedro Neto respondeu no fórum': '[en] Cap.-Ten. Pedro Neto respondeu no fórum' })
    assert.deepEqual(r.body.pendentes, [])
    // o nome nunca chegou ao tradutor
    assert.equal(pedidos.length, 1)
    assert.ok(pedidos[0].textos.every((t) => !t.includes('Pedro Neto')))
    // segunda vez: vem da memória
    const r2 = await amb.com(admin).post('/api/admin/traduzir').send(corpo)
    assert.deepEqual(r2.body.traducoes, r.body.traducoes)
    assert.equal(pedidos.length, 1)
  })

  it('glossário da Escola: nomes sem posto, ordinais, cursos e códigos', async () => {
    pedidos.length = 0
    const corpo = { lingua: 'fr', textos: ['Domingos Calenga · Mayamba · 2021', '32.º Curso Superior de Comando e Direcção', 'Comando', '355.41 PIN', 'CEO', 'A primeira aula é no Anfiteatro A. Tragam o programa.'] }
    const r = (await amb.com(admin).post('/api/admin/traduzir').send(corpo).expect(200)).body
    assert.equal(r.traducoes['32.º Curso Superior de Comando e Direcção'], '32e Cours supérieur de commandement et de direction')
    assert.equal(r.traducoes.Comando, 'Commandement')
    assert.equal(r.traducoes['Domingos Calenga · Mayamba · 2021'], '[fr] Domingos Calenga · Mayamba · 2021')
    // o nome, o curso e os códigos não chegam ao tradutor; «A. Tragam» não é um nome com posto
    const enviados = pedidos.flatMap((p) => p.textos)
    assert.ok(enviados.every((t) => !/Domingos|Curso|PIN|CEO|^Comando$/.test(t)), enviados.join(' | '))
    assert.ok(enviados.includes('A primeira aula é no Anfiteatro A. Tragam o programa.'))
  })

  it('revisão no painel: a correção fica e serve a todos; apagar volta a pedir ao tradutor', async () => {
    const texto = 'Aula de quarta passa para o Anfiteatro B'
    await amb.com(admin).post('/api/admin/traduzir').send({ lingua: 'es', textos: [texto] }).expect(200)
    const lista = (await amb.com(admin).get('/api/admin/traducoes/dados').query({ lingua: 'es', q: 'quarta' }).expect(200)).body
    assert.equal(lista.total, 1)
    const [x] = lista.itens
    assert.equal(x.revisto, false)
    assert.equal((await amb.com(admin).put(`/api/admin/traducoes/dados/es/${x.chave}`).send({ texto: ' ' })).status, 400)
    const c = (await amb.com(admin).put(`/api/admin/traducoes/dados/es/${x.chave}`).send({ texto: 'La clase del miércoles pasa al Anfiteatro B' }).expect(200)).body
    assert.equal(c.revisto, true)
    const antes = pedidos.length
    const r = (await amb.com(admin).post('/api/admin/traduzir').send({ lingua: 'es', textos: [texto] }).expect(200)).body
    assert.equal(r.traducoes[texto], 'La clase del miércoles pasa al Anfiteatro B')
    assert.equal(pedidos.length, antes) // vem da memória, não do tradutor
    assert.equal((await amb.com(admin).get('/api/admin/traducoes/dados').query({ lingua: 'es', revisto: 'sim' })).body.total, 1)
    await amb.com(admin).delete(`/api/admin/traducoes/dados/es/${x.chave}`).expect(204)
    await amb.com(admin).post('/api/admin/traduzir').send({ lingua: 'es', textos: [texto] }).expect(200)
    assert.equal(pedidos.length, antes + 1) // apagada: o tradutor traduz outra vez
    assert.equal((await amb.http().get('/api/admin/traducoes/dados').query({ lingua: 'es' })).status, 401)
  })

  it('só com sessão e só em en, fr ou es', async () => {
    assert.equal((await amb.http().post('/api/admin/traduzir').send({ lingua: 'en', textos: ['Olá'] })).status, 401)
    assert.equal((await amb.com(admin).post('/api/admin/traduzir').send({ lingua: 'de', textos: ['Olá'] })).status, 400)
  })
})
