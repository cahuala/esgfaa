import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, relogioFalso } from '../apoio/ambiente.js'

const NOVA = 'Portal2026segura'

describe('pesquisa global e calendário iCal', () => {
  let amb, cadeira, outra
  const contas = {}
  const tokens = {}
  const portal = (quem) => amb.com(tokens[quem])

  before(async () => {
    amb = await criarAmbiente({ relogio: relogioFalso('2026-11-09T09:00:00Z') })
    const admin = await amb.entrar()
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Estado-Maior' })
    const s = await amb.criarUtilizador('secretaria')
    const sec = () => amb.com(s.token)
    const turma = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM A' })).body
    const t2 = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM B' })).body
    contas.prof = (await sec().post('/api/admin/academico/contas').send({ tipo: 'docente', nome: 'Docente Prof Teste', email: 'prof@esgfaa.gov.ao' })).body
    contas.ana = (await sec().post(`/api/admin/academico/turmas/${turma.id}/matricula-nova`).send({ nome: 'Estudante ana Teste', email: 'ana@esgfaa.gov.ao' })).body
    cadeira = (await sec().post(`/api/admin/academico/turmas/${turma.id}/cadeiras`).send({ codigo: 'EST101', nome: 'Estratégia' })).body
    outra = (await sec().post(`/api/admin/academico/turmas/${t2.id}/cadeiras`).send({ codigo: 'GEO103', nome: 'Geopolítica' })).body
    for (const c of [cadeira, outra]) await sec().put(`/api/admin/academico/cadeiras/${c.id}/docentes`).send({ docentes: [{ docenteId: contas.prof.id, papel: 'regente' }] })
    for (const k of ['prof', 'ana']) {
      const email = `${k}@esgfaa.gov.ao`
      const r = await amb.http().post('/api/portal/entrar').send({ email, senha: email })
      tokens[k] = (await amb.com(r.body.token).put('/api/portal/eu/senha').send({ atual: email, nova: NOVA })).body.token
    }
  })
  after(() => amb.fechar())

  it('pesquisa: encontra em várias fontes, só nas cadeiras próprias e sem o que está escondido', async () => {
    const prof = portal('prof')
    await prof.post(`/api/portal/cadeiras/${cadeira.id}/materiais`).send({ tipo: 'pagina', titulo: 'Guia', conteudo: '<p>O conceito de <b>fricção</b> em Clausewitz.</p>' })
    const escondido = (await prof.post(`/api/portal/cadeiras/${cadeira.id}/trabalhos`).send({ titulo: 'Ensaio sobre a fricção', prazo: '2026-11-30T23:59:00Z' })).body
    await prof.put('/api/portal/atividades/restricoes').send({ tipo: 'trabalho', id: escondido.id, visivel: false })
    await prof.post(`/api/portal/cadeiras/${cadeira.id}/glossario`).send({ termo: 'Fricção', definicao: 'Dificuldades imprevistas na guerra.' })
    await portal('ana').post(`/api/portal/cadeiras/${cadeira.id}/forum`).send({ titulo: 'Dúvida', texto: 'A fricção aplica-se à logística?' })
    await prof.post(`/api/portal/cadeiras/${outra.id}/materiais`).send({ tipo: 'pagina', titulo: 'Outra turma', conteudo: '<p>fricção também aqui</p>' })

    assert.equal((await portal('ana').get('/api/portal/pesquisa?q=f')).status, 400)
    const r = (await portal('ana').get(`/api/portal/pesquisa?q=${encodeURIComponent('fricção')}`)).body
    assert.deepEqual(r.resultados.map((x) => x.tipo).sort(), ['forum', 'glossario', 'material'])
    const guia = r.resultados.find((x) => x.tipo === 'material')
    assert.match(guia.excerto, /O conceito de fricção em Clausewitz/)
    assert.equal(guia.ligacao, `/cadeiras/${cadeira.id}?atividade=material-${guia.id}`)
    // o docente vê também o trabalho escondido e a outra cadeira
    const d = (await prof.get(`/api/portal/pesquisa?q=${encodeURIComponent('FRICÇÃO')}`)).body
    assert.equal(d.resultados.filter((x) => x.tipo === 'material').length, 2)
    assert.ok(d.resultados.some((x) => x.tipo === 'trabalho'))
  })

  it('calendário iCal: endereço secreto, renovável, com provas e prazos', async () => {
    await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/eventos`).send({ tipo: 'p1', data: '2026-11-20', inicio: '09:00', fim: '11:00', local: 'Anfiteatro A' })
    await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/trabalhos`).send({ titulo: 'Relatório final', prazo: '2026-12-10T22:59:00Z' })
    const { token } = (await portal('ana').get('/api/portal/eu/calendario-ical')).body
    assert.match(token, /^[0-9a-f]{48}$/)
    assert.equal((await portal('ana').get('/api/portal/eu/calendario-ical')).body.token, token) // o mesmo
    const r = await amb.http().get(`/api/publico/calendario/${token}.ics`)
    assert.equal(r.status, 200)
    assert.match(r.headers['content-type'], /text\/calendar/)
    const ics = r.text
    assert.ok(ics.includes('DTSTART:20261120T080000Z'))
    assert.ok(ics.includes('SUMMARY:1.ª Prova — Estratégia'))
    assert.ok(ics.includes('SUMMARY:Entrega: Relatório final — Estratégia'))
    assert.ok(!ics.includes('Ensaio sobre a fricção')) // escondido
    // renovar invalida o anterior
    const novo = (await portal('ana').post('/api/portal/eu/calendario-ical')).body.token
    assert.notEqual(novo, token)
    assert.equal((await amb.http().get(`/api/publico/calendario/${token}.ics`)).status, 404)
    assert.equal((await amb.http().get('/api/publico/calendario/nada')).status, 404)
  })
})
