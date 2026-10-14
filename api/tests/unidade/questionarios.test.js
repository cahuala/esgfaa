import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  corrigir, dentroDoTempo, estadoQuestionario, limiteTentativa, limparRespostas, validarPergunta,
} from '../../src/dominio/academico/atividades/questionarios.js'
import { intervaloCalendario, validarEvento } from '../../src/dominio/academico/organizacao/calendario.js'
import { expandirAulas } from '../../src/dominio/academico/organizacao/horario.js'
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

describe('questionários: tipos novos, ordem aleatória e estatísticas', async () => {
  const q = await import('../../src/dominio/academico/atividades/questionarios.js')
  const curta = { id: 10, tipo: 'curta', pontos: 1, opcoes: { respostas: ['Carl von Clausewitz', 'Clausewitz'] } }
  const numerica = { id: 11, tipo: 'numerica', pontos: 1, opcoes: { valor: 1975, tolerancia: 0 } }
  const corresp = { id: 12, tipo: 'correspondencia', pontos: 3, opcoes: { pares: [{ a: 'Sun Tzu', b: 'A Arte da Guerra' }, { a: 'Clausewitz', b: 'Da Guerra' }, { a: 'Maquiavel', b: 'O Príncipe' }] } }
  const diss = { id: 13, tipo: 'dissertacao', pontos: 5, opcoes: { orientacao: '' } }

  it('validação dos tipos novos', () => {
    assert.deepEqual(q.validarPergunta({ tipo: 'curta', enunciado: 'Autor de Da Guerra?', opcoes: { respostas: [' Clausewitz ', ''] } }).opcoes, { respostas: ['Clausewitz'] })
    assert.deepEqual(q.validarPergunta({ tipo: 'numerica', enunciado: 'Ano da independência?', opcoes: { valor: '1975', tolerancia: '0' } }).opcoes, { valor: 1975, tolerancia: 0 })
    assert.throws(() => q.validarPergunta({ tipo: 'numerica', enunciado: 'Sem valor?', opcoes: {} }), /valor certo/)
    assert.throws(() => q.validarPergunta({ tipo: 'correspondencia', enunciado: 'Um só par?', opcoes: { pares: [{ a: 'x', b: 'y' }] } }), /2 a 8 pares/)
    assert.throws(() => q.validarPergunta({ tipo: 'correspondencia', enunciado: 'Repetidas?', opcoes: { pares: [{ a: 'x', b: 'y' }, { a: 'z', b: 'Y' }] } }), /diferentes/)
    assert.equal(q.validarPergunta({ tipo: 'dissertacao', enunciado: 'Comente a frase.' }).tipo, 'dissertacao')
  })

  it('correção: curta sem acentos nem maiúsculas, numérica com tolerância, correspondência parcial', () => {
    const r = q.corrigir([curta, numerica, corresp], { 10: 'clausewitz', 11: '1975', 12: [0, 2, 1] })
    assert.deepEqual(r.detalhe.map((d) => d.obtidos), [1, 1, 1]) // 1 dos 3 pares certos
    assert.deepEqual([r.obtidos, r.total, r.nota], [3, 5, 12])
    assert.equal(q.corrigir([numerica], { 11: '1974' }).nota, 0)
    assert.equal(q.corrigir([{ ...numerica, opcoes: { valor: 3.14, tolerancia: 0.01 } }], { 11: '3,15' }).nota, 20)
    assert.equal(q.normalizar('  Ação  Militar '), 'acao militar')
  })

  it('dissertação: nota por corrigir até o docente dar os pontos', () => {
    const r = q.corrigir([curta, diss], { 10: 'Clausewitz', 13: 'A guerra é…' })
    assert.deepEqual([r.porCorrigir, r.nota], [true, null])
    const c = q.corrigir([curta, diss], { 10: 'Clausewitz', 13: 'A guerra é…' }, { 13: 4 })
    assert.deepEqual([c.porCorrigir, c.obtidos, c.nota], [false, 5, 16.67])
    assert.equal(q.corrigir([diss], {}, { 13: 9 }).obtidos, 5) // nunca acima do máximo
  })

  it('ordem aleatória e subconjunto de perguntas', () => {
    let s = 0
    const aleatorio = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
    const perguntas = [1, 2, 3, 4, 5].map((id) => ({ id, tipo: 'unica', opcoes: [{}, {}, {}] }))
    const t = q.sortearTentativa({ baralhar: true, perguntasPorTentativa: 3 }, perguntas, aleatorio)
    assert.equal(t.ordem.length, 3)
    assert.equal(new Set(t.ordem).size, 3)
    for (const id of t.ordem) assert.deepEqual([...t.permutacoes[id]].sort(), [0, 1, 2])
    const fixa = q.sortearTentativa({ baralhar: false, perguntasPorTentativa: 0 }, perguntas, aleatorio)
    assert.deepEqual([fixa.ordem, fixa.permutacoes], [[1, 2, 3, 4, 5], {}])
    assert.deepEqual(q.perguntasDaTentativa(perguntas, { ordem: [3, 1] }).map((p) => p.id), [3, 1])
  })

  it('estatísticas: média, mediana, facilidade e escolhas', () => {
    const unica = { id: 1, tipo: 'unica', pontos: 1, opcoes: [{ correta: false }, { correta: true }] }
    const e = q.estatisticas([unica], [
      { entregueEm: 'x', nota: 20, respostas: { 1: [1] } }, { entregueEm: 'x', nota: 0, respostas: { 1: [0] } },
      { entregueEm: 'x', nota: 20, respostas: { 1: [1] } }, { entregueEm: null, nota: null, respostas: {} },
    ])
    assert.deepEqual([e.tentativas, e.media, e.mediana], [3, 13.33, 20])
    assert.deepEqual([e.porPergunta[0].facilidade, e.porPergunta[0].escolhas], [67, [1, 2]])
  })
})
