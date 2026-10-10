import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, noticia } from '../apoio/ambiente.js'

describe('conteúdos e páginas (painel)', () => {
  let amb, admin
  before(async () => {
    amb = await criarAmbiente()
    admin = await amb.entrar()
  })
  after(() => amb.fechar())
  const api = () => amb.com(admin)

  it('cria com identificador único a partir do título', async () => {
    const a = await api().post('/api/admin/colecoes/noticias').send(noticia({ titulo: 'Visita Oficial à Escola' }))
    const b = await api().post('/api/admin/colecoes/noticias').send(noticia({ titulo: 'Visita Oficial à Escola' }))
    assert.equal(a.status, 201)
    assert.equal(a.body.slug, 'visita-oficial-a-escola')
    assert.equal(b.body.slug, 'visita-oficial-a-escola-2')
    assert.ok(a.body._criado)
    assert.equal(a.body._editadoPor, 'Administrador Teste')
  })

  it('editar mantém o identificador e regista os campos alterados', async () => {
    const c = await api().post('/api/admin/colecoes/eventos').send({ titulo: 'Seminário', data: '2026-11-01' })
    const r = await api().put(`/api/admin/colecoes/eventos/${c.body.id}`).send({ ...c.body, id: 'outro-id', titulo: 'Seminário Final' })
    assert.equal(r.status, 200)
    assert.equal(r.body.id, c.body.id)
    assert.equal(r.body.titulo, 'Seminário Final')
    const log = amb.contentor.repositorios.atividades.listar({ acao: 'editar', colecao: 'eventos' })
    assert.deepEqual(JSON.parse(log.linhas[0].detalhes).campos.sort(), ['titulo'])
  })

  it('valida os dados (título, formatos, endereços perigosos)', async () => {
    assert.equal((await api().post('/api/admin/colecoes/noticias').send({ titulo: '' })).status, 400)
    assert.equal((await api().post('/api/admin/colecoes/noticias').send(noticia({ data: 'ontem' }))).status, 400)
    const r = await api().post('/api/admin/colecoes/noticias').send(noticia({ capa: 'javascript:alert(document.cookie)' }))
    assert.equal(r.status, 400)
    assert.match(r.body.erro, /capa/)
  })

  it('filtra o HTML do corpo antes de guardar', async () => {
    const html = '<p>Olá<script>alert(1)</script><img src="/uploads/a.jpg" onerror="alert(2)"></p><iframe src="https://mal.com"></iframe>'
    const r = await api().post('/api/admin/colecoes/artigos').send({ titulo: 'Artigo', conteudo: [{ tipo: 'texto', html }] })
    assert.equal(r.status, 201)
    const guardado = amb.contentor.repositorios.conteudos.ler('artigos', r.body.slug).dados.conteudo[0].html
    assert.doesNotMatch(guardado, /script|onerror|mal\.com/)
    assert.match(guardado, /<img src="\/uploads\/a.jpg" \/>/)
  })

  it('guarda endereços de uploads relativos e devolve-os completos', async () => {
    const r = await api().post('/api/admin/colecoes/pessoas').send({ nome: 'Coronel Teste', foto: 'http://127.0.0.1/uploads/2026-10/f.jpg' })
    assert.equal(amb.contentor.repositorios.conteudos.ler('pessoas', r.body.id).dados.foto, '/uploads/2026-10/f.jpg')
    assert.match(r.body.foto, /^http:\/\/127\.0\.0\.1:\d+\/uploads\/2026-10\/f\.jpg$/)
  })

  it('coleções e identificadores inválidos dão 404', async () => {
    assert.equal((await api().get('/api/admin/colecoes/segredos')).status, 404)
    assert.equal((await api().get('/api/admin/colecoes/noticias/..%2F..%2Fetc')).status, 404)
    assert.equal((await api().get('/api/admin/colecoes/noticias/nao-existe')).status, 404)
  })

  it('lista com estatísticas e métricas de publicidade', async () => {
    await api().post('/api/admin/colecoes/publicidade').send({ titulo: 'Banner', posicao: 'rodape' })
    const r = await api().get('/api/admin/colecoes/publicidade')
    assert.equal(r.status, 200)
    assert.deepEqual(r.body[0]._metricas, { impressoes: 0, cliques: 0 })
    assert.equal(r.body[0]._estado, 'publicado')
  })

  it('reordena e apaga com tudo o que está associado', async () => {
    const a = (await api().post('/api/admin/colecoes/cursos').send({ nome: 'Curso A' })).body.id
    const b = (await api().post('/api/admin/colecoes/cursos').send({ nome: 'Curso B' })).body.id
    assert.equal((await api().put('/api/admin/ordem/cursos').send({ ids: [b, a, 'nao-existe'] })).status, 204)
    assert.deepEqual((await api().get('/api/admin/colecoes/cursos')).body.map((c) => c.id), [b, a])
    assert.equal((await api().put('/api/admin/ordem/cursos').send({ ids: [a, a] })).status, 400)

    const n = (await api().post('/api/admin/colecoes/noticias').send(noticia({ titulo: 'Para apagar' }))).body.slug
    await amb.http().post(`/api/publico/interacoes/noticias/${n}/comentarios`).send({ nome: 'Ana', texto: 'Comentário' })
    assert.equal((await api().delete(`/api/admin/colecoes/noticias/${n}`)).status, 204)
    assert.equal(amb.contentor.repositorios.interacoes.listarComentarios().filter((c) => c.item_id === n).length, 0)
    assert.equal((await api().delete(`/api/admin/colecoes/noticias/${n}`)).status, 404)
  })

  it('páginas: lê, guarda filtrado e recusa páginas desconhecidas', async () => {
    assert.deepEqual((await api().get('/api/admin/paginas/home')).body, {})
    const r = await api().put('/api/admin/paginas/home').send({ heroi: { titulo: 'Bem-vindo', imagem: '/uploads/h.jpg' }, texto: { html: '<p>a</p><script>x</script>' } })
    assert.equal(r.status, 200)
    assert.equal(r.body.texto.html, '<p>a</p>')
    assert.equal((await api().put('/api/admin/paginas/home').send({ ligacao: 'javascript:x' })).status, 400)
    assert.equal((await api().get('/api/admin/paginas/admin')).status, 404)
    assert.equal((await api().put('/api/admin/paginas/home').send([1, 2])).status, 400)
  })

  it('comentários: lista com título e apaga com registo', async () => {
    const n = (await api().post('/api/admin/colecoes/noticias').send(noticia({ titulo: 'Com comentários' }))).body.slug
    await amb.http().post(`/api/publico/interacoes/noticias/${n}/comentarios`).send({ nome: 'Rui', texto: 'Muito bom' })
    const lista = (await api().get('/api/admin/comentarios')).body
    const c = lista.find((x) => x.item_id === n)
    assert.equal(c.tituloItem, 'Com comentários')
    assert.equal((await api().delete(`/api/admin/comentarios/${c.id}`)).status, 204)
    assert.equal((await api().delete(`/api/admin/comentarios/${c.id}`)).status, 404)
    assert.equal((await api().delete('/api/admin/comentarios/abc')).status, 404)
  })

  it('painel com totais, rascunhos por publicar e atividades', async () => {
    const red = await amb.criarUtilizador('redator')
    await amb.com(red.token).post('/api/admin/colecoes/noticias').send(noticia({ titulo: 'Rascunho pendente' }))
    const r = await api().get('/api/admin/painel')
    assert.equal(r.status, 200)
    assert.ok(r.body.porPublicar.some((p) => p.titulo === 'Rascunho pendente'))
    assert.ok(r.body.totais.noticias >= 1)
    assert.ok(Array.isArray(r.body.ultimasAtividades))
    assert.ok(Array.isArray(r.body.visitasDias))
  })
})
