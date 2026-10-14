import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, relogioFalso } from '../apoio/ambiente.js'

const NOVA = 'Portal2026segura'
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')
const anexo = (nome) => [PDF, { filename: nome, contentType: 'application/pdf' }]

describe('fórum completo: anexos, perguntas e respostas, resposta certa, subscrições, pesquisa e edição', () => {
  let amb, relogio, cadeira
  const contas = {}
  const tokens = {}
  const portal = (quem) => amb.com(tokens[quem])
  const avisos = async (quem) => {
    const n = (await portal(quem).get('/api/portal/notificacoes')).body
    return (n.lista || n).filter((x) => x.tipo === 'forum').map((x) => x.titulo)
  }

  before(async () => {
    relogio = relogioFalso('2026-11-09T09:00:00Z')
    amb = await criarAmbiente({ relogio })
    const admin = await amb.entrar()
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Estado-Maior' })
    const s = await amb.criarUtilizador('administrador')
    const sec = () => amb.com(s.token)
    const turma = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM A' })).body
    const outra = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM B' })).body
    contas.prof = (await sec().post('/api/admin/academico/contas').send({ tipo: 'docente', nome: 'Docente Prof Teste', email: 'prof@esgfaa.gov.ao' })).body
    for (const k of ['ana', 'bruno', 'carla']) contas[k] = (await amb.registarEMatricular(sec(), turma.id, { nome: `Estudante ${k} Teste`, email: `${k}@esgfaa.gov.ao` })).body
    contas.zeca = (await amb.registarEMatricular(sec(), outra.id, { nome: 'Estudante zeca Teste', email: 'zeca@esgfaa.gov.ao' })).body
    cadeira = (await sec().post(`/api/admin/academico/turmas/${turma.id}/cadeiras`).send({ codigo: 'EST101', nome: 'Estratégia' })).body
    await sec().put(`/api/admin/academico/cadeiras/${cadeira.id}/docentes`).send({ docentes: [{ docenteId: contas.prof.id, papel: 'regente' }] })
    for (const k of ['prof', 'ana', 'bruno', 'carla', 'zeca']) {
      const email = `${k}@esgfaa.gov.ao`
      const r = await amb.http().post('/api/portal/entrar').send({ email, senha: email })
      tokens[k] = (await amb.com(r.body.token).put('/api/portal/eu/senha').send({ atual: email, nova: NOVA })).body.token
    }
  })
  after(() => amb.fechar())

  it('anexos: até 3, abrem para quem tem a cadeira', async () => {
    const r = await portal('ana').post(`/api/portal/cadeiras/${cadeira.id}/forum`).field('titulo', 'Mapa da operação').field('texto', 'Segue o mapa.').attach('ficheiros', ...anexo('mapa.pdf'))
    assert.equal(r.status, 201, r.body.erro)
    const f = r.body.anexos[0]
    assert.equal(f.nome, 'mapa.pdf')
    assert.equal((await portal('bruno').get(`/api/portal/ficheiros/${f.id}`)).status, 200)
    assert.equal((await portal('zeca').get(`/api/portal/ficheiros/${f.id}`)).status, 404)
    const quatro = await portal('ana').post(`/api/portal/forum/${r.body.id}/respostas`).field('texto', 'Mais').attach('ficheiros', ...anexo('1.pdf')).attach('ficheiros', ...anexo('2.pdf')).attach('ficheiros', ...anexo('3.pdf')).attach('ficheiros', ...anexo('4.pdf'))
    assert.equal(quatro.status, 400)
    const ok = await portal('bruno').post(`/api/portal/forum/${r.body.id}/respostas`).field('texto', 'Obrigado, aqui a legenda.').attach('ficheiros', ...anexo('legenda.pdf'))
    assert.equal(ok.status, 201, ok.body.erro)
    assert.equal(ok.body.respostas[0].anexos[0].nome, 'legenda.pdf')
  })

  it('perguntas e respostas: só o docente abre; o estudante vê as respostas depois de responder', async () => {
    assert.equal((await portal('ana').post(`/api/portal/cadeiras/${cadeira.id}/forum`).send({ tipo: 'pergunta', titulo: 'Pergunta?', texto: 'x' })).status, 403)
    const t = (await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/forum`).send({ tipo: 'pergunta', titulo: 'Qual é o centro de gravidade?', texto: 'Respondam com as vossas palavras.' })).body
    assert.equal(t.tipo, 'pergunta')
    // o docente abriu: todos os estudantes são avisados
    assert.ok((await avisos('carla')).some((x) => /Pergunta no fórum/.test(x)))
    await portal('ana').post(`/api/portal/forum/${t.id}/respostas`).send({ texto: 'A fonte de poder do adversário.' })
    let v = (await portal('bruno').get(`/api/portal/forum/${t.id}`)).body
    assert.deepEqual([v.respostas.length, v.respostasEscondidas], [0, 1])
    v = (await portal('bruno').post(`/api/portal/forum/${t.id}/respostas`).send({ texto: 'O ponto decisivo.' })).body
    assert.equal(v.respostas.length, 2)
    assert.equal((await portal('prof').get(`/api/portal/forum/${t.id}`)).body.respostas.length, 2)
  })

  it('resposta certa: autor do tópico ou docente', async () => {
    const t = (await portal('carla').post(`/api/portal/cadeiras/${cadeira.id}/forum`).send({ titulo: 'Data da prova?', texto: 'Alguém sabe?' })).body
    const v = (await portal('ana').post(`/api/portal/forum/${t.id}/respostas`).send({ texto: 'É a 23 de novembro.' })).body
    const rid = v.respostas[0].id
    assert.equal((await portal('bruno').put(`/api/portal/forum/${t.id}/certa`).send({ respostaId: rid })).status, 403)
    const c = (await portal('carla').put(`/api/portal/forum/${t.id}/certa`).send({ respostaId: rid })).body
    assert.equal(c.respostaCertaId, rid)
    assert.ok((await avisos('ana')).some((x) => /marcada como certa/.test(x)))
    // apagar a resposta certa limpa a marca
    await portal('prof').delete(`/api/portal/forum-respostas/${rid}`)
    assert.equal((await portal('carla').get(`/api/portal/forum/${t.id}`)).body.respostaCertaId, null)
  })

  it('subscrições: seguir o fórum, deixar de seguir um tópico', async () => {
    assert.equal((await portal('carla').get(`/api/portal/cadeiras/${cadeira.id}/forum/subscricao`)).body.seguido, false)
    await portal('carla').put(`/api/portal/cadeiras/${cadeira.id}/forum/subscricao`).send({ ativa: true })
    const t = (await portal('bruno').post(`/api/portal/cadeiras/${cadeira.id}/forum`).send({ titulo: 'Grupo de estudo', texto: 'Quem alinha no sábado?' })).body
    assert.ok((await avisos('carla')).includes('Novo tópico no fórum de Estratégia: Grupo de estudo'))
    assert.ok(!(await avisos('ana')).includes('Novo tópico no fórum de Estratégia: Grupo de estudo'))
    // o Bruno (autor) deixa de seguir: não recebe a resposta da Ana; a Carla recebe pelo fórum
    assert.equal((await portal('bruno').get(`/api/portal/forum/${t.id}`)).body.seguido, true)
    await portal('bruno').put(`/api/portal/forum/${t.id}/subscricao`).send({ ativa: false })
    await portal('ana').post(`/api/portal/forum/${t.id}/respostas`).send({ texto: 'Eu alinho.' })
    assert.ok(!(await avisos('bruno')).some((x) => /respondeu em "Grupo de estudo"/.test(x)))
    assert.ok((await avisos('carla')).some((x) => /respondeu em "Grupo de estudo"/.test(x)))
    assert.equal((await portal('zeca').put(`/api/portal/cadeiras/${cadeira.id}/forum/subscricao`).send({ ativa: true })).status, 404)
  })

  it('pesquisa e edição nos primeiros 30 minutos', async () => {
    const t = (await portal('ana').post(`/api/portal/cadeiras/${cadeira.id}/forum`).send({ titulo: 'Clausewitz e a fricção', texto: 'O conceito de fricção.' })).body
    await portal('bruno').post(`/api/portal/forum/${t.id}/respostas`).send({ texto: 'Ver também Sun Tzu sobre o terreno.' })
    const pesquisa = async (q) => (await portal('carla').get(`/api/portal/cadeiras/${cadeira.id}/forum?q=${encodeURIComponent(q)}`)).body.map((x) => x.titulo)
    assert.deepEqual(await pesquisa('fricção'), ['Clausewitz e a fricção'])
    assert.deepEqual(await pesquisa('sun tzu'), ['Clausewitz e a fricção']) // também nas respostas
    assert.deepEqual(await pesquisa('100%_'), [])
    const e = await portal('ana').put(`/api/portal/forum/${t.id}/texto`).send({ texto: 'O conceito de fricção (corrigido).' })
    assert.equal(e.status, 200, e.body.erro)
    assert.ok(e.body.editadoEm)
    assert.equal((await portal('bruno').put(`/api/portal/forum/${t.id}/texto`).send({ texto: 'Não é meu.' })).status, 403)
    relogio.avancar(31)
    assert.equal((await portal('ana').put(`/api/portal/forum/${t.id}/texto`).send({ texto: 'Tarde.' })).status, 403)
    assert.equal((await portal('prof').put(`/api/portal/forum/${t.id}/texto`).send({ texto: 'Moderado pelo docente.' })).status, 200)
  })
})
