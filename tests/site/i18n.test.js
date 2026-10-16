import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import textos1 from '../../src/i18n/textos1'
import textos2 from '../../src/i18n/textos2'
import { todasAsLinhas } from '../../src/i18n/dicionarios'
import { definirLingua, prepararLingua, t } from '../../src/i18n/linguas'
import { aplicarTextos } from '../../src/i18n/aplicar'
import { contagem, formatarDataLonga } from '../../src/utils/datas'

const marcadores = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('idiomas do site', () => {
  // muda a língua e carrega o dicionário (como no arranque da aplicação)
  const usar = (l) => { definirLingua(l); return prepararLingua() }
  beforeEach(() => usar('pt'))
  afterEach(() => usar('pt'))

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

  it('as tabelas do portal e do painel: 4 colunas, marcadores conservados e sem traduções contraditórias', () => {
    const vistas = new Map()
    for (const l of todasAsLinhas) {
      expect(l, l[0]).toHaveLength(4)
      for (const tr of l.slice(1)) {
        expect(tr.trim(), l[0]).not.toBe('')
        // a tradução pode largar um marcador que em português é só um artigo, nunca inventar um
        for (const m of marcadores(tr)) expect(marcadores(l[0]), `${l[0]} → ${tr}`).toContain(m)
      }
      const anterior = vistas.get(l[0])
      if (anterior) expect(l, `repetido com traduções diferentes: ${l[0]}`).toEqual(anterior)
      vistas.set(l[0], l)
    }
  })

  it('t() traduz, preenche os marcadores e devolve o português quando falta', async () => {
    expect(t('Notícias')).toBe('Notícias')
    await usar('en')
    expect(t('Notícias')).toBe('News')
    expect(t('Passo {n} de {total}', { n: 2, total: 4 })).toBe('Step 2 of 4')
    expect(t('Texto que não existe')).toBe('Texto que não existe')
    await usar('fr')
    expect(t('Faltam {n} dias', { n: 3 })).toBe('Dans 3 jours')
    await usar('xx')
    expect(t('Notícias')).toBe('Notícias')
  })

  it('as datas seguem a língua (o português mantém o formato de sempre)', async () => {
    expect(formatarDataLonga('2026-09-12')).toBe('12 de setembro de 2026')
    await usar('en')
    expect(formatarDataLonga('2026-09-12')).toBe('12 September 2026')
    await usar('es')
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
