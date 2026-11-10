import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { InputData } from '../../src/pessoal/componentes/Ui'

function Formulario({ inicial = '' }) {
  const [v, setV] = useState(inicial)
  return <><InputData aria-label="Data" value={v} onChange={(e) => setV(e.target.value)} /><output>{v}</output></>
}

describe('campo de data (dia/mês/ano)', () => {
  it('mostra a data guardada em dd/mm/aaaa', () => {
    render(<Formulario inicial="2026-12-25" />)
    expect(screen.getByLabelText('Data').value).toBe('25/12/2026')
  })

  it('escreve-se só com algarismos e devolve aaaa-mm-dd', () => {
    render(<Formulario />)
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '05032027' } })
    expect(screen.getByLabelText('Data').value).toBe('05/03/2027')
    expect(screen.getByRole('status').textContent).toBe('2027-03-05')
  })

  it('uma data impossível não muda o valor e volta atrás ao sair do campo', () => {
    render(<Formulario inicial="2026-01-10" />)
    const campo = screen.getByLabelText('Data')
    fireEvent.change(campo, { target: { value: '31/02/2026' } })
    expect(screen.getByRole('status').textContent).toBe('2026-01-10')
    fireEvent.blur(campo)
    expect(campo.value).toBe('10/01/2026')
  })

  it('apagar tudo limpa a data', () => {
    render(<Formulario inicial="2026-01-10" />)
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '' } })
    expect(screen.getByRole('status').textContent).toBe('')
  })
})
