import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ConteudoRico from '../../src/components/ConteudoRico/ConteudoRico'

const mostrar = (html) => render(<ConteudoRico blocos={[{ tipo: 'texto', html }]} />).container

describe('ConteudoRico (corpo das notícias no site)', () => {
  it('retira scripts, eventos e ligações javascript:', () => {
    const c = mostrar('<p onclick="alert(1)">Olá<script>alert(2)</script></p><img src="x" onerror="alert(3)"><a href="javascript:alert(4)">ligação</a>')
    expect(c.querySelector('script')).toBeNull()
    expect(c.innerHTML).not.toMatch(/onclick|onerror|javascript:/)
    expect(screen.getByText('Olá')).toBeInTheDocument()
  })

  it('só deixa vídeos incorporados do YouTube', () => {
    const c = mostrar('<iframe src="https://www.youtube-nocookie.com/embed/abc"></iframe><iframe src="https://mal.com/x"></iframe>')
    const frames = [...c.querySelectorAll('iframe')]
    expect(frames).toHaveLength(1)
    expect(frames[0].getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/abc')
  })

  it('mantém imagens posicionadas e dá âncoras aos subtítulos', () => {
    const c = mostrar('<h2>Contexto Estratégico</h2><figure data-tipo="imagem" data-posicao="direita" style="width:45%"><img src="/uploads/a.jpg" alt="Foto"><figcaption>Legenda</figcaption></figure>')
    expect(c.querySelector('h2').id).toBe('contexto-estrategico')
    expect(c.querySelector('figure').dataset.posicao).toBe('direita')
  })

  it('clicar numa imagem do texto abre o visualizador', () => {
    const c = mostrar('<p>x</p><figure data-tipo="imagem"><img src="/uploads/a.jpg" alt="Foto"><figcaption>Legenda da foto</figcaption></figure>')
    fireEvent.click(c.querySelector('img'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('blocos antigos (parágrafo, subtítulo, citação) continuam a aparecer', () => {
    render(<ConteudoRico blocos={[{ tipo: 'paragrafo', texto: 'Parágrafo antigo' }, { tipo: 'citacao', texto: 'Citação', autor: 'Autor' }]} />)
    expect(screen.getByText('Parágrafo antigo')).toBeInTheDocument()
    expect(screen.getByText('Citação')).toBeInTheDocument()
  })
})
