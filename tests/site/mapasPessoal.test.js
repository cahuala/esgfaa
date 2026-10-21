import { describe, expect, it } from 'vitest'
import { MAPAS } from '../../src/pessoal/mapas'

// uma orgânica pequena: duas unidades de topo e uma secção dentro da primeira
const lista = [
  { id: 1, nome: 'Comando', nivel: 1, paiId: null, previstoGraus: { oficiais: 3, sargentos: 1, cabos: 0, soldados: 1, civil: 2 } },
  { id: 2, nome: 'Secção', nivel: 2, paiId: 1 },
  { id: 3, nome: 'Direcção de Ensino', nivel: 1, paiId: null, previstoGraus: { oficiais: 2, sargentos: 0, cabos: 0, soldados: 0, civil: 0 } },
]
const arvore = { lista, porId: new Map(lista.map((u) => [u.id, u])), descendentes: (id) => new Set(id === 1 ? [1, 2] : [id]) }
const P = (id, posto, unidadeId, extra = {}) => ({ id, tipo: 'militar', posto, ramo: 'EXE', fps: 'QP', unidadeId, ...extra })
const pessoas = [
  P(1, 'coronel', 1), P(2, 'tenente', 2, { fps: 'SMC' }), P(3, 'soldado', 1, { fps: 'SMO', estado: 'em_missao' }),
  P(4, 'major', 3, { habilitacao: 'mestrado', quadroEspecial: 'INF' }), P(5, 'capitao', 3, { estado: 'destacado' }),
  { id: 6, tipo: 'civil', unidadeId: 1 }, P(7, 'major', 3, { vinculo: 'estudante' }),
]
const ctx = { pessoas, arvore, base: null, licencas: [] }
const mapa = (id) => MAPAS.find((m) => m.id === id).fazer(ctx, { mes: '2026-10' })
const linha = (d, rotulo) => d.seccoes[0].linhas.find((l) => l.rotulo === rotulo)
const coluna = (d, titulo) => d.seccoes[0].colunas.findIndex((c) => c.titulo === titulo) - 2

describe('mapas de controlo estatístico', () => {
  it('Mod. 2: orgânica, real, físico e diferença; o destacado vai para os agregados e o estudante não entra', () => {
    const d = mapa('mod2')
    const c = linha(d, 'COMANDO').valores
    expect(c.slice(0, 7)).toEqual([3, 1, 0, 1, 5, 2, 7]) // orgânica
    expect(c.slice(7, 14)).toEqual([2, 0, 0, 1, 3, '60%', 1]) // real (com a secção)
    expect(c.slice(14, 21)).toEqual([2, 0, 0, 0, 2, '67%', 1]) // físico: o soldado está em missão
    expect(linha(d, 'DIRECÇÃO DE ENSINO').valores[11]).toBe(1)
    expect(linha(d, 'EM REGIME DE DESTACAMENTO').valores[11]).toBe(1)
    expect(linha(d, 'TOTAL-GERAL').valores[11]).toBe(5)
  })

  it('Mod. 3: QP e SMC dos tenentes, SMO dos soldados e o total geral', () => {
    const d = mapa('mod3')
    const t = linha(d, 'TOTAL GERAL').valores
    expect(t[coluna(d, 'Ofic. subalternos — Tenente — SMC')]).toBe(1)
    expect(t[coluna(d, 'Praças — Soldados — SMO')]).toBe(1)
    expect(t.at(-1)).toBe(5)
  })

  it('Mod. 4 e 5: especialidade e habilitações; os sem dados ficam à parte', () => {
    const d4 = mapa('mod4')
    expect(linha(d4, 'Infantaria').valores.at(-1)).toBe(1)
    expect(linha(d4, 'TOTAL').valores.at(-1)).toBe(5)
    const d5 = mapa('mod5')
    expect(linha(d5, 'MESTRADO').valores.at(-1)).toBe(1)
    expect(linha(d5, 'NÃO DECLARADOS').valores.at(-1)).toBe(4)
  })

  it('Ausências: a missão de serviço conta no período', () => {
    const d = mapa('ausencias')
    expect(linha(d, 'TOTAL GERAL').valores[coluna(d, 'M/Serviço — Soldados')]).toBe(1)
  })
})
