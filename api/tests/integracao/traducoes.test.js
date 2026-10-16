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

  it('rascunho pela IA, revisão, publicação e só o que mudou volta a ser traduzido', async () => {
    const n = (await admin.post('/api/admin/colecoes/noticias').send({
      titulo: 'Abertura do ano académico', resumo: 'Mais de 200 novos alunos.', data: '2026-09-12', categoria: 'Institucional',
      conteudo: [{ tipo: 'paragrafo', texto: 'A Escola abriu o ano com uma cerimónia.' }], _estado: 'publicado',
    })).body
    const id = n.slug
    let e = (await admin.get(`/api/admin/traducoes/noticias/${id}`)).body
    assert.deepEqual(Object.keys(e.originais).sort(), ['categoria', 'conteudo.0.texto', 'resumo', 'titulo'])
    assert.deepEqual([e.ia, e.traducoes], [true, {}])

    const ia = (await admin.post(`/api/admin/traducoes/noticias/${id}/en/ia`)).body
    assert.equal(ia.traduzidos, 4)
    assert.equal(ia.traducao.estado, 'rascunho')
    // em rascunho o site não mostra
    let site = (await amb.http().get('/api/publico/conteudo')).body
    assert.deepEqual(site.traducoes.itens, {})
    assert.deepEqual(Object.keys(site.traducoes.linguas), ['en', 'fr', 'es'])

    // a redação revê o título e publica
    const textos = { ...ia.traducao.textos, titulo: 'Opening of the academic year' }
    assert.equal((await redator.put(`/api/admin/traducoes/noticias/${id}/en`).send({ textos, estado: 'publicada' })).status, 403) // redator não publica
    assert.equal((await admin.put(`/api/admin/traducoes/noticias/${id}/en`).send({ textos: { resumo: 'x' }, estado: 'publicada' })).status, 400) // sem título
    assert.equal((await admin.put(`/api/admin/traducoes/noticias/${id}/en`).send({ textos, estado: 'publicada' })).status, 200)
    site = (await amb.http().get('/api/publico/conteudo')).body
    assert.equal(site.traducoes.itens[`noticias/${id}`].en.titulo, 'Opening of the academic year')

    // o original muda: a tradução fica desatualizada nesse campo, e a IA só refaz esse
    await admin.put(`/api/admin/colecoes/noticias/${id}`).send({ ...n, resumo: 'Mais de 250 novos alunos.' })
    e = (await admin.get(`/api/admin/traducoes/noticias/${id}`)).body
    assert.deepEqual(e.traducoes.en.desatualizados, ['resumo'])
    pedidos.length = 0
    const de2 = (await admin.post(`/api/admin/traducoes/noticias/${id}/en/ia`)).body
    assert.equal(de2.traduzidos, 1)
    assert.deepEqual(Object.keys(JSON.parse(pedidos[0])), ['resumo'])
    assert.equal(de2.traducao.textos.titulo, 'Opening of the academic year') // a revisão humana mantém-se
    assert.equal(de2.traducao.estado, 'rascunho')

    // páginas também se traduzem; língua desconhecida é recusada
    assert.equal((await admin.post('/api/admin/traducoes/paginas/home/fr/ia')).status, 200)
    assert.equal((await admin.post(`/api/admin/traducoes/noticias/${id}/de/ia`)).status, 404)
    assert.equal((await admin.get('/api/admin/traducoes/noticias')).body[id].en, 'rascunho')
  })

  it('sem chave da IA, a tradução automática explica o que falta (à mão continua possível)', async () => {
    const outro = await criarAmbiente()
    try {
      const a = outro.com(await outro.entrar())
      const n = (await a.post('/api/admin/colecoes/noticias').send({ titulo: 'Notícia', resumo: 'Resumo.', data: '2026-09-12', conteudo: [] })).body
      const r = await a.post(`/api/admin/traducoes/noticias/${n.slug}/es/ia`)
      assert.equal(r.status, 400)
      assert.match(r.body.erro, /ANTHROPIC_API_KEY/)
      assert.equal((await a.put(`/api/admin/traducoes/noticias/${n.slug}/es`).send({ textos: { titulo: 'Noticia' }, estado: 'publicada' })).status, 200)
    } finally {
      await outro.fechar()
    }
  })
})
