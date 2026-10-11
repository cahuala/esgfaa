import { describe, it, expect } from 'vitest'
import { TAMANHOS, avaliarImagem, dicaTamanho } from '../../src/admin/imagens'

describe('tamanhos recomendados das imagens (painel)', () => {
  it('a dica diz o tamanho, a forma e o peso', () => {
    expect(dicaTamanho(TAMANHOS.capa)).toBe('Recomendado: 1600 × 900 px, horizontal (16:9) · JPG ou WebP até 2 MB.')
  })

  it('imagem boa não tem avisos', () => {
    expect(avaliarImagem({ largura: 1920, altura: 1080, bytes: 800_000 }, TAMANHOS.capa)).toEqual([])
  })

  it('avisa quando é pequena, ao alto num espaço horizontal ou pesada', () => {
    const avisos = avaliarImagem({ largura: 452, altura: 678, bytes: 5 * 1048576 }, TAMANHOS.capa)
    expect(avisos).toHaveLength(3)
    expect(avisos[0]).toMatch(/pequena \(452 × 678 px\)/)
    expect(avisos[1]).toMatch(/ao alto/)
    expect(avisos[2]).toMatch(/5,0 MB/)
  })

  it('fotografias de pessoas devem ser quadradas', () => {
    expect(avaliarImagem({ largura: 600, altura: 600, bytes: 1 }, TAMANHOS.pessoa)).toEqual([])
    expect(avaliarImagem({ largura: 1200, altura: 600, bytes: 1 }, TAMANHOS.pessoa)[0]).toMatch(/quadrada/)
  })

  it('sem informação da imagem não avisa', () => {
    expect(avaliarImagem(null, TAMANHOS.capa)).toEqual([])
  })
})
