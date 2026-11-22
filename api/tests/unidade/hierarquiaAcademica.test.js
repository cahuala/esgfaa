import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { compararHierarquia, grauDe, nomeSemPosto, ordenarPorHierarquia } from '../../src/dominio/academico/pessoas/hierarquia.js'

describe('ordem hierárquica das listas académicas', () => {
  it('pelo posto (equivalentes dos três ramos contam igual) e, no mesmo posto, por ordem alfabética; civis no fim', () => {
    const l = [
      { nome: 'Zacarias Lopes', dados: { posto: 'Major' } },
      { nome: 'Bernardo Silva', dados: {} },
      { nome: 'Ana Costa', dados: { posto: 'Capitão-de-Mar-e-Guerra' } },
      { nome: 'Armando Neto', dados: { posto: 'Major' } },
      { nome: 'Carlos Dias', dados: { posto: 'Coronel' } },
      { nome: 'Adelino Pinto', dados: {} },
      { nome: 'Tenente-General Teste', dados: { posto: 'Tenente-General' } },
    ]
    assert.deepEqual(ordenarPorHierarquia(l).map((x) => x.nome), ['Tenente-General Teste', 'Ana Costa', 'Carlos Dias', 'Armando Neto', 'Zacarias Lopes', 'Adelino Pinto', 'Bernardo Silva'])
  })

  it('contas antigas: o posto abreviado no nome conta, e a ordem alfabética ignora-o', () => {
    assert.equal(grauDe({ nome: 'Ten.-Cor. Sofia Lima' }), 15)
    assert.equal(grauDe({ nome: 'Maj. João Fernandes' }), 14)
    assert.equal(nomeSemPosto('Cap.-Ten. Pedro Neto'), 'Cap.-Ten. Pedro Neto') // não é um posto conhecido: fica
    assert.equal(nomeSemPosto('Maj. João Fernandes'), 'João Fernandes')
    assert.ok(compararHierarquia({ nome: 'Maj. Zé Antunes' }, { nome: 'Maj. Abel Matos' }) > 0)
  })
})
