import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  corrigir, dentroDoTempo, estadoQuestionario, limiteTentativa, limparRespostas, validarPergunta,
} from '../../src/dominio/academico/questionarios.js'
import { expandirAulas, intervaloCalendario, validarEvento } from '../../src/dominio/academico/regras.js'
import { ErroValidacao } from '../../src/dominio/comum/erros.js'

const perguntas = [
  { id: 1, tipo: 'unica', pontos: 2, opcoes: [{ texto: 'a', correta: false }, { texto: 'b', correta: true }, { texto: 'c', correta: false }] },
  { id: 2, tipo: 'multipla', pontos: 1, opcoes: [{ texto: 'a', correta: true }, { texto: 'b', correta: false }, { texto: 'c', correta: true }] },
  { id: 3, tipo: 'vf', pontos: 1, opcoes: [{ texto: 'Verdadeiro', correta: false }, { texto: 'Falso', correta: true }] },
]

describe('questionários: regras', () => {
  it('validação das perguntas', () => {
    assert.deepEqual(validarPergunta({ tipo: 'vf', enunciado: 'A Terra é plana?', correta: 'falso' }).opcoes, [{ texto: 'Verdadeiro', correta: false }, { texto: 'Falso', correta: true }])
    assert.equal(validarPergunta({ tipo: 'unica', enunciado: 'Capital?', pontos: '1,5', opcoes: [{ texto: 'Luanda', correta: true }, { texto: 'Huambo' }] }).pontos, 1.5)
    assert.throws(() => validarPergunta({ tipo: 'unica', enunciado: 'Duas certas?', opcoes: [{ texto: 'a', correta: true }, { texto: 'b', correta: true }] }), /só uma/)
    assert.throws(() => validarPergunta({ tipo: 'multipla', enunciado: 'Nenhuma certa?', opcoes: [{ texto: 'a' }, { texto: 'b' }] }), /pelo menos uma/)
    assert.throws(() => validarPergunta({ tipo: 'unica', enunciado: 'Uma opção?', opcoes: [{ texto: 'a', correta: true }] }), /2 a 8/)
    assert.throws(() => validarPergunta({ tipo: 'ensaio', enunciado: 'x?' }), ErroValidacao)
    assert.throws(() => validarPergunta({ tipo: 'vf', enunciado: 'Pontos?', pontos: 0 }), /pontos/i)
  })

  it('respostas: só índices válidos, uma na escolha única', () => {
    assert.deepEqual(limparRespostas({ 1: [2, 1], 2: [2, 0, 2, 9], 3: 1, 99: [0] }, perguntas), { 1: [1], 2: [0, 2], 3: [1] })
    assert.deepEqual(limparRespostas('lixo', perguntas), {})
  })

  it('correção: tudo ou nada por pergunta, nota de 0 a 20', () => {
    assert.equal(corrigir(perguntas, { 1: [1], 2: [0, 2], 3: [1] }).nota, 20)
    // múltipla com uma a mais não conta: 2 + 0 + 1 = 3 de 4
    const r = corrigir(perguntas, { 1: [1], 2: [0, 1, 2], 3: [1] })
    assert.deepEqual([r.obtidos, r.total, r.nota], [3, 4, 15])
    assert.equal(corrigir(perguntas, {}).nota, 0)
    assert.equal(corrigir([], {}).nota, 0)
  })

  it('abertura, fecho e tempo de cada tentativa', () => {
    const q = { abre: '2026-10-14T08:00:00Z', fecha: '2026-10-14T10:00:00Z', duracao: 30 }
    assert.equal(estadoQuestionario(q, new Date('2026-10-14T07:59:00Z')), 'em_breve')
    assert.equal(estadoQuestionario(q, new Date('2026-10-14T09:00:00Z')), 'aberto')
    assert.equal(estadoQuestionario(q, new Date('2026-10-14T10:01:00Z')), 'fechado')
    // começa às 09:45: acaba às 10:00 (o fecho chega antes dos 30 minutos)
    assert.equal(limiteTentativa(q, new Date('2026-10-14T09:45:00Z')).toISOString(), '2026-10-14T10:00:00.000Z')
    assert.equal(limiteTentativa(q, new Date('2026-10-14T09:00:00Z')).toISOString(), '2026-10-14T09:30:00.000Z')
    assert.equal(limiteTentativa({ duracao: 0 }, new Date()), null)
    const t = { limite: '2026-10-14T09:30:00Z' }
    assert.equal(dentroDoTempo(t, new Date('2026-10-14T09:30:20Z')), true) // margem de rede
    assert.equal(dentroDoTempo(t, new Date('2026-10-14T09:31:00Z')), false)
  })
})

describe('calendário académico: regras', () => {
  it('eventos e intervalos', () => {
    assert.equal(validarEvento({ tipo: 'exame', data: '2026-11-20', inicio: '09:00', fim: '12:00' }).titulo, 'Exame')
    assert.throws(() => validarEvento({ tipo: 'feriado', data: '2026-11-11' }, ['p1', 'exame']), ErroValidacao)
    assert.throws(() => validarEvento({ tipo: 'p1', data: '2026-11-20', inicio: '12:00', fim: '09:00' }), /fim/)
    assert.throws(() => validarEvento({ tipo: 'p1', data: 'amanhã' }), /data/)
    assert.deepEqual(intervaloCalendario('2026-10-01', '2026-11-10'), { de: '2026-10-01', ate: '2026-11-10' })
    assert.throws(() => intervaloCalendario('2026-10-01', '2026-12-31'), /45 dias/)
    assert.throws(() => intervaloCalendario('2026-10-10', '2026-10-01'), ErroValidacao)
  })

  it('aulas do horário semanal, sem os feriados', () => {
    // 2026-11-09 é segunda-feira; 11 de novembro (quarta) é feriado
    const horario = [{ id: 1, diaSemana: 1, inicio: '08:00' }, { id: 2, diaSemana: 3, inicio: '10:00' }]
    const aulas = expandirAulas(horario, '2026-11-09', '2026-11-18', ['2026-11-11'])
    assert.deepEqual(aulas.map((a) => [a.id, a.data]), [[1, '2026-11-09'], [1, '2026-11-16'], [2, '2026-11-18']])
  })
})
