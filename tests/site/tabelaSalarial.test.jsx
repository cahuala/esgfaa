import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const linha = { posto: 'major', base: 324000, condicaoMilitar: 97200, representacao: 0, comandoChefia: 16200, iliquido: 437400, caixaSS: 13122, liquido: 424278, manual: [] }
vi.mock('../../src/pessoal/useDados', () => ({ useDados: () => ({ dados: { percentagens: { condicaoMilitar: 30, comandoChefia: 5, caixaSS: 3 }, representacao: { coronel: 56008.72 }, grupos: [{ fps: 'QP', nome: 'Quadro Permanente', linhas: [linha] }] }, erro: null, recarregar: () => {} }) }))
vi.mock('../../src/pessoal/sessao', () => ({ useSessao: () => ({ ref: { ramos: { EXE: { nome: 'Exército' } }, postos: { EXE: [{ id: 'major', nome: 'Major', abreviatura: 'MAJ', categoria: 'oficial_superior' }] } }, pode: () => true, avisar: () => {} }) }))
vi.mock('../../src/pessoal/api', () => ({ api: vi.fn() }))
const { default: TabelaSalarial } = await import('../../src/pessoal/paginas/TabelaSalarial')

describe('tabela salarial dos militares', () => {
  it('a condição militar escreve-se à mão e o líquido acompanha', () => {
    render(<MemoryRouter><TabelaSalarial /></MemoryRouter>)
    expect(screen.getAllByText('424 278,00').length).toBeGreaterThan(0)
    fireEvent.change(screen.getByLabelText('Condição militar de Major (EXE, QP)'), { target: { value: '100000' } })
    // 324 000 + 100 000 + 16 200 = 440 200; − 3 % = 426 994
    expect(screen.getByText('426 994,00')).toBeTruthy()
  })
})
