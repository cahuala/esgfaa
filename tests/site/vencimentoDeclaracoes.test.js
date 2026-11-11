import { describe, expect, it } from 'vitest'
import { vencimentoPorDefeito } from '../../src/pessoal/docPessoal'

describe('vencimento das declarações', () => {
  it('militar: o líquido da tabela salarial do posto, mesmo com valor na ficha', () => {
    expect(vencimentoPorDefeito({ tipo: 'militar', vencimento: 932380.97, vencimentoTabela: { liquido: 424278 } })).toBe(424278)
  })
  it('militar sem tabela: o da ficha', () => {
    expect(vencimentoPorDefeito({ tipo: 'militar', vencimento: 300000, vencimentoTabela: null })).toBe(300000)
  })
  it('civil: o da ficha e, sem ele, o da tabela', () => {
    expect(vencimentoPorDefeito({ tipo: 'civil', vencimento: 250000, remuneracao: { liquido: 180000 } })).toBe(250000)
    expect(vencimentoPorDefeito({ tipo: 'civil', vencimento: null, remuneracao: { liquido: 180000 } })).toBe(180000)
  })
})
