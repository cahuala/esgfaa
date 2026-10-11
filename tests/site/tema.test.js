import { describe, expect, it } from 'vitest'
import { CHAVE_TEMA, aplicarTema, guardarTema, lerTemaGuardado, outroTema, temaInicial } from '../../src/tema/tema'

const armazenamentoFalso = () => {
  const dados = new Map()
  return { getItem: (k) => dados.get(k) ?? null, setItem: (k, v) => dados.set(k, v) }
}

describe('temaInicial', () => {
  it('usa a escolha guardada, seja qual for o sistema', () => {
    expect(temaInicial('light', true)).toBe('light')
    expect(temaInicial('dark', false)).toBe('dark')
  })
  it('sem escolha (ou com lixo) segue o sistema', () => {
    expect(temaInicial(null, true)).toBe('dark')
    expect(temaInicial(null, false)).toBe('light')
    expect(temaInicial('azul', true)).toBe('dark')
  })
})

describe('outroTema', () => {
  it('troca entre claro e escuro', () => {
    expect(outroTema('dark')).toBe('light')
    expect(outroTema('light')).toBe('dark')
  })
})

describe('guardar e ler', () => {
  it('lembra a escolha', () => {
    const a = armazenamentoFalso()
    guardarTema('dark', a)
    expect(lerTemaGuardado(a)).toBe('dark')
    expect(a.getItem(CHAVE_TEMA)).toBe('dark')
  })
  it('não rebenta se o armazenamento falhar (modo privado)', () => {
    const quebrado = { getItem: () => { throw new Error('bloqueado') }, setItem: () => { throw new Error('bloqueado') } }
    expect(lerTemaGuardado(quebrado)).toBeNull()
    expect(() => guardarTema('dark', quebrado)).not.toThrow()
  })
})

describe('aplicarTema', () => {
  it('põe data-tema no <html>', () => {
    const atributos = {}
    const doc = { documentElement: { setAttribute: (k, v) => { atributos[k] = v } } }
    aplicarTema('dark', doc)
    expect(atributos['data-tema']).toBe('dark')
  })
})
