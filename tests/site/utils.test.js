import { describe, it, expect } from 'vitest'
import { iniciais, tempoLeitura, normalizar, ancora, subtitulosDe } from '../../src/utils/texto'
import { formatarData, formatarDataLonga, formatarMesAno, paraData } from '../../src/utils/datas'
import { dataHora, dataCurta } from '../../src/admin/formatar'

describe('texto', () => {
  it('iniciais ignoram a patente abreviada', () => {
    expect(iniciais('Gen. Carlos Vieira')).toBe('CV')
  })

  it('tempo de leitura conta texto simples e HTML', () => {
    const palavras = Array(400).fill('palavra').join(' ')
    expect(tempoLeitura([{ tipo: 'paragrafo', texto: palavras }])).toBe(2)
    expect(tempoLeitura([{ tipo: 'texto', html: `<p>${palavras}</p><p>${palavras}</p>` }])).toBe(4)
    expect(tempoLeitura([])).toBe(1)
  })

  it('normalizar e âncoras sem acentos', () => {
    expect(normalizar('Liderança Estratégica')).toBe('lideranca estrategica')
    expect(ancora('Um ano centrado na liderança!')).toBe('um-ano-centrado-na-lideranca')
  })

  it('subtítulos de blocos antigos e de texto formatado', () => {
    const blocos = [
      { tipo: 'subtitulo', texto: 'Contexto' },
      { tipo: 'texto', html: '<h2>Defesa &amp; Segurança</h2><p>x</p><h2 style="text-align:center"><strong>Futuro</strong></h2><h3>Não</h3>' },
    ]
    expect(subtitulosDe(blocos)).toEqual(['Contexto', 'Defesa & Segurança', 'Futuro'])
  })
})

describe('datas', () => {
  it('formata sem problemas de fuso horário', () => {
    expect(paraData('2026-01-01').getDate()).toBe(1)
    expect(formatarData('2026-09-05')).toBe('05 Set 2026')
    expect(formatarDataLonga('2026-12-25')).toBe('25 de dezembro de 2026')
    expect(formatarMesAno('2026-10-03')).toBe('Outubro de 2026')
  })

  it('dataHora aceita o formato da base de dados e ISO', () => {
    const a = dataHora('2026-10-09 09:21:50')
    const b = dataHora('2026-10-09T09:21:50.000Z')
    expect(a).toBe(b)
    expect(a).toMatch(/^09\/10\/26/)
    expect(dataHora(null)).toBe('—')
    expect(dataHora('lixo')).toBe('—')
    expect(dataCurta('2026-10-09')).toBe('09/10/2026')
  })
})
