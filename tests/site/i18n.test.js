import { afterEach, describe, expect, it } from 'vitest'
import textos1 from '../../src/i18n/textos1'
import textos2 from '../../src/i18n/textos2'
import { definirLingua, t } from '../../src/i18n/linguas'
import { aplicarTextos } from '../../src/i18n/aplicar'
import { contagem, formatarDataLonga } from '../../src/utils/datas'

const marcadores = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('idiomas do site', () => {
  afterEach(() => definirLingua('pt'))

  it('cada texto tem as 3 traduções, com os mesmos marcadores {…} e sem repetidos', () => {
    const linhas = [...textos1, ...textos2]
    const vistos = new Set()
    for (const l of linhas) {
      expect(l, l[0]).toHaveLength(4)
      expect(vistos.has(l[0]), `repetido: ${l[0]}`).toBe(false)
      vistos.add(l[0])
      for (const tr of l.slice(1)) {
        expect(tr.trim(), l[0]).not.toBe('')
        expect(marcadores(tr), l[0]).toEqual(marcadores(l[0]))
      }
    }
  })

  it('t() traduz, preenche os marcadores e devolve o português quando falta', () => {
    expect(t('Notícias')).toBe('Notícias')
    definirLingua('en')
    expect(t('Notícias')).toBe('News')
    expect(t('Passo {n} de {total}', { n: 2, total: 4 })).toBe('Step 2 of 4')
    expect(t('Texto que não existe')).toBe('Texto que não existe')
    definirLingua('fr')
    expect(t('Faltam {n} dias', { n: 3 })).toBe('Dans 3 jours')
    definirLingua('xx')
    expect(t('Notícias')).toBe('Notícias')
  })

  it('as datas seguem a língua (o português mantém o formato de sempre)', () => {
    expect(formatarDataLonga('2026-09-12')).toBe('12 de setembro de 2026')
    definirLingua('en')
    expect(formatarDataLonga('2026-09-12')).toBe('12 September 2026')
    definirLingua('es')
    expect(formatarDataLonga('2026-09-12')).toBe('12 de septiembre de 2026')
    const d = new Date()
    const hoje = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    expect(contagem(hoje)).toBe('Hoy')
  })

  it('aplica as traduções dos conteúdos sem tocar no original', () => {
    const n = { titulo: 'Abertura', conteudo: [{ tipo: 'paragrafo', texto: 'Olá' }], capa: '/a.png' }
    const en = aplicarTextos(n, { titulo: 'Opening', 'conteudo.0.texto': 'Hello', 'nao.existe': 'x' })
    expect(en).toEqual({ titulo: 'Opening', conteudo: [{ tipo: 'paragrafo', texto: 'Hello' }], capa: '/a.png' })
    expect(n.titulo).toBe('Abertura')
  })
})
