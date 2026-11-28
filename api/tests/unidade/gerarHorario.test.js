import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { gerarHorario, temposSemanais } from '../../src/dominio/academico/horarios/gerar.js'

const TEMPOS = ['08:30-09:20', '09:30-10:20', '10:30-11:20']

describe('horário gerado automaticamente', () => {
  it('os tempos por semana saem das horas da cadeira', () => {
    assert.equal(temposSemanais(30, 16, 50), 2)
    assert.equal(temposSemanais(5, 16, 50), 1)
    assert.equal(temposSemanais(0, 16, 50), 0)
  })

  it('ninguém em dois sítios: a turma, o docente (também noutra turma) e a sala; a cadeira espalhada pelos dias', () => {
    const cadeiras = [
      { id: 1, codigo: 'EST', nome: 'Estratégia', periodo: '1', horas: 40, docenteIds: [10] },
      { id: 2, codigo: 'GEO', nome: 'Geopolítica', periodo: '1', horas: 26, docenteIds: [10] },
      { id: 3, codigo: 'HIS', nome: 'História', periodo: '2', horas: 26, docenteIds: [11] },
    ]
    // o docente 10 já dá aulas à segunda às 08:30 noutra turma; a Sala 1 está ocupada à terça às 08:30
    const ocupados = [{ diaSemana: 1, inicio: '08:30', fim: '09:20', sala: 'Sala 2', docenteIds: [10], periodo: '1' }, { diaSemana: 2, inicio: '08:30', fim: '09:20', sala: 'Sala 1', docenteIds: [], periodo: '1' }]
    const r = gerarHorario({ cadeiras, ocupados, tempos: TEMPOS, dias: [1, 2, 3, 4, 5], salas: ['Sala 1'], semanas: { 1: 16, 2: 16 } })
    assert.deepEqual(r.semLugar, [])
    assert.deepEqual(r.temposPorSemana, { 1: 3, 2: 2, 3: 2 })
    const de = (id) => r.horario.filter((h) => h.cadeiraId === id)
    assert.equal(de(1).length, 3)
    assert.equal(new Set(de(1).map((h) => h.diaSemana)).size, 3) // em dias diferentes
    // o docente 10 nunca em dois sítios, nem à segunda às 08:30
    const doDocente = [...de(1), ...de(2)]
    for (const a of doDocente) for (const b of doDocente) if (a !== b) assert.ok(!(a.diaSemana === b.diaSemana && a.inicio === b.inicio))
    assert.ok(!doDocente.some((h) => h.diaSemana === 1 && h.inicio === '08:30'))
    // a Sala 1 está ocupada à terça às 08:30 (1.º semestre)
    assert.ok(!r.horario.some((h) => h.periodo === '1' && h.diaSemana === 2 && h.inicio === '08:30'))
    // a de 2.º semestre pode ficar à mesma hora de uma do 1.º
    assert.equal(de(3).length, 2)
  })

  it('sem lugar suficiente: diz o que falta', () => {
    const r = gerarHorario({ cadeiras: [{ id: 1, codigo: 'A', nome: 'A', periodo: '1', horas: 200, docenteIds: [] }], tempos: ['08:30-09:20'], dias: [1, 2], semanas: { 1: 16 } })
    assert.equal(r.horario.length, 2)
    assert.deepEqual(r.semLugar.map((x) => x.faltam), [8])
  })
})
