import { describe, expect, it } from 'vitest'
import { mensagensDosComandantes, paragrafos } from '../../src/components/MensagemComandante/comandantes'

describe('mensagens dos comandantes (site)', () => {
  const paginas = (mensagens) => ({ home: { comandante: { mensagens } } })
  it('o marcado «actual» primeiro; os outros são os anteriores, pela ordem; sem texto não contam', () => {
    const r = mensagensDosComandantes(paginas([
      { nome: 'A', mensagem: 'Texto A' },
      { nome: 'B', mensagem: 'Texto B', actual: true },
      { nome: 'C', mensagem: '   ' },
      { nome: 'D', mensagem: 'Texto D' },
    ]))
    expect(r.actual.nome).toBe('B')
    expect(r.anteriores.map((m) => m.nome)).toEqual(['A', 'D'])
  })
  it('sem nenhum marcado, o primeiro é o actual; sem mensagens, nada', () => {
    expect(mensagensDosComandantes(paginas([{ nome: 'A', mensagem: 'x' }, { nome: 'B', mensagem: 'y' }])).actual.nome).toBe('A')
    expect(mensagensDosComandantes(paginas([])).actual).toBeNull()
    expect(mensagensDosComandantes({}).actual).toBeNull()
  })
  it('parágrafos separados por uma linha em branco', () => {
    expect(paragrafos('Um.\n\nDois.\n  \nTrês.')).toEqual(['Um.', 'Dois.', 'Três.'])
  })
})
