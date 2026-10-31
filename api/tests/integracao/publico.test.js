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
    await amb.aprovar('noticias', publicada) // o Comandante aprova a publicação
    rascunho = (await amb.com(admin).post('/api/admin/colecoes/noticias').send({ ...noticia({ titulo: 'Notícia em rascunho' }), _estado: 'rascunho' })).body.slug
    for (const b of [
      { titulo: 'Em vigor', inicio: '2026-10-01', fim: '2026-10-31' },
      { titulo: 'Expirado', fim: '2026-10-09' },
      { titulo: 'Desligado', ativo: false },
    ]) await amb.aprovar('publicidade', (await amb.com(admin).post('/api/admin/colecoes/publicidade').send(b)).body.id)
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

  it('comentários: só aparecem depois da equipa de comunicação e do Comandante; validados e com armadilha para robôs', async () => {
    const url = `/api/publico/interacoes/noticias/${publicada}/comentarios`
    const visiveis = async () => (await amb.http().get(`/api/publico/interacoes/noticias/${publicada}?visitante=${VISITANTE}`)).body.comentarios
    const r = await amb.http().post(url).send({ nome: 'Maria', texto: 'Excelente iniciativa!', visitante: VISITANTE })
    assert.equal(r.status, 201)
    assert.equal(r.body.emAprovacao, true)
    assert.equal(r.body.comentarios.length, 0)
    assert.equal((await amb.http().post(url).send({ nome: 'M', texto: 'x' })).status, 400)
    const robo = await amb.http().post(url).send({ nome: 'Robô', texto: 'compre já', website: 'http://spam' })
    assert.equal(robo.status, 204)

    const moderador = amb.com((await amb.criarUtilizador('moderador')).token)
    const cmd = amb.com((await amb.oComandante()).token)
    const id = (await moderador.get('/api/admin/comentarios')).body.find((c) => c.nome === 'Maria').id
    assert.equal((await moderador.get('/api/admin/comentarios/contagem')).body.porRever, 1)
    // 1.º passo: a equipa de comunicação; o Comandante ainda não o vê como seu enquanto não for revisto
    assert.equal((await cmd.post(`/api/admin/publicacoes/comentarios/${id}/decisao`).send({ decisao: 'aprovar' })).status, 409)
    const rev = await moderador.post(`/api/admin/comentarios/${id}/revisao`).send({ decisao: 'aprovar' })
    assert.equal(rev.body.estado, 'revisto')
    assert.equal((await visiveis()).length, 0)
    assert.equal((await moderador.post(`/api/admin/comentarios/${id}/revisao`).send({ decisao: 'aprovar' })).status, 409)
    // o moderador não decide pelo Comandante
    assert.equal((await moderador.post(`/api/admin/publicacoes/comentarios/${id}/decisao`).send({ decisao: 'aprovar' })).status, 403)
    // 2.º passo: o Comandante, em «Por aprovar»
    assert.equal((await cmd.get('/api/admin/publicacoes/contagem')).body.comentarios, 1)
    const item = (await cmd.get('/api/admin/publicacoes')).body.find((p) => p.colecao === 'comentarios')
    assert.equal(item.titulo, 'Comentário de Maria')
    assert.equal(item.resumo, 'Excelente iniciativa!')
    assert.equal(item.destino, 'Notícia pública')
    assert.equal((await cmd.post(`/api/admin/publicacoes/comentarios/${id}/decisao`).send({ decisao: 'aprovar' })).status, 200)
    const lista = await visiveis()
    assert.equal(lista.length, 1)
    assert.equal(lista[0].texto, 'Excelente iniciativa!')
    assert.ok(!('ip' in lista[0]))

    // recusar (em qualquer dos passos) apaga o comentário; o Comandante tem de dizer porquê
    await amb.http().post(url).send({ nome: 'Rui', texto: 'Comentário fora do tema' })
    await amb.http().post(url).send({ nome: 'Luís', texto: 'Comentário ofensivo' })
    const todos = (await moderador.get('/api/admin/comentarios')).body
    const rui = todos.find((c) => c.nome === 'Rui').id
    const luis = todos.find((c) => c.nome === 'Luís').id
    assert.equal((await moderador.post(`/api/admin/comentarios/${rui}/revisao`).send({ decisao: 'recusar' })).body.estado, 'recusado')
    await moderador.post(`/api/admin/comentarios/${luis}/revisao`).send({ decisao: 'aprovar' })
    assert.equal((await cmd.post(`/api/admin/publicacoes/comentarios/${luis}/decisao`).send({ decisao: 'recusar' })).status, 400)
    assert.equal((await cmd.post(`/api/admin/publicacoes/comentarios/${luis}/decisao`).send({ decisao: 'recusar', motivo: 'Linguagem ofensiva' })).status, 200)
    assert.deepEqual((await moderador.get('/api/admin/comentarios')).body.map((c) => c.nome), ['Maria'])
    assert.equal((await visiveis()).length, 1)
  })

  it('comentário com um ataque XSS é recusado; HTML inofensivo fica guardado como texto (o site escapa ao mostrar)', async () => {
    const url = `/api/publico/interacoes/noticias/${publicada}/comentarios`
    const r = await amb.http().post(url).send({ nome: 'Teste', texto: '<img src=x onerror=alert(1)>' })
    assert.equal(r.status, 400)
    assert.equal(r.body.codigo, 'conteudo_recusado')
    const ok = await amb.http().post(url).send({ nome: 'Teste', texto: 'Gostei <b>muito</b>' })
    assert.equal(ok.status, 201)
    const guardado = (await amb.com(admin).get('/api/admin/comentarios')).body.find((c) => c.nome === 'Teste')
    assert.equal(guardado.texto, 'Gostei <b>muito</b>')
    assert.equal(guardado.estado, 'pendente')
  })

  it('limita comentários seguidos (429)', async () => {
    const lim = await criarAmbiente({ limites: { comentario: { maximo: 2 } } })
    try {
      const t = await lim.entrar()
      const slug = (await lim.com(t).post('/api/admin/colecoes/noticias').send(noticia())).body.slug
      await lim.aprovar('noticias', slug)
      const url = `/api/publico/interacoes/noticias/${slug}/comentarios`
      for (let i = 0; i < 2; i++) assert.equal((await lim.http().post(url).send({ nome: 'Ana', texto: `Comentário ${i}` })).status, 201)
      const r = await lim.http().post(url).send({ nome: 'Ana', texto: 'Mais um' })
      assert.equal(r.status, 429)
      assert.match(r.body.erro, /demasiado depressa/)
    } finally {
      await lim.fechar()
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
