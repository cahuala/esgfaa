import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, noticia } from '../apoio/ambiente.js'
import { abrirEventos } from '../apoio/eventos.js'

describe('avisos instantâneos (sem recarregar a página)', () => {
  let amb, slug, moderador, cmd
  before(async () => {
    amb = await criarAmbiente()
    const admin = amb.com(await amb.entrar())
    slug = (await admin.post('/api/admin/colecoes/noticias').send(noticia({ titulo: 'Notícia com comentários' }))).body.slug
    await amb.aprovar('noticias', slug)
    moderador = await amb.criarUtilizador('moderador')
    cmd = await amb.oComandante()
  })
  after(() => amb.fechar())

  it('o painel sabe logo que chegou um comentário; o site recebe-o logo que o Comandante o aprova', async () => {
    const painel = await abrirEventos(amb.app, '/api/admin/eventos', moderador.token)
    const site = await abrirEventos(amb.app, '/api/publico/eventos')
    try {
      assert.equal(painel.estado, 200)
      assert.match(painel.tipo, /text\/event-stream/)
      await amb.http().post(`/api/publico/interacoes/noticias/${slug}/comentarios`).send({ nome: 'Maria', texto: 'Muito bom!' })
      assert.equal((await painel.esperar('comentarios')).length, 1)
      assert.equal(site.recebidos.length, 0)

      const id = (await amb.com(moderador.token).get('/api/admin/comentarios')).body[0].id
      await amb.com(moderador.token).post(`/api/admin/comentarios/${id}/revisao`).send({ decisao: 'aprovar' })
      await amb.com(cmd.token).post(`/api/admin/publicacoes/comentarios/${id}/decisao`).send({ decisao: 'aprovar' })
      assert.deepEqual(await site.esperar('comentarios'), [{ tipo: 'comentarios', colecao: 'noticias', id: slug }])
    } finally {
      painel.fechar()
      site.fechar()
    }
  })

  it('o fluxo do painel e o do portal exigem sessão', async () => {
    assert.equal((await amb.http().get('/api/admin/eventos')).status, 401)
    assert.equal((await amb.http().get('/api/portal/eventos')).status, 401)
  })
})
