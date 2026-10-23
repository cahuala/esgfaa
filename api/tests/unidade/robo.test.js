import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ProvasUsadas, criarDesafio, resolverDesafio, verificarProva } from '../../src/dominio/seguranca/robo.js'

describe('«Não sou um robô»: desafio, prova e reutilização', () => {
  const S = 'segredo-de-teste'
  it('a prova resolvida passa uma vez; repetida, alterada, de outro segredo ou fora de prazo, não', () => {
    const d = criarDesafio(S, { maximo: 2000 })
    const p = resolverDesafio(d)
    const usadas = new ProvasUsadas()
    assert.equal(verificarProva(S, p, usadas), true)
    assert.equal(verificarProva(S, p, usadas), false) // só uma vez
    const q = resolverDesafio(criarDesafio(S, { maximo: 2000 }))
    assert.equal(verificarProva(S, { ...q, numero: q.numero + 1 }, new ProvasUsadas()), false) // número errado
    assert.equal(verificarProva(S, { ...q, maximo: 10 }, new ProvasUsadas()), false) // dificuldade baixada à mão
    assert.equal(verificarProva('outro', q, new ProvasUsadas()), false)
    assert.equal(verificarProva(S, q, new ProvasUsadas(), Date.now() + 6 * 60_000), false) // expirou
    assert.equal(verificarProva(S, null, new ProvasUsadas()), false)
  })
})
