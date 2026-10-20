import { describe, expect, it } from 'vitest'
import { orgaosDe } from '../../src/components/Organograma/orgaos'

describe('organograma: a lista de órgãos e as dependências', () => {
  it('usa a lista de órgãos quando existe (sem os que não têm nome)', () => {
    const l = orgaosDe({ orgaos: [{ nome: 'Comando' }, { nome: '' }, { nome: 'Direção de Ensino', dependeDe: 'Comando' }], ramos: [{ titulo: 'X', orgaos: [] }] })
    expect(l.map((o) => o.nome)).toEqual(['Comando', 'Direção de Ensino'])
  })
  it('sem lista (páginas antigas), sai das áreas: Comando → áreas → órgãos', () => {
    const l = orgaosDe({ comando: 'Dirige', ramos: [{ titulo: 'Ensino', orgaos: [{ nome: 'Secretaria', texto: 't' }] }] }, 'Comando da Escola')
    expect(l.map((o) => [o.nome, o.dependeDe ?? ''])).toEqual([['Comando da Escola', ''], ['Ensino', 'Comando da Escola'], ['Secretaria', 'Ensino']])
  })
})
