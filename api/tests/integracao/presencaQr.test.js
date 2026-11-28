import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, relogioFalso } from '../apoio/ambiente.js'

const NOVA = 'Portal2026segura'

// presenças rápidas: o docente mostra o código (QR) da aula e cada estudante fica presente ao lê-lo
describe('Presença por QR (código da aula)', () => {
  let amb, relogio, cadeira
  const contas = {}
  const tokens = {}
  const portal = (k) => amb.com(tokens[k])
  before(async () => {
    relogio = relogioFalso('2026-11-09T09:00:00Z')
    amb = await criarAmbiente({ relogio })
    const admin = await amb.entrar()
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Estado-Maior' })
    const sec = amb.com((await amb.criarUtilizador('administrador')).token)
    const turma = (await sec.post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM QR' })).body
    const outra = (await sec.post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM Outra' })).body
    contas.prof = (await sec.post('/api/admin/academico/contas').send({ tipo: 'docente', nome: 'Docente Prof Teste', email: 'prof@esgfaa.gov.ao' })).body
    for (const k of ['ana', 'bruno']) contas[k] = (await amb.registarEMatricular(sec, turma.id, { nome: `Estudante ${k} Teste`, email: `${k}@esgfaa.gov.ao` })).body
    contas.rui = (await amb.registarEMatricular(sec, outra.id, { nome: 'Estudante rui Teste', email: 'rui@esgfaa.gov.ao' })).body
    cadeira = (await sec.post(`/api/admin/academico/turmas/${turma.id}/cadeiras`).send({ codigo: 'EST101', nome: 'Estratégia' })).body
    await sec.put(`/api/admin/academico/cadeiras/${cadeira.id}/docentes`).send({ docentes: [{ docenteId: contas.prof.id, papel: 'regente' }] })
    for (const k of ['prof', 'ana', 'rui']) {
      const email = `${k}@esgfaa.gov.ao`
      const r = await amb.http().post('/api/portal/entrar').send({ email, senha: amb.senhaInicial(email) })
      tokens[k] = (await amb.com(r.body.token).put('/api/portal/eu/senha').send({ atual: amb.senhaInicial(email), nova: NOVA })).body.token
    }
  })
  after(() => amb.fechar())

  it('aula com todos em falta; a Ana lê o código e fica presente; quem não é da cadeira não; o código caduca', async () => {
    const aula = (await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/aulas`).send({ data: '2026-11-09', sumario: 'Aula 1', presencas: [{ estudanteId: contas.ana.id, estado: 'falta' }, { estudanteId: contas.bruno.id, estado: 'falta' }] }).expect(201)).body
    assert.equal((await portal('ana').post(`/api/portal/aulas/${aula.id}/codigo`)).status >= 400, true) // o estudante não abre o código
    const { codigo } = (await portal('prof').post(`/api/portal/aulas/${aula.id}/codigo`).expect(200)).body
    assert.match(codigo, /^\d{6}$/)
    assert.equal((await portal('ana').post('/api/portal/presencas/codigo').send({ codigo: codigo === '000000' ? '111111' : '000000' })).status, 400)
    const r = await portal('ana').post('/api/portal/presencas/codigo').send({ codigo }).expect(200)
    assert.equal(r.body.cadeira.codigo, 'EST101')
    assert.equal((await portal('rui').post('/api/portal/presencas/codigo').send({ codigo })).status, 403)
    assert.equal((await portal('prof').post('/api/portal/presencas/codigo').send({ codigo })).status, 403)
    const aulas = (await portal('prof').get(`/api/portal/cadeiras/${cadeira.id}/aulas`)).body.aulas
    assert.deepEqual(aulas[0].presencas, { [contas.ana.id]: 'presente', [contas.bruno.id]: 'falta' })
    relogio.avancar(16) // 16 minutos depois
    assert.equal((await portal('ana').post('/api/portal/presencas/codigo').send({ codigo })).status, 400)
  })
})
