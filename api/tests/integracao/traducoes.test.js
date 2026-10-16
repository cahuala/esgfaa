import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente } from '../apoio/ambiente.js'
import { aplicarTextos, extrairTextos } from '../../src/dominio/traducoes/textos.js'

describe('traduções: que textos se traduzem', () => {
  it('extrai só texto (sem endereços, imagens, datas, horas, e-mails nem telefones) e volta a aplicá-lo', () => {
    const dados = {
      slug: 'abertura', titulo: 'Abertura do ano', data: '2026-09-12', capa: '/uploads/a.png', resumo: 'Mais de 200 alunos.',
      conteudo: [{ tipo: 'paragrafo', texto: 'A Escola abriu.' }, { tipo: 'imagem', src: '/uploads/b.png', legenda: 'O auditório.', posicao: 'direita' }],
      programa: [{ hora: '09:00', atividade: 'Sessão de abertura' }], contactos: [{ email: 'geral@esgfaa.gov.ao', telefones: ['+244 222 000 000'] }], vagas: '60', valor: '+500',
    }
    const t = extrairTextos(dados)
    assert.deepEqual(Object.keys(t).sort(), ['conteudo.0.texto', 'conteudo.1.legenda', 'programa.0.atividade', 'resumo', 'titulo'])
    const en = aplicarTextos(dados, { titulo: 'Opening of the year', 'conteudo.1.legenda': 'The auditorium.', 'nao.existe': 'x', resumo: '  ' })
    assert.equal(en.titulo, 'Opening of the year')
    assert.equal(en.conteudo[1].legenda, 'The auditorium.')
    assert.equal(en.resumo, 'Mais de 200 alunos.') // vazio: fica o original
    assert.equal(en.conteudo[1].src, '/uploads/b.png')
    assert.equal(dados.titulo, 'Abertura do ano') // o original não muda
  })
})

describe('traduções do site: IA, revisão e publicação', () => {
  let amb, admin, redator
  const pedidos = []
  const claude = {
    json: async ({ sistema, conteudo }) => {
      pedidos.push(conteudo)
      const lingua = /Français/.test(sistema) ? 'FR' : 'EN'
      return Object.fromEntries(Object.entries(JSON.parse(conteudo)).map(([k, v]) => [k, `[${lingua}] ${v}`]))
    },
  }

  before(async () => {
    amb = await criarAmbiente({ externos: { claude } })
    admin = amb.com(await amb.entrar())
    redator = amb.com((await amb.criarUtilizador('redator')).token)
  })
  after(() => amb.fechar())

  it('ao publicar traduz sozinho; a revisão da redação mantém-se e só o que muda volta a ser traduzido', async () => {
    const esperar = () => amb.contentor.servicos.traducoes.esvaziar()
    // um rascunho não se traduz
    const rasc = (await admin.post('/api/admin/colecoes/noticias').send({ titulo: 'Rascunho', resumo: 'Por publicar.', data: '2026-09-12', conteudo: [], _estado: 'rascunho' })).body
    await esperar()
    assert.deepEqual((await admin.get(`/api/admin/traducoes/noticias/${rasc.slug}`)).body.traducoes, {})

    const n = (await admin.post('/api/admin/colecoes/noticias').send({
      titulo: 'Abertura do ano académico', resumo: 'Mais de 200 novos alunos.', data: '2026-09-12', categoria: 'Institucional',
      conteudo: [{ tipo: 'paragrafo', texto: 'A Escola abriu o ano com uma cerimónia.' }], _estado: 'publicado',
    })).body
    const id = n.slug
    await esperar()
    let e = (await admin.get(`/api/admin/traducoes/noticias/${id}`)).body
    assert.deepEqual(Object.keys(e.originais).sort(), ['categoria', 'conteudo.0.texto', 'resumo', 'titulo'])
    assert.deepEqual(Object.keys(e.traducoes).sort(), ['en', 'es', 'fr'])
    assert.deepEqual([e.traducoes.en.estado, e.traducoes.en.automatica, e.traducoes.fr.textos.titulo], ['publicada', true, '[FR] Abertura do ano académico'])
    let site = (await amb.http().get('/api/publico/conteudo')).body
    assert.equal(site.traducoes.itens[`noticias/${id}`].en.titulo, '[EN] Abertura do ano académico')
    assert.deepEqual(site.traducoes.automaticas[`noticias/${id}`].sort(), ['en', 'es', 'fr'])
    assert.equal(site.traducoes.itens[`noticias/${rasc.slug}`], undefined)

    // a redação revê o título em inglês e publica (deixa de ser automática)
    const textos = { ...e.traducoes.en.textos, titulo: 'Opening of the academic year' }
    assert.equal((await redator.put(`/api/admin/traducoes/noticias/${id}/en`).send({ textos, estado: 'publicada' })).status, 403) // redator não publica
    assert.equal((await admin.put(`/api/admin/traducoes/noticias/${id}/en`).send({ textos: { resumo: 'x' }, estado: 'publicada' })).status, 400) // sem título
    assert.equal((await admin.put(`/api/admin/traducoes/noticias/${id}/en`).send({ textos, estado: 'publicada' })).status, 200)
    site = (await amb.http().get('/api/publico/conteudo')).body
    assert.equal(site.traducoes.itens[`noticias/${id}`].en.titulo, 'Opening of the academic year')
    assert.ok(!site.traducoes.automaticas[`noticias/${id}`].includes('en'))

    // o original muda e volta a ser publicado: só o resumo é traduzido de novo; o título revisto fica
    pedidos.length = 0
    await admin.put(`/api/admin/colecoes/noticias/${id}`).send({ ...n, resumo: 'Mais de 250 novos alunos.', _estado: 'publicado' })
    await esperar()
    assert.ok(pedidos.length === 3 && pedidos.every((p) => JSON.stringify(Object.keys(JSON.parse(p))) === '["resumo"]'))
    e = (await admin.get(`/api/admin/traducoes/noticias/${id}`)).body
    assert.deepEqual([e.traducoes.en.textos.titulo, e.traducoes.en.textos.resumo, e.traducoes.en.desatualizados], ['Opening of the academic year', '[EN] Mais de 250 novos alunos.', []])

    // páginas também; o botão do painel completa o que faltar; língua desconhecida recusada
    assert.equal((await admin.post('/api/admin/traducoes/paginas/home/fr/ia')).status, 200)
    assert.equal((await admin.post('/api/admin/traducoes/completar')).status, 202)
    await esperar()
    assert.equal((await admin.post(`/api/admin/traducoes/noticias/${id}/de/ia`)).status, 404)
    assert.equal((await admin.get('/api/admin/traducoes/noticias')).body[id].en, 'publicada')
  })

  it('sem chave da IA, a tradução automática explica o que falta (à mão continua possível)', async () => {
    const outro = await criarAmbiente()
    try {
      const a = outro.com(await outro.entrar())
      const n = (await a.post('/api/admin/colecoes/noticias').send({ titulo: 'Notícia', resumo: 'Resumo.', data: '2026-09-12', conteudo: [] })).body
      const r = await a.post(`/api/admin/traducoes/noticias/${n.slug}/es/ia`)
      assert.equal(r.status, 400)
      assert.match(r.body.erro, /LIBRETRANSLATE_URL ou ANTHROPIC_API_KEY/)
      assert.equal((await a.put(`/api/admin/traducoes/noticias/${n.slug}/es`).send({ textos: { titulo: 'Noticia' }, estado: 'publicada' })).status, 200)
    } finally {
      await outro.fechar()
    }
  })
})
