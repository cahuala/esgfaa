import { describe, it, expect } from 'vitest'
import { faltam, iniciais, localParaIso, maiusculaInicial, nota, primeiroNome } from '../../src/portal/formatar'

describe('portal: formatação', () => {
  it('a patente não conta como nome', () => {
    expect(primeiroNome('Maj. João Fernandes')).toBe('João')
    expect(primeiroNome('Ten.-Cor. Sofia Lima')).toBe('Sofia')
    expect(iniciais('Cap.-Ten. Pedro Neto')).toBe('PN')
    expect(iniciais('Ana')).toBe('A')
  })

  it('prazos em linguagem simples', () => {
    const agora = new Date('2026-10-13T10:00:00')
    expect(faltam('2026-10-16T23:59:00', agora)).toBe('faltam 3 dias')
    expect(faltam('2026-10-14T12:00:00', agora)).toBe('falta 1 dia')
    expect(faltam('2026-10-13T23:59:00', agora)).toMatch(/^termina hoje às 23:59$/)
    expect(faltam('2026-10-12T23:59:00', agora)).toBe('terminou')
  })

  it('notas com vírgula e traço quando não há nota', () => {
    expect(nota(15.5)).toBe('15,5')
    expect(nota(null)).toBe('—')
  })

  it('outras ajudas', () => {
    expect(maiusculaInicial('terça-feira, 13 de outubro')).toBe('Terça-feira, 13 de outubro')
    expect(localParaIso('')).toBe('')
    expect(localParaIso('2026-10-20T23:59')).toMatch(/^2026-10-2\dT\d{2}:59:00\.000Z$/)
  })
})
