import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente } from '../apoio/ambiente.js'

// o horário da turma gerado automaticamente: sem choques com o docente noutra turma; simula e depois grava
describe('Horário gerado automaticamente', () => {
  let amb, sec, turma, outra, prof
  before(async () => {
    amb = await criarAmbiente()
    const admin = await amb.entrar()
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Estado-Maior' })
    sec = amb.com((await amb.criarUtilizador('administrador')).token)
    turma = (await sec.post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM H' })).body
    outra = (await sec.post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM Outra' })).body
    prof = (await sec.post('/api/admin/academico/contas').send({ tipo: 'docente', nome: 'Docente Prof Teste', email: 'prof@esgfaa.gov.ao' })).body
    for (const [t, codigo, horas] of [[turma, 'EST', 30], [turma, 'GEO', 15], [outra, 'HIS', 15]]) {
      const c = (await sec.post(`/api/admin/academico/turmas/${t.id}/cadeiras`).send({ codigo, nome: codigo, periodo: '1', horas })).body
      await sec.put(`/api/admin/academico/cadeiras/${c.id}/docentes`).send({ docentes: [{ docenteId: prof.id, papel: 'regente', horas }] })
      if (codigo === 'HIS') await sec.post(`/api/admin/academico/cadeiras/${c.id}/horarios`).send({ diaSemana: 1, inicio: '08:30', fim: '09:20', sala: 'Sala 1' }).expect(201)
    }
  })
  after(() => amb.fechar())

  it('simula (nada gravado), respeita o docente na outra turma, e grava', async () => {
    const url = `/api/admin/academico/turmas/${turma.id}/horario/gerar`
    const s = (await sec.post(url).send({ tempos: ['08:30-09:20', '09:30-10:20'], salas: ['Sala 1'] }).expect(200)).body
    assert.equal(s.aplicado, false)
    assert.deepEqual(s.semLugar, [])
    assert.ok(s.horario.length >= 2)
    assert.ok(!s.horario.some((h) => h.diaSemana === 1 && h.inicio === '08:30')) // o docente está na outra turma
    assert.deepEqual(s.horario[0].docentes, ['Docente Prof Teste'])
    const t1 = (await sec.get(`/api/admin/academico/turmas/${turma.id}`)).body
    assert.equal(t1.cadeiras.flatMap((c) => c.horarios).length, 0)
    const g = (await sec.post(url).send({ tempos: ['08:30-09:20', '09:30-10:20'], salas: ['Sala 1'], aplicar: true }).expect(200)).body
    const t2 = (await sec.get(`/api/admin/academico/turmas/${turma.id}`)).body
    assert.equal(t2.cadeiras.flatMap((c) => c.horarios).length, g.horario.length)
    // outra vez sem substituir: as cadeiras já têm horário, não se marca nada
    assert.equal((await sec.post(url).send({ tempos: ['08:30-09:20'], aplicar: true }).expect(200)).body.horario.length, 0)
    assert.equal((await sec.post(url).send({ tempos: ['8h30'] })).status, 400)
  })
})
