import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import NaoSouRobo from '../../src/components/NaoSouRobo/NaoSouRobo'
import { sha256Js } from '../../src/utils/provaRobo'

describe('caixa «Não sou um robô»', () => {
  it('se o servidor não pede a verificação, a caixa não aparece e o botão de entrar fica livre', async () => {
    const aoMudar = vi.fn()
    const { container } = render(<NaoSouRobo api={async () => ({ ativo: false })} aoMudar={aoMudar} />)
    await waitFor(() => expect(aoMudar).toHaveBeenCalledWith(undefined))
    expect(container.querySelector('.nsr')).toBeNull()
  })

  it('ao marcar, resolve o desafio e entrega a prova', async () => {
    const sal = `${Date.now() + 5 * 60_000}.teste.`
    const desafio = { ativo: true, algoritmo: 'SHA-256', sal, desafio: sha256Js(`${sal}321`), maximo: 2000, assinatura: 'x' }
    const aoMudar = vi.fn()
    render(<NaoSouRobo api={async () => desafio} aoMudar={aoMudar} />)
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Não sou um robô' }))
    await waitFor(() => expect(aoMudar).toHaveBeenLastCalledWith(expect.objectContaining({ numero: 321, assinatura: 'x' })))
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'true')
  })
})
