import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, relogioFalso } from '../apoio/ambiente.js'

const NOVA = 'Portal2026segura'

describe('painel de indicadores da Administração Escolar', () => {
  let amb, relogio, sec, turma, cadeira
  const contas = {}
  const tokens = {}

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
    await sec().post(`/api/admin/academico/turmas/${turma.id}/cadeiras`).send({ codigo: 'GEO103', nome: 'Geopolítica' }) // sem docente
    await sec().put(`/api/admin/academico/cadeiras/${cadeira.id}/docentes`).send({ docentes: [{ docenteId: contas.prof.id, papel: 'regente' }] })
    for (const k of ['prof', 'ana']) {
      const email = `${k}@esgfaa.gov.ao`
      const r = await amb.http().post('/api/portal/entrar').send({ email, senha: email })
      tokens[k] = (await amb.com(r.body.token).put('/api/portal/eu/senha').send({ atual: email, nova: NOVA })).body.token
    }
  })
  after(() => amb.fechar())

  it('turmas, cadeiras, estudantes em risco e pautas em atraso', async () => {
    const prof = amb.com(tokens.prof)
    // 1.ª prova a 1 de novembro; só a Ana tem nota (negativa); o Bruno nunca entrou e faltou
    await prof.post(`/api/portal/cadeiras/${cadeira.id}/eventos`).send({ tipo: 'p1', data: '2026-10-20', inicio: '08:00' })
    await prof.put(`/api/portal/cadeiras/${cadeira.id}/pauta`).send({ linhas: [{ estudanteId: contas.ana.id, p1: 8 }] })
    for (const [data, bruno] of [['2026-11-02', 'falta'], ['2026-11-04', 'falta'], ['2026-11-06', 'presente']]) {
      await prof.post(`/api/portal/cadeiras/${cadeira.id}/aulas`).send({ data, sumario: 'Aula', presencas: [{ estudanteId: contas.ana.id, estado: 'presente' }, { estudanteId: contas.bruno.id, estado: bruno }] })
    }

    assert.equal((await amb.com(tokens.ana).get('/api/admin/academico/indicadores')).status, 401)
    const r = await sec().get('/api/admin/academico/indicadores')
    assert.equal(r.status, 200, r.body.erro)
    const d = r.body
    assert.equal(d.anoLetivo, '2026/2027')
    assert.deepEqual([d.geral.turmas, d.geral.estudantes, d.geral.cadeiras, d.geral.cadeirasSemDocente, d.geral.emRisco], [1, 2, 2, 1, 2])
    const est = d.cadeiras.find((c) => c.codigo === 'EST101')
    assert.deepEqual([est.assiduidade, est.emCurso, est.docentes], [66.5, 2, ['Docente Prof Teste']])
    const ana = d.risco.find((x) => x.estudante.id === contas.ana.id)
    assert.deepEqual(ana.motivos.map((m) => m.tipo), ['nota'])
    const bruno = d.risco.find((x) => x.estudante.id === contas.bruno.id)
    assert.deepEqual(bruno.motivos.map((m) => m.tipo), ['faltas', 'acesso'])
    assert.equal(d.risco[0].estudante.id, contas.bruno.id) // mais motivos primeiro
    assert.deepEqual(d.atrasos.map((a) => [a.cadeira.codigo, a.componente, a.faltam, a.diasAtraso]), [['EST101', 'p1', 1, 19]])
    assert.equal(d.turmas[0].emRisco, 2)
  })
})
