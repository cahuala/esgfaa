import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, relogioFalso } from '../apoio/ambiente.js'

const NOVA = 'Portal2026segura'
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')
const anexo = (nome) => [PDF, { filename: nome, contentType: 'application/pdf' }]

describe('trabalhos completos: vários ficheiros, texto, grelha, correção em ficheiro e prorrogações', () => {
  let amb, relogio, cadeira
  const contas = {}
  const tokens = {}
  const portal = (quem) => amb.com(tokens[quem])

  before(async () => {
    relogio = relogioFalso('2026-11-09T09:00:00Z')
    amb = await criarAmbiente({ relogio })
    const admin = await amb.entrar()
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Estado-Maior' })
    const s = await amb.criarUtilizador('administrador')
    const sec = () => amb.com(s.token)
    const turma = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM A' })).body
    contas.prof = (await sec().post('/api/admin/academico/contas').send({ tipo: 'docente', nome: 'Docente Prof Teste', email: 'prof@esgfaa.gov.ao' })).body
    for (const k of ['ana', 'bruno']) contas[k] = (await amb.registarEMatricular(sec(), turma.id, { nome: `Estudante ${k} Teste`, email: `${k}@esgfaa.gov.ao` })).body
    cadeira = (await sec().post(`/api/admin/academico/turmas/${turma.id}/cadeiras`).send({ codigo: 'EST101', nome: 'Estratégia' })).body
    await sec().put(`/api/admin/academico/cadeiras/${cadeira.id}/docentes`).send({ docentes: [{ docenteId: contas.prof.id, papel: 'regente' }] })
    for (const k of ['prof', 'ana', 'bruno']) {
      const email = `${k}@esgfaa.gov.ao`
      const r = await amb.http().post('/api/portal/entrar').send({ email, senha: amb.senhaInicial(email) })
      tokens[k] = (await amb.com(r.body.token).put('/api/portal/eu/senha').send({ atual: amb.senhaInicial(email), nova: NOVA })).body.token
    }
  })
  after(() => amb.fechar())

  it('até N ficheiros; só texto; ficheiros e texto', async () => {
    const t = (await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/trabalhos`).send({ titulo: 'Dossier', prazo: '2026-11-20T23:59:00Z', maxFicheiros: 2 })).body
    assert.deepEqual([t.tipoEntrega, t.maxFicheiros], ['ficheiro', 2])
    const dois = await portal('ana').post(`/api/portal/trabalhos/${t.id}/entrega`).attach('ficheiros', ...anexo('parte1.pdf')).attach('ficheiros', ...anexo('parte2.pdf'))
    assert.equal(dois.status, 201, dois.body.erro)
    assert.deepEqual(dois.body.ficheiros.map((f) => f.nome), ['parte1.pdf', 'parte2.pdf'])
    const tres = await portal('bruno').post(`/api/portal/trabalhos/${t.id}/entrega`).attach('ficheiros', ...anexo('a.pdf')).attach('ficheiros', ...anexo('b.pdf')).attach('ficheiros', ...anexo('c.pdf'))
    assert.equal(tres.status, 400)
    assert.equal((await portal('bruno').post(`/api/portal/trabalhos/${t.id}/entrega`).field('texto', 'Só texto')).status, 400)
    // os dois ficheiros abrem para a autora e para o docente, não para o colega
    for (const f of dois.body.ficheiros) {
      assert.equal((await portal('ana').get(`/api/portal/ficheiros/${f.id}`)).status, 200)
      assert.equal((await portal('bruno').get(`/api/portal/ficheiros/${f.id}`)).status, 404)
      assert.equal((await portal('prof').get(`/api/portal/ficheiros/${f.id}`)).status, 200)
    }

    const texto = (await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/trabalhos`).send({ titulo: 'Reflexão', prazo: '2026-11-20T23:59:00Z', tipoEntrega: 'texto' })).body
    assert.equal((await portal('ana').post(`/api/portal/trabalhos/${texto.id}/entrega`).attach('ficheiro', ...anexo('x.pdf'))).status, 400)
    const r = await portal('ana').post(`/api/portal/trabalhos/${texto.id}/entrega`).send({ texto: 'A estratégia é a arte de…' })
    assert.equal(r.status, 201, r.body.erro)
    assert.deepEqual([r.body.texto, r.body.ficheiros.length], ['A estratégia é a arte de…', 0])

    const ambos = (await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/trabalhos`).send({ titulo: 'Relatório', prazo: '2026-11-20T23:59:00Z', tipoEntrega: 'ambos' })).body
    assert.equal((await portal('ana').post(`/api/portal/trabalhos/${ambos.id}/entrega`).send({})).status, 400)
    assert.equal((await portal('ana').post(`/api/portal/trabalhos/${ambos.id}/entrega`).field('texto', 'Resumo').attach('ficheiro', ...anexo('r.pdf'))).status, 201)
  })

  it('correção pela grelha de avaliação e ficheiro corrigido devolvido só ao autor', async () => {
    const grelha = [{ criterio: 'Estrutura', pontos: 4 }, { criterio: 'Argumentação', pontos: 10 }, { criterio: 'Fontes', pontos: 6 }]
    const t = (await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/trabalhos`).field('titulo', 'Ensaio').field('prazo', '2026-11-20T23:59:00Z').field('grelha', JSON.stringify(grelha))).body
    assert.equal(t.grelha.length, 3)
    const e = (await portal('ana').post(`/api/portal/trabalhos/${t.id}/entrega`).attach('ficheiro', ...anexo('ensaio.pdf'))).body
    // pontos parciais: nota ainda por calcular
    let c = await portal('prof').put(`/api/portal/entregas/${e.id}`).send({ grelha: { 0: 4, 1: 7 } })
    assert.equal(c.status, 200, c.body.erro)
    assert.equal(c.body.nota, null)
    assert.equal((await portal('prof').put(`/api/portal/entregas/${e.id}`).send({ grelha: { 0: 5, 1: 7, 2: 4 } })).status, 400) // acima do máximo
    c = await portal('prof').put(`/api/portal/entregas/${e.id}`).field('grelha', JSON.stringify({ 0: 4, 1: '7,5', 2: 4 })).field('correcao', 'Ver as notas no ficheiro.')
      .attach('ficheiro', ...anexo('ensaio-corrigido.pdf'))
    assert.equal(c.status, 200, c.body.erro)
    assert.deepEqual([c.body.nota, c.body.grelha['1']], [15.5, 7.5])
    const fc = c.body.correcaoFicheiroId
    assert.ok(fc)
    assert.equal((await portal('ana').get(`/api/portal/ficheiros/${fc}`)).status, 200)
    assert.equal((await portal('bruno').get(`/api/portal/ficheiros/${fc}`)).status, 404)
    const vista = (await portal('ana').get(`/api/portal/cadeiras/${cadeira.id}`)).body.trabalhos.find((x) => x.id === t.id)
    assert.deepEqual([vista.entrega.nota, vista.entrega.correcaoFicheiroId, vista.grelha.length], [15.5, fc, 3])
    // uma nova entrega apaga a correção anterior
    await portal('ana').post(`/api/portal/trabalhos/${t.id}/entrega`).attach('ficheiro', ...anexo('ensaio-v2.pdf'))
    const v2 = (await portal('ana').get(`/api/portal/cadeiras/${cadeira.id}`)).body.trabalhos.find((x) => x.id === t.id)
    assert.deepEqual([v2.entrega.nota, v2.entrega.correcaoFicheiroId], [null, null])
  })

  it('prorrogação: só o estudante indicado entrega depois do prazo; não é lembrado antes do seu prazo', async () => {
    const t = (await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/trabalhos`).send({ titulo: 'Ficha curta', prazo: '2026-11-10T08:00:00Z' })).body
    const url = `/api/portal/trabalhos/${t.id}/prorrogacao`
    assert.equal((await portal('prof').put(url).send({ estudanteId: contas.ana.id, prazo: '2026-11-09T08:00:00Z' })).status, 400) // antes do prazo
    assert.equal((await portal('ana').put(url).send({ estudanteId: contas.ana.id, prazo: '2026-11-15T08:00:00Z' })).status, 403)
    const p = await portal('prof').put(url).send({ estudanteId: contas.ana.id, prazo: '2026-11-15T08:00:00Z', motivo: 'Missão de serviço' })
    assert.equal(p.status, 200, p.body.erro)
    assert.match((await portal('ana').get('/api/portal/notificacoes')).body.lista[0].titulo, /Prazo alargado: Ficha curta/)

    // a 24 h do prazo original: só o Bruno é lembrado
    await amb.contentor.servicos.comunicacao.lembrarPrazos()
    assert.ok((await portal('bruno').get('/api/portal/notificacoes')).body.lista.some((n) => n.tipo === 'prazo'))
    assert.ok(!(await portal('ana').get('/api/portal/notificacoes')).body.lista.some((n) => n.tipo === 'prazo'))

    relogio.avancar(2 * 24 * 60) // passou o prazo original
    assert.equal((await portal('bruno').post(`/api/portal/trabalhos/${t.id}/entrega`).attach('ficheiro', ...anexo('b.pdf'))).status, 400)
    const ana = await portal('ana').post(`/api/portal/trabalhos/${t.id}/entrega`).attach('ficheiro', ...anexo('a.pdf'))
    assert.equal(ana.status, 201, ana.body.erro)
    assert.equal(ana.body.atrasada, false)
    const vista = (await portal('ana').get(`/api/portal/cadeiras/${cadeira.id}`)).body.trabalhos.find((x) => x.id === t.id)
    assert.deepEqual([vista.prorrogado, vista.prazo, vista.estado], [true, '2026-11-15T08:00:00.000Z', 'aberto'])
    const lista = (await portal('prof').get(`/api/portal/trabalhos/${t.id}/entregas`)).body
    assert.equal(lista.linhas.find((l) => l.estudante.id === contas.ana.id).prorrogacao.motivo, 'Missão de serviço')
    // retirar
    assert.equal((await portal('prof').put(url).send({ estudanteId: contas.ana.id, prazo: null })).body.prorrogacao, null)
  })
})
