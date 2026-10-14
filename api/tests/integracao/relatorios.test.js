import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, relogioFalso } from '../apoio/ambiente.js'

const NOVA = 'Portal2026segura'
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')

describe('relatórios (registos e participação) e importação de estudantes', () => {
  let amb, relogio, cadeira, turma, sec
  const contas = {}
  const tokens = {}
  const portal = (quem) => amb.com(tokens[quem])

  before(async () => {
    relogio = relogioFalso('2026-11-09T09:00:00Z')
    amb = await criarAmbiente({ relogio })
    const admin = await amb.entrar()
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Estado-Maior' })
    const s = await amb.criarUtilizador('secretaria')
    sec = () => amb.com(s.token)
    turma = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM A' })).body
    contas.prof = (await sec().post('/api/admin/academico/contas').send({ tipo: 'docente', nome: 'Docente Prof Teste', email: 'prof@esgfaa.gov.ao' })).body
    for (const k of ['ana', 'bruno']) contas[k] = (await sec().post(`/api/admin/academico/turmas/${turma.id}/matricula-nova`).send({ nome: `Estudante ${k} Teste`, email: `${k}@esgfaa.gov.ao` })).body
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

  it('importação de estudantes: pré-visualização, depois cria contas e matricula', async () => {
    const outra = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM B' })).body
    const linhas = [
      { nome: 'Cap. Carlos Mendes', email: 'carlos.mendes@esgfaa.gov.ao', posto: 'Capitão', nip: '12345' },
      { nome: 'Estudante ana Teste', email: 'ANA@esgfaa.gov.ao' }, // já existe: só matricula
      { nome: 'Sem e-mail da Escola', email: 'alguem@gmail.com' },
      { nome: 'Cap. Carlos Repetido', email: 'carlos.mendes@esgfaa.gov.ao' },
      { nome: 'Docente', email: 'prof@esgfaa.gov.ao' },
      { nome: 'Abc', email: 'curto@esgfaa.gov.ao' },
    ]
    const sim = (await sec().post(`/api/admin/academico/turmas/${outra.id}/importar`).send({ linhas })).body
    assert.equal(sim.simulacao, true)
    assert.deepEqual(sim.linhas.map((l) => l.acao), ['criar', 'matricular', 'erro', 'erro', 'erro', 'erro'])
    assert.match(sim.linhas[3].erro, /repetido/)
    assert.match(sim.linhas[4].erro, /docente/)
    assert.equal((await sec().get(`/api/admin/academico/turmas/${outra.id}`)).body.matriculas.length, 0) // nada gravado

    const r = (await sec().post(`/api/admin/academico/turmas/${outra.id}/importar`).send({ linhas, simular: false })).body
    assert.deepEqual(r.resumo, { criar: 1, matricular: 1, ja_matriculado: 0, erro: 4 })
    assert.match(r.linhas[0].numero, /^E2026-/)
    const t = (await sec().get(`/api/admin/academico/turmas/${outra.id}`)).body
    assert.deepEqual(t.matriculas.map((m) => m.estudante.email).sort(), ['ana@esgfaa.gov.ao', 'carlos.mendes@esgfaa.gov.ao'])
    // repetir: já matriculados
    const de = (await sec().post(`/api/admin/academico/turmas/${outra.id}/importar`).send({ linhas: linhas.slice(0, 2), simular: false })).body
    assert.deepEqual(de.resumo, { criar: 0, matricular: 0, ja_matriculado: 2, erro: 0 })
    // a conta nova entra com o e-mail como palavra-passe
    assert.equal((await amb.http().post('/api/portal/entrar').send({ email: 'carlos.mendes@esgfaa.gov.ao', senha: 'carlos.mendes@esgfaa.gov.ao' })).status, 200)
    assert.equal((await amb.com(tokens.ana).post(`/api/admin/academico/turmas/${outra.id}/importar`).send({ linhas })).status, 401)
  })
})
