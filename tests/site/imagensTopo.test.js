import { describe, expect, it } from 'vitest'
import { IMAGENS_TOPO, imagemTopo } from '../../src/components/CabecalhoEditorial/imagensTopo'

describe('fotografia do topo das páginas', () => {
  it('vai pela secção do endereço; a escolhida no painel ganha à que vem com o site', () => {
    expect(imagemTopo('/Cursos/cem')).toBe(IMAGENS_TOPO.cursos)
    expect(imagemTopo('/Noticias', { noticias: '/m/n.jpg' })).toBe('/m/n.jpg')
    expect(imagemTopo('/Desconhecida', { geral: '/m/g.jpg' })).toBe('/m/g.jpg')
    expect(imagemTopo('/Desconhecida')).toBe(IMAGENS_TOPO.geral)
  })
})
