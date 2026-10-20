import { describe, expect, it } from 'vitest'
import { modelosDe, oficialGeneral } from '../../src/admin/paginas/academico/documentos/diplomas'

describe('certificados e diplomas: o modelo de cada estudante', () => {
  it('o diploma vai pela categoria: oficiais generais «Atesta-se»; os outros, o decorado', () => {
    for (const p of ['Brigadeiro', 'Tenente-General', 'General', 'General de Exército', 'General de Aviação', 'Contra-Almirante', 'Vice-Almirante', 'Almirante', 'Almirante da Armada']) expect(oficialGeneral(p)).toBe(true)
    for (const p of ['Coronel', 'Capitão-de-Mar-e-Guerra', 'Tenente-Coronel', 'Major', 'Capitão-Tenente', '']) expect(oficialGeneral(p)).toBe(false)
    expect(modelosDe('Curso Superior de Comando e Direcção', 'Vice-Almirante').diploma).toBe('atesta')
    expect(modelosDe('Curso de Estratégia e Arte Operativa', 'Coronel').diploma).toBe('outorga')
  })

  it('o certificado vai pelo curso: Estratégia e Arte Operativa com tabela; os outros em duas colunas', () => {
    expect(modelosDe('17.º Curso de Estratégia e Arte Operativa', 'Brigadeiro').certificado).toBe('tabela')
    expect(modelosDe('Curso Superior de Comando e Direcção', 'Coronel').certificado).toBe('lista')
    expect(modelosDe('CoaMP', 'Major').certificado).toBe('lista')
  })
})
