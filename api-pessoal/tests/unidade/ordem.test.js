import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { comparadorHierarquico } from '../../src/dominio/pessoal/ordem.js'

describe('ordem hierárquica', () => {
  const cmp = comparadorHierarquico(new Map())
  it('os militares pelo posto; os civis depois, pelo nível da carreira; os domiciliares no fim', () => {
    const l = [
      { nome: 'Ana', tipo: 'civil', carreiraCivil: 'administrativo' },
      { nome: 'Bia', tipo: 'civil', vinculo: 'domiciliar', carreiraCivil: 'trabalhador_domiciliar' },
      { nome: 'Caio', tipo: 'militar', posto: 'capitao' },
      { nome: 'Dino', tipo: 'civil', carreiraCivil: 'tecnico_superior' },
      { nome: 'Eva', tipo: 'militar', posto: 'coronel' },
    ]
    assert.deepEqual([...l].sort(cmp).map((x) => x.nome), ['Eva', 'Caio', 'Dino', 'Ana', 'Bia'])
  })
})
