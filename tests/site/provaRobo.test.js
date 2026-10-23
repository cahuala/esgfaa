import { describe, expect, it } from 'vitest'
import { resolverDesafio, sha256Js } from '../../src/utils/provaRobo'

describe('«Não sou um robô» no navegador', () => {
  it('o SHA-256 em JavaScript dá os valores oficiais (para as páginas sem HTTPS)', () => {
    expect(sha256Js('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    expect(sha256Js('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(sha256Js('a'.repeat(1000))).toBe('41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3')
    expect(sha256Js('Escola Superior de Guerra — ç')).toHaveLength(64)
  })

  it('resolve um desafio como o do servidor', async () => {
    const sal = `${Date.now() + 60_000}.abc.`
    const d = { sal, desafio: sha256Js(`${sal}1234`), maximo: 5000 }
    expect((await resolverDesafio(d)).numero).toBe(1234)
  })
})
