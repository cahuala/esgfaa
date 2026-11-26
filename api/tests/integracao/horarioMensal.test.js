import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente } from '../apoio/ambiente.js'

// horário mensal: dias úteis × tempos; a sessão de cada cadeira conta-se sozinha pela ordem das datas
describe('Horário mensal da turma', () => {
  let amb, ensino, turma, pdo, mic
  before(async () => {
    amb = await criarAmbiente()
    const admin = await amb.entrar()
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso Superior de Comando e Direcção' })
    ensino = amb.com((await amb.criarUtilizador('administrador')).token)
    turma = (await ensino.post('/api/admin/academico/turmas').send({ curso: 'curso-superior-de-comando-e-direccao', anoLetivo: '2026/2027', nome: '32.º CSCD' }).expect(201)).body
    pdo = (await ensino.post(`/api/admin/academico/turmas/${turma.id}/cadeiras`).send({ codigo: 'PDO', nome: 'Planeamento e Doutrina das Operações' }).expect(201)).body
    mic = (await ensino.post(`/api/admin/academico/turmas/${turma.id}/cadeiras`).send({ codigo: 'MIC', nome: 'Metodologia de Investigação Científica' }).expect(201)).body
  })
  after(() => amb.fechar())

  it('os dias úteis do mês, as sessões S1, S2… e os textos (Feriado)', async () => {
    const url = `/api/admin/academico/turmas/${turma.id}/horario-mensal`
    const vazio = (await ensino.get(`${url}?mes=2026-11`).expect(200)).body
    assert.equal(vazio.dias.length, 21) // Novembro de 2026: 21 dias de segunda a sexta
    assert.deepEqual(vazio.dias[0], { data: '2026-11-02', diaSemana: 1 })
    await ensino.put(url).send({ data: '2026-11-03', bloco: '08:30-09:20', cadeiraId: pdo.id }).expect(200)
    await ensino.put(url).send({ data: '2026-11-02', bloco: '09:30-10:20', cadeiraId: pdo.id }).expect(200)
    await ensino.put(url).send({ data: '2026-11-02', bloco: '08:30-09:20', cadeiraId: mic.id }).expect(200)
    const d = (await ensino.put(url).send({ data: '2026-11-11', bloco: '08:30-09:20', texto: 'Feriado' }).expect(200)).body
    const s = (data, bloco) => d.celulas.find((c) => c.data === data && c.bloco === bloco)
    assert.deepEqual([s('2026-11-02', '09:30-10:20').sessao, s('2026-11-03', '08:30-09:20').sessao, s('2026-11-02', '08:30-09:20').sessao], [1, 2, 1])
    assert.equal(s('2026-11-11', '08:30-09:20').texto, 'Feriado')
    assert.equal(d.cadeiras.find((c) => c.codigo === 'PDO').sessoes, 2)
    // apagar uma célula: as sessões renumeram-se
    const d2 = (await ensino.put(url).send({ data: '2026-11-02', bloco: '09:30-10:20' }).expect(200)).body
    assert.equal(d2.celulas.find((c) => c.data === '2026-11-03').sessao, 1)
    // tempo desconhecido e cadeira de outra turma: recusados
    assert.equal((await ensino.put(url).send({ data: '2026-11-03', bloco: '07:00-08:00', texto: 'x' })).status, 400)
    const outra = (await ensino.post('/api/admin/academico/turmas').send({ curso: 'curso-superior-de-comando-e-direccao', anoLetivo: '2026/2027', nome: 'Outra' }).expect(201)).body
    assert.equal((await ensino.put(`/api/admin/academico/turmas/${outra.id}/horario-mensal`).send({ data: '2026-11-03', bloco: '08:30-09:20', cadeiraId: pdo.id })).status, 400)
  })
})
