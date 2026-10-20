import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { OUTRA, contarPerguntas, limparRespostasInquerito, mediaGlobal, resultadosInquerito, validarPerguntasOpiniao } from '../../src/dominio/comum/opiniao.js'

// um inquérito com todos os tipos de pergunta do Google Forms, em duas secções
const PERGUNTAS = validarPerguntasOpiniao([
  { tipo: 'curta', texto: 'Unidade de origem', obrigatoria: true },
  { tipo: 'aberta', texto: 'Comentários gerais' },
  { tipo: 'escolha', texto: 'Ramo', opcoes: ['Exército', 'Marinha', 'Força Aérea'], outra: true },
  { tipo: 'seccao', texto: 'Instalações', descricao: 'Sobre as salas e a biblioteca.' },
  { tipo: 'escolha', texto: 'Serviços usados', opcoes: ['Biblioteca', 'Refeitório', 'Ginásio'], multipla: true, obrigatoria: false },
  { tipo: 'escolha', texto: 'Ano do curso', opcoes: ['1.º', '2.º'], lista: true },
  { tipo: 'escala', texto: 'Satisfação global', min: 0, max: 10, rotuloMin: 'Nada', rotuloMax: 'Muito' },
  { tipo: 'escala', texto: 'As salas são adequadas.' },
  { tipo: 'grelha', texto: 'Avalie cada serviço', linhas: ['Biblioteca', 'Refeitório'], colunas: ['Mau', 'Razoável', 'Bom'] },
  { tipo: 'data', texto: 'Data de entrada na Escola', obrigatoria: false },
  { tipo: 'hora', texto: 'Hora a que costuma chegar', obrigatoria: false },
])

describe('inquéritos: todos os tipos de pergunta (como o Google Forms)', () => {
  it('valida as perguntas: secções, escala configurável, grelha, lista pendente e "Outra"', () => {
    assert.equal(contarPerguntas(PERGUNTAS), 10)
    assert.deepEqual(PERGUNTAS[6], { tipo: 'escala', texto: 'Satisfação global', min: 0, max: 10, rotuloMin: 'Nada', rotuloMax: 'Muito' })
    assert.equal(PERGUNTAS[0].obrigatoria, true)
    assert.equal(PERGUNTAS[4].obrigatoria, false)
    assert.equal(PERGUNTAS[5].lista, true)
    assert.throws(() => validarPerguntasOpiniao([{ tipo: 'seccao', texto: 'Só uma secção' }]), /pelo menos uma pergunta/)
    assert.throws(() => validarPerguntasOpiniao([{ tipo: 'escala', texto: 'Escala errada', max: 20 }]), /escala/)
    assert.throws(() => validarPerguntasOpiniao([{ tipo: 'grelha', texto: 'Grelha sem colunas', linhas: ['a'], colunas: ['x'] }]), /colunas/)
    // os inquéritos antigos (escala 1–5, escolha e aberta) continuam iguais
    assert.deepEqual(validarPerguntasOpiniao([{ tipo: 'escala', texto: 'Antiga' }, { tipo: 'aberta', texto: 'Sugestões' }]), [{ tipo: 'escala', texto: 'Antiga' }, { tipo: 'aberta', texto: 'Sugestões' }])
  })

  it('confere as respostas e exige as obrigatórias', () => {
    const boa = { 0: 'Brigada X', 2: [OUTRA], '2o': 'Guarda Presidencial', 5: 1, 6: 8, 7: 4, 8: { 0: 2, 1: [1] }, 9: '2025-02-10', 10: '07:30' }
    const r = limparRespostasInquerito(PERGUNTAS, boa)
    assert.deepEqual([r[0], r[2], r['2o'], r[4], r[6], r[8], r[9], r[10]], ['Brigada X', [OUTRA], 'Guarda Presidencial', undefined, 8, { 0: [2], 1: [1] }, '2025-02-10', '07:30'])
    assert.throws(() => limparRespostasInquerito(PERGUNTAS, { ...boa, 0: '' }), /obrigatória/)
    assert.throws(() => limparRespostasInquerito(PERGUNTAS, { ...boa, 6: 11 }), /0 a 10/)
    assert.throws(() => limparRespostasInquerito(PERGUNTAS, { ...boa, 8: { 0: 1 } }), /todas as linhas/)
    assert.throws(() => limparRespostasInquerito(PERGUNTAS, { ...boa, 9: '10/02/2025' }), /data/)
    // "Outra" sem texto não conta como resposta
    assert.throws(() => limparRespostasInquerito(PERGUNTAS, { ...boa, '2o': '' }), /obrigatória/)
  })

  it('resultados: contagens, "Outra", escala 0–10, grelha e textos; a média global só com as escalas de 1 a 5', () => {
    const respostas = [
      limparRespostasInquerito(PERGUNTAS, { 0: 'B', 2: [0], 5: 0, 6: 10, 7: 5, 8: { 0: 2, 1: 2 } }),
      limparRespostasInquerito(PERGUNTAS, { 0: 'A', 2: [OUTRA], '2o': 'Guarda', 5: 1, 6: 6, 7: 3, 8: { 0: 1, 1: 2 } }),
    ]
    const res = resultadosInquerito(PERGUNTAS, respostas)
    assert.deepEqual(res.perguntas[0].comentarios, ['A', 'B'])
    assert.deepEqual([res.perguntas[2].contagens, res.perguntas[2].outras], [[1, 0, 0], ['Guarda']])
    assert.equal(res.perguntas[6].distribuicao.length, 11)
    assert.equal(res.perguntas[6].media, 8)
    assert.deepEqual(res.perguntas[8].contagens, [[0, 1, 1], [0, 0, 2]])
    assert.equal(res.perguntas[3].tipo, 'seccao')
    assert.equal(mediaGlobal(res), 4)
  })
})
