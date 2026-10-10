import { describe, it, expect } from 'vitest'
import { figuraHtml, galeriaHtml, videoHtml, blocosParaHtml, htmlVazio, prepararCorpo, limparCorpo, medirCorpo } from '../../src/admin/editor/normalizar'

describe('normalização do corpo (editor)', () => {
  it('figura com posição, largura e legenda escapada', () => {
    const h = figuraHtml({ src: '/uploads/a.jpg', legenda: '<script>x</script> "aspas"', posicao: 'esquerda' })
    expect(h).toContain('data-posicao="esquerda"')
    expect(h).toContain('style="width:45%"')
    expect(h).not.toContain('<script>')
    expect(h).toContain('&lt;script&gt;')
    expect(h).toContain('&quot;aspas&quot;')
  })

  it('figura larga não tem largura fixa', () => {
    expect(figuraHtml({ src: 'a', posicao: 'larga', largura: 60 })).not.toContain('width')
  })

  it('src com aspas não sai do atributo', () => {
    const h = figuraHtml({ src: 'x" onerror="alert(1)' })
    expect(h).toContain('src="x&quot; onerror=&quot;alert(1)"')
  })

  it('galeria entre 2 e 3 colunas e vídeo do YouTube ou ficheiro', () => {
    expect(galeriaHtml({ imagens: [{ src: 'a' }] })).toContain('data-colunas="2"')
    expect(galeriaHtml({ imagens: Array(5).fill({ src: 'a' }) })).toContain('data-colunas="3"')
    expect(videoHtml({ youtube: 'abc' })).toContain('https://www.youtube-nocookie.com/embed/abc')
    expect(videoHtml({ src: '/uploads/v.mp4', poster: '/p.jpg' })).toContain('<video src="/uploads/v.mp4" poster="/p.jpg"')
  })

  it('converte blocos antigos em HTML (com escape)', () => {
    const html = blocosParaHtml([
      { tipo: 'paragrafo', texto: 'Olá <b>mundo</b>' },
      { tipo: 'subtitulo', texto: 'Título' },
      { tipo: 'lista', ordenada: true, itens: ['um', 'dois'] },
      { tipo: 'citacao', texto: 'Frase', autor: 'Autor' },
      { tipo: 'desconhecido', texto: 'x' },
    ])
    expect(html).toBe('<p>Olá &lt;b&gt;mundo&lt;/b&gt;</p><h2>Título</h2><ol><li><p>um</p></li><li><p>dois</p></li></ol><blockquote><p>Frase</p><p>— Autor</p></blockquote>')
  })

  it('HTML do antigo Quill: alinhamentos e espaços', () => {
    expect(blocosParaHtml([{ tipo: 'texto', html: '<p class="ql-align-center">a&nbsp;b</p>' }])).toBe('<p style="text-align: center">a b</p>')
  })

  it('corpo vazio não se guarda; corpo antigo abre como um só bloco', () => {
    expect(htmlVazio('<p></p><p><br></p>')).toBe(true)
    expect(limparCorpo([{ tipo: 'texto', html: '<p> </p>' }])).toEqual([])
    expect(prepararCorpo([{ tipo: 'paragrafo', texto: 'a' }, { tipo: 'paragrafo', texto: 'b' }])).toEqual([{ tipo: 'texto', html: '<p>a</p><p>b</p>' }])
  })

  it('mede palavras sem contar legendas de imagens', () => {
    const m = medirCorpo([{ tipo: 'texto', html: `<p>um dois três</p>${figuraHtml({ src: 'a', legenda: 'muitas palavras na legenda' })}` }], 'título')
    expect(m.palavras).toBe(4)
    expect(m.minutos).toBe(1)
  })
})
