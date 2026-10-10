import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Interacoes from '../../src/components/Interacoes/Interacoes'
import { ConteudoContexto } from '../../src/conteudo/contexto'

const resumo = (extra = {}) => ({ gostos: 2, gostei: false, visualizacoes: 7, comentarios: [], ...extra })
const resposta = (corpo, status = 200) => Promise.resolve(new Response(status === 204 ? null : JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } }))

function montar() {
  const atualizarEstatisticas = vi.fn()
  render(
    <ConteudoContexto.Provider value={{ atualizarEstatisticas }}>
      <Interacoes colecao="noticias" id="abertura" titulo="Abertura" />
    </ConteudoContexto.Provider>,
  )
  return { atualizarEstatisticas }
}

describe('Interacoes (gostos e comentários no site)', () => {
  let fetchMock
  beforeEach(() => {
    fetchMock = vi.fn((url, opcoes = {}) => {
      if (url.endsWith('/visualizacao')) return resposta(null, 204)
      if (url.endsWith('/gosto')) return resposta(resumo({ gostos: 3, gostei: true }))
      if (url.endsWith('/comentarios') && opcoes.method === 'POST') {
        const { nome, texto } = JSON.parse(opcoes.body)
        if (texto.length < 2) return resposta({ erro: 'O comentário deve ter entre 2 e 2000 caracteres.' }, 400)
        return resposta(resumo({ comentarios: [{ id: 1, nome, texto, data: '2026-10-10 10:00:00' }] }), 201)
      }
      return resposta(resumo())
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  it('mostra contagens e regista a visualização com o id anónimo do visitante', async () => {
    montar()
    expect(await screen.findByText(/7 visualizações/)).toBeInTheDocument()
    const visita = fetchMock.mock.calls.find(([u]) => u.endsWith('/visualizacao'))
    expect(visita[0]).toBe('http://api.teste/api/publico/interacoes/noticias/abertura/visualizacao')
    expect(JSON.parse(visita[1].body).visitante).toBe(localStorage.getItem('esgfaa-visitante'))
  })

  it('dar gosto atualiza o botão', async () => {
    const { atualizarEstatisticas } = montar()
    const botao = await screen.findByRole('button', { pressed: false })
    await userEvent.click(botao)
    await waitFor(() => expect(screen.getByRole('button', { pressed: true })).toBeInTheDocument())
    expect(atualizarEstatisticas).toHaveBeenLastCalledWith('noticias', 'abertura', { gostos: 3, comentarios: 0, visualizacoes: 7 })
  })

  it('comentários com HTML aparecem como texto (nunca executam)', async () => {
    montar()
    await screen.findByText(/visualizações/)
    await userEvent.type(screen.getByLabelText('Nome'), 'Visitante')
    await userEvent.type(screen.getByLabelText('Comentário'), '<img src=x onerror=alert(1)>')
    await userEvent.click(screen.getByRole('button', { name: 'Publicar comentário' }))
    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeInTheDocument()
    expect(document.querySelector('img[src="x"]')).toBeNull()
  })

  it('mostra o erro devolvido pela API', async () => {
    montar()
    await screen.findByText(/visualizações/)
    await userEvent.type(screen.getByLabelText('Nome'), 'Ana')
    await userEvent.type(screen.getByLabelText('Comentário'), 'x')
    await userEvent.click(screen.getByRole('button', { name: 'Publicar comentário' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('O comentário deve ter entre 2 e 2000 caracteres.')
  })

  it('se a API falhar mostra só a partilha', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('rede'))))
    montar()
    expect(await screen.findByText(/temporariamente indisponíveis/)).toBeInTheDocument()
    expect(screen.getByLabelText('Partilhar no WhatsApp')).toBeInTheDocument()
  })
})
