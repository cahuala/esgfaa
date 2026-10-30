import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, relogioFalso } from '../apoio/ambiente.js'

const NOVA = 'Portal2026segura'

/*
  Prazos de lançamento das notas: a Administração Escolar / Direcção de Ensino define o período de cada
  componente (geral, da turma ou de uma cadeira); fora dele o docente não lança essa componente.
*/
describe('prazos de lançamento das notas', () => {
  let amb, relogio, sec, cadeira, turma, prof, ana
  const pauta = (n) => amb.com(prof).put(`/api/portal/cadeiras/${cadeira.id}/pauta`).send({ linhas: [{ estudanteId: ana.id, ...n }] })

  before(async () => {
    relogio = relogioFalso('2026-11-09T09:00:00Z')
    amb = await criarAmbiente({ relogio })
    await amb.com(await amb.entrar()).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Estado-Maior' })
    const s = await amb.criarUtilizador('administrador')
    sec = () => amb.com(s.token)
    turma = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM A' })).body
    const docente = (await sec().post('/api/admin/academico/contas').send({ tipo: 'docente', nome: 'Docente Prof Teste', email: 'prof@esgfaa.gov.ao' })).body
    ana = (await amb.registarEMatricular(sec(), turma.id, { nome: 'Estudante Ana Teste', email: 'ana@esgfaa.gov.ao' })).body
    cadeira = (await sec().post(`/api/admin/academico/turmas/${turma.id}/cadeiras`).send({ codigo: 'EST101', nome: 'Estratégia', horas: 60 })).body
    await sec().put(`/api/admin/academico/cadeiras/${cadeira.id}/docentes`).send({ docentes: [{ docenteId: docente.id, papel: 'regente' }] })
    const r = await amb.http().post('/api/portal/entrar').send({ email: 'prof@esgfaa.gov.ao', senha: amb.senhaInicial('prof@esgfaa.gov.ao') })
    prof = (await amb.com(r.body.token).put('/api/portal/eu/senha').send({ atual: amb.senhaInicial('prof@esgfaa.gov.ao'), nova: NOVA })).body.token
  })
  after(() => amb.fechar())

  it('sem prazos definidos, o lançamento fica livre', async () => {
    assert.equal((await pauta({ p1: 12 })).status, 200)
  })

  it('prazo geral: dentro lança; fora é recusado com a explicação; o portal mostra o estado', async () => {
    await sec().post('/api/admin/academico/prazos-notas').send({ componente: 'p2', inicio: '2026-11-01', fim: '2026-11-15' }).expect(201)
    await sec().post('/api/admin/academico/prazos-notas').send({ componente: 'exame', inicio: '2026-12-01', fim: '2026-12-10' }).expect(201)
    assert.equal((await pauta({ p1: 12, p2: 14 })).status, 200)
    const r = await pauta({ p1: 12, p2: 14, exame: 15 })
    assert.equal(r.status, 403)
    assert.match(r.body.erro, /Exame está fechado.*abre a 01\/12\/2026/)
    const p = (await amb.com(prof).get(`/api/portal/cadeiras/${cadeira.id}/pauta`)).body
    assert.equal(p.prazos.p2.texto, 'Aberto até 15/11/2026')
    assert.equal(p.prazos.exame.aberto, false)
    assert.equal(p.prazos.p1.livre, true)
    // depois do fim, a 2.ª prova fecha
    relogio.avancar(60 * 24 * 10)
    assert.equal((await pauta({ p1: 12, p2: 16 })).status, 403)
  })

  it('prorrogação para uma cadeira e a Administração Escolar pode sempre corrigir', async () => {
    await sec().post('/api/admin/academico/prazos-notas').send({ componente: 'p2', inicio: '2026-11-18', fim: '2026-11-25', cadeiraId: cadeira.id, descricao: 'Docente em missão' }).expect(201)
    assert.equal((await pauta({ p1: 12, p2: 16 })).status, 200)
    const lista = (await sec().get('/api/admin/academico/prazos-notas')).body
    assert.ok(lista.some((x) => x.ambito === 'Cadeira: EST101 Estratégia'))
    // a Administração Escolar lança o exame mesmo fora do prazo (fica no registo de atividades)
    const adm = await sec().put(`/api/admin/academico/cadeiras/${cadeira.id}/pauta`).send({ linhas: [{ estudanteId: ana.id, p1: 12, p2: 16, exame: 13 }] })
    assert.equal(adm.status, 200, adm.body.erro)
  })
})
