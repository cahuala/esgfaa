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
  it('os militares em Missão de serviço (indicados sem nomeação) ficam no fim, seja qual for o posto', () => {
    const l = [
      { nome: 'Rui', tipo: 'militar', posto: 'coronel', estado: 'missao_servico' },
      { nome: 'Ana', tipo: 'civil', carreiraCivil: 'administrativo' },
      { nome: 'Caio', tipo: 'militar', posto: 'capitao' },
      { nome: 'Lia', tipo: 'militar', posto: 'tenente', estado: 'missao_servico' },
      { nome: 'Eva', tipo: 'militar', posto: 'coronel', estado: 'em_missao' },
    ]
    assert.deepEqual([...l].sort(cmp).map((x) => x.nome), ['Eva', 'Caio', 'Ana', 'Rui', 'Lia'])
    // quando «estado» é outra coisa (o processo individual), vem missaoServico
    assert.ok(cmp({ nome: 'A', posto: 'coronel', estado: 'arquivo', missaoServico: true }, { nome: 'B', posto: 'capitao', estado: 'arquivo', missaoServico: false }) > 0)
  })
})
