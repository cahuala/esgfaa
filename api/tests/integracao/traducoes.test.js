import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente } from '../apoio/ambiente.js'
import { aplicarTextos, extrairTextos } from '../../src/dominio/traducoes/textos.js'
import { comGlossario } from '../../src/dominio/traducoes/glossario.js'

describe('traduções: que textos se traduzem', () => {
  it('glossário: termos da Escola, ordinais em cada língua, nomes de pessoas e apóstrofos', async () => {
    const vistos = []
    const t = comGlossario({ nome: 'falso', traduzirMapa: async (m, l) => { vistos.push(...Object.values(m)); return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, `${l}: ${v.replace("d'", "d ' ")}`])) } })
    const mapa = { a: '12.º Curso de Estado-Maior Conjunto', b: '1.ª edição', c: 'Prefácio de João Hossi Sebastião', d: 'Conceição Kiala Quissanga', e: "Escola d'armas" }
    const en = await t.traduzirMapa(mapa, 'en')
    assert.equal(en.a, '12th Joint Staff Course')
    assert.equal(en.b, 'en: 1st edição')
    assert.equal(en.c, 'en: Prefácio de João Hossi Sebastião')
    assert.equal(en.d, 'Conceição Kiala Quissanga') // só um nome: nem vai ao tradutor
    assert.equal(en.e, "en: Escola d'armas")
    assert.ok(vistos.every((v) => !/João|Conceição|Estado-Maior/.test(v)))
    assert.equal((await t.traduzirMapa(mapa, 'fr')).a, "12e Cours d'état-major interarmées")
    assert.equal((await t.traduzirMapa(mapa, 'es')).a, '12.º Curso de Estado Mayor Conjunto')
    // o artigo português volta certo em cada língua
    const art = { f: 'Coordenadora do Curso de Estado-Maior Conjunto', g: 'Instalações da Escola Superior de Guerra', h: 'Bem-vindos à cadeira' }
    const fr = await t.traduzirMapa(art, 'fr')
    assert.deepEqual([fr.f, fr.g, fr.h], ["fr: Coordenadora du Cours d'état-major interarmées", "fr: Instalações de l'École Supérieure de Guerre", "fr: Bem-vindos à l'unité d'enseignement"])
    const es = await t.traduzirMapa(art, 'es')
    assert.deepEqual([es.f, es.g, es.h], ['es: Coordenadora del Curso de Estado Mayor Conjunto', 'es: Instalações de la Escuela Superior de Guerra', 'es: Bem-vindos a la asignatura'])
    // em inglês, antes de um nome próprio, a preposição fica com o tradutor; a que ele deixar em português traduz-se
    assert.equal((await t.traduzirMapa(art, 'en')).g, 'en: Instalações of the Higher War College')
  })

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

  it('nomes com o posto à frente e identificadores não se traduzem', () => {
    const t = extrairTextos({ nome: 'Cor. Ana Baptista', outro: 'Cap.-Ten. Pedro Neto', chefe: 'Ten-Cor. Isabel Fortunato', autor: 'ana-baptista', cargo: 'Docente de Estratégia', frase: 'A Escola. Nova frase.' })
    assert.deepEqual(Object.keys(t).sort(), ['cargo', 'frase'])
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
    await amb.aprovar('noticias', id) // traduz-se quando o Comandante aprova
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
    await amb.aprovar('noticias', id)
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

  it("a tradução automática não deixa espaços à volta do apóstrofo («d ' officiers» → «d'officiers»)", async () => {
    const n = (await admin.post('/api/admin/colecoes/noticias').send({ titulo: "Formação d ' oficiais", resumo: 'Resumo.', data: '2026-09-12', conteudo: [], _estado: 'publicado' })).body
    await amb.aprovar('noticias', n.slug)
    await amb.contentor.servicos.traducoes.esvaziar()
    const e = (await admin.get(`/api/admin/traducoes/noticias/${n.slug}`)).body
    assert.equal(e.traducoes.fr.textos.titulo, "[FR] Formação d'oficiais")
  })

  it('a revista: um número com PDF chega ao site, traduz-se sem tocar nos nomes e só a gere quem tem permissão', async () => {
    const esperar = () => amb.contentor.servicos.traducoes.esvaziar()
    const numero = {
      numero: 'N.º 3', titulo: 'Ciberdefesa', data: '2027-03-01', resumo: 'Proteger as infraestruturas críticas.', pdf: '/uploads/2027-03/revista.pdf',
      sumario: [{ titulo: 'Editorial', autor: 'Cor. Ana Baptista', pagina: '3' }], _estado: 'publicado',
    }
    assert.equal((await redator.post('/api/admin/colecoes/revistas').send(numero)).status, 403) // o redator não gere a revista
    const chefe = amb.com((await amb.criarUtilizador('editor_chefe')).token)
    const r = (await chefe.post('/api/admin/colecoes/revistas').send(numero)).body
    assert.equal(r.slug, 'ciberdefesa')
    await amb.aprovar('revistas', r.slug)
    await esperar()
    const site = (await amb.http().get('/api/publico/conteudo')).body
    const publicado = site.revistas.find((x) => x.slug === 'ciberdefesa')
    assert.match(publicado.pdf, /^https?:\/\/.+\/uploads\/2027-03\/revista\.pdf$/) // endereço completo, para o site noutro domínio
    const en = site.traducoes.itens['revistas/ciberdefesa'].en
    assert.deepEqual([en.titulo, en['sumario.0.titulo'], en['sumario.0.autor'], en.numero, en.pdf], ['[EN] Ciberdefesa', '[EN] Editorial', undefined, undefined, undefined])

    // uma tradução antiga com o nome traduzido é limpa ao completar
    const t = await amb.contentor.repositorios.traducoes.ler('revistas', 'ciberdefesa', 'fr')
    await amb.contentor.repositorios.traducoes.guardar({ ...t, textos: { ...t.textos, 'sumario.0.autor': 'Couleur. Ana Baptista' }, atualizadoEm: undefined })
    await amb.contentor.servicos.traducoes.completar()
    await esperar()
    const limpa = await amb.contentor.repositorios.traducoes.ler('revistas', 'ciberdefesa', 'fr')
    assert.equal(limpa.textos['sumario.0.autor'], undefined)
    assert.equal(limpa.textos.titulo, '[FR] Ciberdefesa')
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
