import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente } from '../apoio/ambiente.js'

describe('Passagem de ano (turma do 1.º ano → turma do 2.º ano)', () => {
  let amb, sec, ano1, ano2, final, cadeira
  const contas = {}
  before(async () => {
    amb = await criarAmbiente()
    const admin = await amb.entrar()
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Estado-Maior' })
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Comando' })
    const s = await amb.criarUtilizador('administrador')
    sec = () => amb.com(s.token)
    ano1 = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM 1A', anoCurricular: 1 })).body
    ano2 = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2027/2028', nome: 'CEM 2A', anoCurricular: 2 })).body
    final = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-comando', anoLetivo: '2027/2028', nome: 'CC 2A', anoCurricular: 2 })).body
    for (const k of ['ana', 'bruno', 'carla']) contas[k] = (await amb.registarEMatricular(sec(), ano1.id, { nome: `Estudante ${k} Teste`, email: `${k}@esgfaa.gov.ao` })).body
    cadeira = (await sec().post(`/api/admin/academico/turmas/${ano1.id}/cadeiras`).send({ codigo: 'EST101', nome: 'Estratégia' })).body
    await sec().put(`/api/admin/academico/cadeiras/${cadeira.id}/pauta`).send({ linhas: [
      { estudanteId: contas.ana.id, p1: 15, p2: 16 }, // dispensada
      { estudanteId: contas.bruno.id, p1: 8, p2: 9, exame: 5, recurso: 6 }, // reprovado
      { estudanteId: contas.carla.id, p1: 12, p2: 12 }, // à espera do exame
    ] }).expect(200)
  })
  after(() => amb.fechar())

  it('simula: transita quem tem tudo aprovado; não transita quem reprovou; fica por decidir quem tem pautas abertas', async () => {
    const r = (await sec().post(`/api/admin/academico/turmas/${ano1.id}/transicao`).send({ destinoId: ano2.id }).expect(200)).body
    assert.equal(r.executada, false)
    assert.deepEqual(r.resumo, { transita: 1, nao_transita: 1, por_decidir: 1 })
    const por = Object.fromEntries(r.linhas.map((l) => [l.estudante.id, l]))
    assert.equal(por[contas.ana.id].decisao, 'transita')
    assert.deepEqual(por[contas.bruno.id].pendentes, ['EST101 (reprovada)'])
    assert.deepEqual(por[contas.carla.id].pendentes, ['EST101 (falta o exame)'])
    // a simulação não matricula ninguém
    assert.equal((await sec().get(`/api/admin/academico/turmas/${ano2.id}`)).body.matriculas?.length ?? 0, 0)
  })

  it('destino errado (outro curso ou ano) é recusado', async () => {
    assert.equal((await sec().post(`/api/admin/academico/turmas/${ano1.id}/transicao`).send({ destinoId: final.id })).status, 400)
    assert.equal((await sec().post(`/api/admin/academico/turmas/${ano2.id}/transicao`).send({ destinoId: ano1.id })).status, 400)
  })

  it('executa: matricula no 2.º ano quem transita e conclui a matrícula do 1.º ano; repetir não duplica', async () => {
    await sec().post(`/api/admin/academico/turmas/${ano1.id}/transicao`).send({ destinoId: ano2.id, executar: true }).expect(200)
    await sec().post(`/api/admin/academico/turmas/${ano1.id}/transicao`).send({ destinoId: ano2.id, executar: true }).expect(200)
    const t2 = (await sec().get(`/api/admin/academico/turmas/${ano2.id}`)).body
    assert.deepEqual(t2.matriculas.map((m) => m.estudante.id), [contas.ana.id])
    const t1 = (await sec().get(`/api/admin/academico/turmas/${ano1.id}`)).body
    const estado = Object.fromEntries(t1.matriculas.map((m) => [m.estudante.id, m.estado]))
    assert.deepEqual([estado[contas.ana.id], estado[contas.bruno.id], estado[contas.carla.id]], ['concluida', 'ativa', 'ativa'])
    // as notas do 1.º ano continuam na pauta antiga (histórico)
    const pauta = (await sec().get(`/api/admin/academico/cadeiras/${cadeira.id}/pauta`)).body
    assert.ok(pauta.linhas.some((l) => l.estudante.id === contas.ana.id && l.situacao === 'dispensado'))
  })
})
