import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, relogioFalso } from '../apoio/ambiente.js'

const NOVA = 'Portal2026segura'
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')

describe('relatórios: registos e participação', () => {
  let amb, relogio, cadeira, turma, sec
  const contas = {}
  const tokens = {}
  const portal = (quem) => amb.com(tokens[quem])

  before(async () => {
    relogio = relogioFalso('2026-11-09T09:00:00Z')
    amb = await criarAmbiente({ relogio })
    const admin = await amb.entrar()
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Estado-Maior' })
    const s = await amb.criarUtilizador('administrador')
    sec = () => amb.com(s.token)
    turma = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM A' })).body
    contas.prof = (await sec().post('/api/admin/academico/contas').send({ tipo: 'docente', nome: 'Docente Prof Teste', email: 'prof@esgfaa.gov.ao' })).body
    for (const k of ['ana', 'bruno']) contas[k] = (await amb.registarEMatricular(sec(), turma.id, { nome: `Estudante ${k} Teste`, email: `${k}@esgfaa.gov.ao` })).body
    cadeira = (await sec().post(`/api/admin/academico/turmas/${turma.id}/cadeiras`).send({ codigo: 'EST101', nome: 'Estratégia' })).body
    await sec().put(`/api/admin/academico/cadeiras/${cadeira.id}/docentes`).send({ docentes: [{ docenteId: contas.prof.id, papel: 'regente' }] })
    for (const k of ['prof', 'ana', 'bruno']) {
      const email = `${k}@esgfaa.gov.ao`
      const r = await amb.http().post('/api/portal/entrar').send({ email, senha: email })
      tokens[k] = (await amb.com(r.body.token).put('/api/portal/eu/senha').send({ atual: email, nova: NOVA })).body.token
    }
  })
  after(() => amb.fechar())

  it('registos de quem abriu o quê; participação por estudante e por atividade', async () => {
    const doc = (await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/materiais`).field('titulo', 'Sebenta').field('tipo', 'ficheiro')
      .attach('ficheiro', PDF, { filename: 'sebenta.pdf', contentType: 'application/pdf' })).body
    const t = (await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/trabalhos`).send({ titulo: 'Ensaio', prazo: '2026-11-30T23:59:00Z' })).body

    await portal('ana').get(`/api/portal/cadeiras/${cadeira.id}`)
    await portal('ana').get(`/api/portal/cadeiras/${cadeira.id}`) // repetido dentro de 5 minutos: não conta
    await portal('ana').get(`/api/portal/ficheiros/${doc.ficheiroId}`)
    assert.equal((await portal('ana').post(`/api/portal/cadeiras/${cadeira.id}/vistas`).send({ tipo: 'trabalho', id: t.id })).body.registado, true)
    assert.equal((await portal('ana').post(`/api/portal/cadeiras/${cadeira.id}/vistas`).send({ tipo: 'trabalho', id: 999999 })).status, 404)
    await portal('ana').post(`/api/portal/trabalhos/${t.id}/entrega`).attach('ficheiro', PDF, { filename: 'e.pdf', contentType: 'application/pdf' })
    await portal('ana').post(`/api/portal/cadeiras/${cadeira.id}/forum`).send({ titulo: 'Dúvida sobre o ensaio', texto: 'Quantas páginas?' })
    relogio.avancar(60 * 24 * 3)
    await portal('bruno').get(`/api/portal/cadeiras/${cadeira.id}`)
    await portal('prof').get(`/api/portal/cadeiras/${cadeira.id}`) // o docente não fica registado

    assert.equal((await portal('ana').get(`/api/portal/cadeiras/${cadeira.id}/relatorios/participacao`)).status, 403)
    const p = (await portal('prof').get(`/api/portal/cadeiras/${cadeira.id}/relatorios/participacao`)).body
    const ana = p.estudantes.find((e) => e.estudante.id === contas.ana.id)
    const bruno = p.estudantes.find((e) => e.estudante.id === contas.bruno.id)
    assert.deepEqual([ana.acessos, ana.atividadesVistas, ana.entregas, ana.forum, ana.diasSemAcesso], [3, 2, 1, 1, 3])
    assert.deepEqual([bruno.acessos, bruno.atividadesVistas, bruno.entregas, bruno.diasSemAcesso], [1, 0, 0, 0])
    const sebenta = p.atividades.find((a) => a.tipo === 'material' && a.id === doc.id)
    assert.deepEqual([sebenta.titulo, sebenta.vistas, sebenta.estudantes], ['Sebenta', 1, 1])

    const todos = (await portal('prof').get(`/api/portal/cadeiras/${cadeira.id}/relatorios/registos`)).body
    assert.deepEqual(todos.map((r) => [r.estudante.nome, r.titulo]), [
      ['Estudante bruno Teste', 'Página da cadeira'], ['Estudante ana Teste', 'Ensaio'], ['Estudante ana Teste', 'Sebenta'], ['Estudante ana Teste', 'Página da cadeira'],
    ])
    const soBruno = (await portal('prof').get(`/api/portal/cadeiras/${cadeira.id}/relatorios/registos?estudanteId=${contas.bruno.id}`)).body
    assert.equal(soBruno.length, 1)
    const antes = (await portal('prof').get(`/api/portal/cadeiras/${cadeira.id}/relatorios/registos?antesDe=${todos[1].id}`)).body
    assert.equal(antes.length, 2)
  })
})
