import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { calcularEmblemas } from '../../src/dominio/academico/conclusao/emblemas.js'

const cadeira = { id: 7, nome: 'Estratégia', codigo: 'EST101' }
const secoes = [{ id: 1, titulo: 'Capítulo 1' }, { id: 2, titulo: 'Capítulo 2' }, { id: 3, titulo: 'Vazio' }]
const itens = [
  { tipo: 'material', id: 1, secaoId: 1, feita: true },
  { tipo: 'trabalho', id: 2, secaoId: 1, feita: true },
  { tipo: 'material', id: 3, secaoId: 2, feita: false },
]
const de = (l, id) => l.find((e) => e.id === `7-${id}`)

describe('emblemas', () => {
  it('primeiros passos, capítulos (só os que têm atividades) e cadeira', () => {
    const l = calcularEmblemas({ cadeira, secoes, itens })
    assert.equal(de(l, 'inicio').ganho, true)
    assert.equal(de(l, 'capitulo-1').ganho, true)
    assert.deepEqual([de(l, 'capitulo-2').ganho, de(l, 'capitulo-2').feitas, de(l, 'capitulo-2').total], [false, 0, 1])
    assert.equal(de(l, 'capitulo-3'), undefined)
    assert.deepEqual([de(l, 'cadeira').ganho, de(l, 'cadeira').feitas], [false, 2])
    assert.equal(de(l, 'pontual'), undefined) // menos de dois trabalhos
  })

  it('sempre a tempo: todos dentro do prazo; um atraso tira-o do alcance; sem atividades não há emblemas', () => {
    const certo = calcularEmblemas({ cadeira, secoes, itens, pontualidade: [{ entregue: true, aTempo: true }, { entregue: true, aTempo: true }] })
    assert.equal(de(certo, 'pontual').ganho, true)
    const atraso = calcularEmblemas({ cadeira, secoes, itens, pontualidade: [{ entregue: true, aTempo: true }, { entregue: true, aTempo: false }] })
    assert.deepEqual([de(atraso, 'pontual').ganho, de(atraso, 'pontual').perdido], [false, true])
    assert.deepEqual(calcularEmblemas({ cadeira, secoes, itens: [] }), [])
  })
})
