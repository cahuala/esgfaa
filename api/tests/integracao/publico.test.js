import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, relogioFalso, noticia } from '../apoio/ambiente.js'

const VISITANTE = 'visitante-1234-abcd'
const NAVEGADOR = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'

describe('site público', () => {
  let amb, admin, publicada, rascunho
  before(async () => {
    amb = await criarAmbiente({ relogio: relogioFalso('2026-10-10T12:00:00Z') })
    admin = await amb.entrar()
    publicada = (await amb.com(admin).post('/api/admin/colecoes/noticias').send(noticia({ titulo: 'Notícia pública' }))).body.slug
    rascunho = (await amb.com(admin).post('/api/admin/colecoes/noticias').send({ ...noticia({ titulo: 'Notícia em rascunho' }), _estado: 'rascunho' })).body.slug
    for (const b of [
      { titulo: 'Em vigor', inicio: '2026-10-01', fim: '2026-10-31' },
      { titulo: 'Expirado', fim: '2026-10-09' },
      { titulo: 'Desligado', ativo: false },
    ]) await amb.com(admin).post('/api/admin/colecoes/publicidade').send(b)
  })
  after(() => amb.fechar())

  it('conteúdo: só publicados, banners em vigor e sem campos internos', async () => {
    const r = await amb.http().get('/api/publico/conteudo')
    assert.equal(r.status, 200)
    const slugs = r.body.noticias.map((n) => n.slug)
    assert.ok(slugs.includes(publicada))
    assert.ok(!slugs.includes(rascunho))
    assert.deepEqual(r.body.publicidade.map((b) => b.titulo), ['Em vigor'])
    assert.ok(r.body.noticias.every((n) => !Object.keys(n).some((k) => k.startsWith('_'))))
    for (const k of ['paginas', 'estatisticas', 'artigos', 'eventos', 'cursos', 'pessoas']) assert.ok(k in r.body, k)
  })

  it('rascunhos e coleções não interativas não aceitam interações', async () => {
    assert.equal((await amb.http().get(`/api/publico/interacoes/noticias/${rascunho}`)).status, 404)
    assert.equal((await amb.http().get('/api/publico/interacoes/cursos/x')).status, 404)
    assert.equal((await amb.http().post(`/api/publico/interacoes/noticias/${rascunho}/gosto`).send({ visitante: VISITANTE })).status, 404)
  })

  it('gosto alterna por visitante', async () => {
    const url = `/api/publico/interacoes/noticias/${publicada}/gosto`
    const a = await amb.http().post(url).send({ visitante: VISITANTE })
    assert.deepEqual([a.body.gostos, a.body.gostei], [1, true])
    const b = await amb.http().post(url).send({ visitante: VISITANTE })
    assert.deepEqual([b.body.gostos, b.body.gostei], [0, false])
    assert.equal((await amb.http().post(url).send({ visitante: '<x>' })).status, 400)
  })

  it('comentários: publicados de imediato, validados e com armadilha para robôs', async () => {
    const url = `/api/publico/interacoes/noticias/${publicada}/comentarios`
    const r = await amb.http().post(url).send({ nome: 'Maria', texto: 'Excelente iniciativa!', visitante: VISITANTE })
    assert.equal(r.status, 201)
    assert.equal(r.body.comentarios[0].texto, 'Excelente iniciativa!')
    assert.ok(!('ip' in r.body.comentarios[0]))
    assert.equal((await amb.http().post(url).send({ nome: 'M', texto: 'x' })).status, 400)
    const robo = await amb.http().post(url).send({ nome: 'Robô', texto: 'compre já', website: 'http://spam' })
    assert.equal(robo.status, 204)
    const resumo = await amb.http().get(`/api/publico/interacoes/noticias/${publicada}?visitante=${VISITANTE}`)
    assert.equal(resumo.body.comentarios.length, 1)
  })

  it('comentário com HTML é guardado como texto (o site escapa ao mostrar)', async () => {
    const url = `/api/publico/interacoes/noticias/${publicada}/comentarios`
    const r = await amb.http().post(url).send({ nome: 'Teste', texto: '<img src=x onerror=alert(1)>' })
    assert.equal(r.status, 201)
    assert.equal(r.body.comentarios[0].texto, '<img src=x onerror=alert(1)>')
  })

  it('limita comentários seguidos (429)', async () => {
    const lim = await criarAmbiente({ limites: { comentario: { maximo: 2 } } })
    try {
      const t = await lim.entrar()
      const slug = (await lim.com(t).post('/api/admin/colecoes/noticias').send(noticia())).body.slug
      const url = `/api/publico/interacoes/noticias/${slug}/comentarios`
      for (let i = 0; i < 2; i++) assert.equal((await lim.http().post(url).send({ nome: 'Ana', texto: `Comentário ${i}` })).status, 201)
      const r = await lim.http().post(url).send({ nome: 'Ana', texto: 'Mais um' })
      assert.equal(r.status, 429)
      assert.match(r.body.erro, /demasiado depressa/)
    } finally {
      lim.fechar()
    }
  })

  it('visualizações contam uma vez por visitante', async () => {
    const url = `/api/publico/interacoes/noticias/${publicada}/visualizacao`
    for (let i = 0; i < 3; i++) assert.equal((await amb.http().post(url).send({ visitante: VISITANTE })).status, 204)
    await amb.http().post(url).send({ visitante: 'outro-visitante-99' })
    assert.equal((await amb.http().get(`/api/publico/interacoes/noticias/${publicada}`)).body.visualizacoes, 2)
  })

  it('visitas: regista navegadores e ignora robôs e dados inválidos', async () => {
    const enviar = (corpo, agente = NAVEGADOR) => amb.http().post('/api/publico/visita').set('User-Agent', agente).send(corpo)
    assert.equal((await enviar({ visitante: VISITANTE, caminho: '/noticias', origem: 'https://www.google.com/' })).status, 204)
    await enviar({ visitante: VISITANTE, caminho: '/' }, 'Googlebot/2.1')
    await enviar({ visitante: 'x', caminho: '/' })
    await enviar({ visitante: VISITANTE, caminho: 'javascript:x' })
    const est = (await amb.com(admin).get('/api/admin/estatisticas?dias=7')).body
    assert.equal(est.totais.paginas, 1)
    assert.equal(est.origens[0].valor, 'google.com')
    assert.equal(est.navegadores[0].valor, 'Chrome')
  })

  it('publicidade: conta impressões e cliques só de banners publicados', async () => {
    const banners = (await amb.com(admin).get('/api/admin/colecoes/publicidade')).body
    const id = banners.find((b) => b.titulo === 'Em vigor').id
    await amb.http().post(`/api/publico/publicidade/${id}/impressao`)
    await amb.http().post(`/api/publico/publicidade/${id}/impressao`)
    await amb.http().post(`/api/publico/publicidade/${id}/clique`)
    assert.equal((await amb.http().post('/api/publico/publicidade/nao-existe/clique')).status, 204)
    const depois = (await amb.com(admin).get('/api/admin/colecoes/publicidade')).body.find((b) => b.id === id)
    assert.deepEqual(depois._metricas, { impressoes: 2, cliques: 1 })
  })
})
