import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, relogioFalso } from '../apoio/ambiente.js'

const NOVA = 'Portal2026segura'

describe('inquéritos institucionais de satisfação', () => {
  let amb, relogio, escola, turmaA, turmaB
  const tokens = {}
  const portal = (quem) => amb.com(tokens[quem])

  before(async () => {
    relogio = relogioFalso('2026-11-09T09:00:00Z')
    amb = await criarAmbiente({ relogio })
    const admin = await amb.entrar()
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Estado-Maior' })
    const tudo = amb.com((await amb.criarUtilizador('administrador')).token)
    escola = amb.com((await amb.criarUtilizador('secretaria')).token)
    turmaA = (await tudo.post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM A' })).body
    turmaB = (await tudo.post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM B' })).body
    await amb.registarEMatricular(tudo, turmaA.id, { nome: 'Estudante ana Teste', email: 'ana@esgfaa.gov.ao' })
    await amb.registarEMatricular(tudo, turmaA.id, { nome: 'Estudante bruno Teste', email: 'bruno@esgfaa.gov.ao' })
    await amb.registarEMatricular(tudo, turmaB.id, { nome: 'Estudante carla Teste', email: 'carla@esgfaa.gov.ao' })
    await tudo.post('/api/admin/academico/contas').send({ tipo: 'docente', nome: 'Docente Prof Teste', email: 'prof@esgfaa.gov.ao' })
    for (const k of ['ana', 'bruno', 'carla', 'prof']) {
      const email = `${k}@esgfaa.gov.ao`
      const r = await amb.http().post('/api/portal/entrar').send({ email, senha: amb.senhaInicial(email) })
      tokens[k] = (await amb.com(r.body.token).put('/api/portal/eu/senha').send({ atual: amb.senhaInicial(email), nova: NOVA })).body.token
    }
  })
  after(() => amb.fechar())

  it('preparar a partir de um modelo, lançar só para a turma A, responder anonimamente e ver resultados', async () => {
    const { modelos } = (await escola.get('/api/admin/academico/satisfacao')).body
    const m = modelos.servicos
    assert.equal((await escola.post('/api/admin/academico/satisfacao').send({ ...m, perguntas: [] })).status, 400)
    const i = (await escola.post('/api/admin/academico/satisfacao').send({ ...m, publico: 'estudantes', turmaIds: [turmaA.id], fecha: '2026-11-30T22:59:00Z' })).body
    assert.equal(i.estado, 'rascunho')
    // em rascunho ninguém o vê
    assert.deepEqual((await portal('ana').get('/api/portal/inqueritos-escola')).body, [])
    // lançar fica pedido ao Comandante; só com a aprovação chega ao portal
    const pedido = (await escola.post(`/api/admin/academico/satisfacao/${i.id}/lancar`)).body
    assert.deepEqual([pedido.estado, pedido.aprovacao.estado], ['rascunho', 'pendente'])
    assert.equal((await escola.post(`/api/admin/academico/satisfacao/${i.id}/lancar`)).status, 409)
    assert.deepEqual((await portal('ana').get('/api/portal/inqueritos-escola')).body, [])
    await amb.aprovar('inqueritos', i.id)
    const l = (await escola.get('/api/admin/academico/satisfacao')).body.inqueritos.find((x) => x.id === i.id)
    assert.deepEqual([l.estado, l.destinatarios, l.aprovacao], ['aberto', 2, null])
    assert.equal((await escola.post(`/api/admin/academico/satisfacao/${i.id}/lancar`)).status, 409)
    assert.equal((await escola.put(`/api/admin/academico/satisfacao/${i.id}`).send({ titulo: 'Outro' })).status, 409)
    // a Ana e o Bruno (turma A) veem; a Carla (turma B) e o docente não
    assert.equal((await portal('ana').get('/api/portal/inqueritos-escola')).body.length, 1)
    assert.deepEqual((await portal('carla').get('/api/portal/inqueritos-escola')).body, [])
    assert.equal((await portal('carla').get(`/api/portal/inqueritos-escola/${i.id}`)).status, 404)
    assert.equal((await portal('prof').get(`/api/portal/inqueritos-escola/${i.id}`)).status, 404)
    // aviso chegou
    const n = (await portal('ana').get('/api/portal/notificacoes')).body
    assert.ok((n.lista || n).some((x) => x.tipo === 'inquerito'))

    // o aviso do site («tem inquéritos por responder»): a Ana tem este; a Carla nada
    const pend = (await portal('ana').get('/api/portal/inqueritos-pendentes')).body
    assert.deepEqual([pend.escola.map((x) => x.id), pend.avaliacoes], [[i.id], []])
    assert.deepEqual((await portal('carla').get('/api/portal/inqueritos-pendentes')).body, { escola: [], avaliacoes: [] })

    const respostas = (escalas, escolha, texto) => ({ 0: escalas[0], 1: escalas[1], 2: escalas[2], 3: escalas[3], 4: escalas[4], 5: [escolha], 6: texto })
    assert.equal((await portal('ana').post(`/api/portal/inqueritos-escola/${i.id}/respostas`).send({ respostas: { 0: 5 } })).status, 400)
    const v = (await portal('ana').post(`/api/portal/inqueritos-escola/${i.id}/respostas`).send({ respostas: respostas([5, 4, 3, 5, 4], 1, 'Mais livros') })).body
    assert.deepEqual([v.respondido, v.podeResponder], [true, false])
    assert.equal((await portal('ana').post(`/api/portal/inqueritos-escola/${i.id}/respostas`).send({ respostas: respostas([1, 1, 1, 1, 1], 0, '') })).status, 409)
    // depois de responder, o aviso desaparece
    assert.deepEqual((await portal('ana').get('/api/portal/inqueritos-pendentes')).body.escola, [])
    await portal('bruno').post(`/api/portal/inqueritos-escola/${i.id}/respostas`).send({ respostas: respostas([3, 2, 3, 3, 4], 1, '') })

    const r = (await escola.get(`/api/admin/academico/satisfacao/${i.id}/resultados`)).body
    assert.deepEqual([r.resultados.total, r.resultados.perguntas[0].media, r.resultados.perguntas[5].contagens[1], r.resultados.perguntas[6].comentarios], [2, 4, 2, ['Mais livros']])
    // anónimo: as respostas não guardam quem respondeu
    const linhas = await amb.contentor.prisma.respostaInstitucional.findMany({ where: { inqueritoId: i.id } })
    assert.ok(linhas.every((x) => !('contaId' in x)))

    // fechado: já não se responde e sai da lista
    relogio.avancar(60 * 24 * 30)
    assert.deepEqual((await portal('bruno').get('/api/portal/inqueritos-escola')).body, [])
    assert.equal((await portal('carla').post(`/api/portal/inqueritos-escola/${i.id}/respostas`).send({ respostas: {} })).status, 404)
  })

  it('para docentes: só os docentes veem; os estudantes não podem gerir', async () => {
    const i = (await escola.post('/api/admin/academico/satisfacao').send({ titulo: 'Condições de trabalho', publico: 'docentes', fecha: '2027-01-30T22:59:00Z', perguntas: [{ tipo: 'escala', texto: 'Tenho os meios de que preciso.' }] })).body
    await escola.post(`/api/admin/academico/satisfacao/${i.id}/lancar`)
    // recusado com motivo: não chega a ninguém; pode pedir-se de novo
    const cmd = await amb.oComandante()
    assert.equal((await amb.com(cmd.token).post(`/api/admin/publicacoes/inqueritos/${i.id}/decisao`).send({ decisao: 'recusar' })).status, 400)
    await amb.com(cmd.token).post(`/api/admin/publicacoes/inqueritos/${i.id}/decisao`).send({ decisao: 'recusar', motivo: 'Rever as perguntas' }).expect(200)
    assert.deepEqual((await portal('prof').get('/api/portal/inqueritos-escola')).body, [])
    await escola.post(`/api/admin/academico/satisfacao/${i.id}/lancar`).expect(200)
    await amb.aprovar('inqueritos', i.id)
    assert.equal((await portal('prof').get('/api/portal/inqueritos-escola')).body.length, 1)
    assert.deepEqual((await portal('ana').get('/api/portal/inqueritos-escola')).body, [])
    assert.equal((await amb.com(tokens.ana).get('/api/admin/academico/satisfacao')).status, 401)
  })
})
