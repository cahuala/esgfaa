import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { Escolha } from '../../src/pessoal/componentes/Ui'

const ESTADOS = { destacado: 'Destacado', em_missao: 'Em missão' }
function Ficha({ inicial = 'destacado' }) {
  const [v, setV] = useState(inicial)
  return <><Escolha aria-label="Estado" valor={v} aoMudar={setV} opcoes={ESTADOS} vazio="Ao serviço" /><output>{v || 'vazio'}</output></>
}

describe('escolha com a opção vazia com nome («Ao serviço»)', () => {
  it('escolher «Ao serviço» fica escrito no campo (antes ficava em branco)', () => {
    render(<Ficha />)
    const campo = screen.getByLabelText('Estado')
    fireEvent.focus(campo)
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Ao serviço' }))
    expect(screen.getByRole('status').textContent).toBe('vazio')
    expect(campo.value).toBe('Ao serviço')
  })

  it('escrever e sair do campo com Tab escolhe a opção realçada', async () => {
    render(<Ficha />)
    const campo = screen.getByLabelText('Estado')
    fireEvent.focus(campo)
    fireEvent.change(campo, { target: { value: 'ao serv' } })
    fireEvent.blur(campo)
    await act(() => new Promise((r) => setTimeout(r, 200)))
    expect(screen.getByRole('status').textContent).toBe('vazio')
    expect(campo.value).toBe('Ao serviço')
  })

  it('o «—» continua em branco', () => {
    render(<Escolha aria-label="Outro" valor="" aoMudar={() => {}} opcoes={ESTADOS} />)
    expect(screen.getByLabelText('Outro').value).toBe('')
  })
})
