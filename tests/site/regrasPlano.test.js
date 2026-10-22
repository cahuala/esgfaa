import { describe, expect, it } from 'vitest'
import { regrasDoPlano } from '../../src/portal/regrasDoPlano'
import { MODELOS_PLANO, regrasPublicas, validarPlano } from '../../api/src/dominio/academico/avaliacao/planoCurso.js'

const regras = (k) => Object.fromEntries(regrasDoPlano(regrasPublicas(validarPlano({ ...MODELOS_PLANO[k].plano, curso: k }), MODELOS_PLANO[k].cadeiras.find((c) => c.tii).codigo)))

describe('regras de avaliação no ecrã (as do plano de cada curso)', () => {
  it('CSCD: a fórmula com os coeficientes e todos os mínimos', () => {
    const r = regras('cscd-2026')
    expect(r['Nota final do curso']).toBe('(2 × ADM + 3 × TAC + 1 × OCC + 2 × ESTR + 2 × TII) / 10')
    expect(r['Aprovação na UC']).toMatch(/10 valores na nota final da UC e 10 valores em cada TAI de teste escrito/)
    expect(r['Aprovação no curso']).toMatch(/10 valores em cada bloco, 10 valores no TII, média final de 10 valores/)
    expect(r['Teste de recuperação']).toMatch(/17h do dia útil seguinte/)
    expect(r.Faltas).toMatch(/10 %/)
  })
  it('CEMC: coeficientes 2,5 / 1 / 2 / 1,5 sobre 7', () => {
    expect(regras('cemc-2026')['Nota final do curso']).toBe('(2,5 × ADM + 1 × OCC + 2 × ESTR + 1,5 × TII) / 7')
  })
  it('CEAO: pesos em percentagem; não exige 10 por UC nem por teste escrito', () => {
    const r = regras('ceao-2026')
    expect(r['Nota final do curso']).toBe('60 % × NUC + 15 % × COMP + 25 % × TII')
    expect(r['Aprovação na UC']).toMatch(/não exige 10 em cada UC/)
    expect(r['Aprovação no curso']).toMatch(/10 valores em cada bloco, 10 valores no TII/)
  })
  it('COAMP: média das UC, recurso obrigatório, ajuste ±0,25, sem limite de faltas, 10 factores', () => {
    const r = regras('coamp-2026')
    expect(r['Nota final do curso']).toMatch(/Média das unidades curriculares/)
    expect(r.Recurso).toMatch(/obrigatório/)
    expect(r['Teste de recuperação']).toBeUndefined()
    expect(r['Aprovação no curso']).toBe('Exige média final de 10 valores.')
    expect(r['Aprovação na UC']).toBe('O plano não exige 10 em cada UC: conta a média final.')
    expect(r['Ajuste do Comandante']).toMatch(/±0,25/)
    expect(r.Faltas).toMatch(/não fixa/)
    expect(r['Conselho de Curso']).toMatch(/10 factores/)
  })
})
