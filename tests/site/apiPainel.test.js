import { describe, it, expect, vi } from 'vitest'
import { api, guardarToken, lerToken, definirAoExpirar } from '../../src/admin/api'

const responder = (corpo, status = 200) => vi.fn(() => Promise.resolve(new Response(status === 204 ? null : JSON.stringify(corpo), { status })))

describe('cliente da API do painel', () => {
  it('envia o token e JSON', async () => {
    guardarToken('abc')
    const f = responder({ ok: 1 })
    vi.stubGlobal('fetch', f)
    await api('/colecoes/noticias', { metodo: 'POST', corpo: { titulo: 'x' } })
    const [url, opcoes] = f.mock.calls[0]
    expect(url).toBe('http://api.teste/api/admin/colecoes/noticias')
    expect(opcoes.headers).toEqual({ Authorization: 'Bearer abc', 'Content-Type': 'application/json' })
    expect(opcoes.body).toBe('{"titulo":"x"}')
  })

  it('o token fica só na sessão do separador', () => {
    guardarToken('t1')
    expect(sessionStorage.getItem('esgfaa-admin-sessao')).toBe('t1')
    expect(localStorage.length).toBe(0)
    guardarToken(null)
    expect(lerToken()).toBeNull()
  })

  it('401 termina a sessão (exceto ao entrar)', async () => {
    const expirar = vi.fn()
    definirAoExpirar(expirar)
    vi.stubGlobal('fetch', responder({ erro: 'Sessão expirada. Entre novamente.' }, 401))
    await expect(api('/eu')).rejects.toThrow('Sessão expirada')
    expect(expirar).toHaveBeenCalledTimes(1)
    await expect(api('/entrar', { metodo: 'POST', corpo: {} })).rejects.toThrow()
    expect(expirar).toHaveBeenCalledTimes(1)
  })

  it('mostra a mensagem de conta bloqueada (423)', async () => {
    vi.stubGlobal('fetch', responder({ erro: 'Demasiadas tentativas falhadas. A conta ficou bloqueada durante 15 minutos.', codigo: 'conta_bloqueada' }, 423))
    await expect(api('/entrar', { metodo: 'POST', corpo: {} })).rejects.toThrow(/bloqueada/)
  })

  it('204 devolve null; falha de rede tem mensagem clara', async () => {
    vi.stubGlobal('fetch', responder(null, 204))
    expect(await api('/sair', { metodo: 'POST' })).toBeNull()
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))))
    await expect(api('/eu')).rejects.toThrow('Não foi possível contactar o servidor')
  })

  it('envia ficheiros em multipart', async () => {
    const f = responder([{ url: 'x' }], 201)
    vi.stubGlobal('fetch', f)
    await api('/ficheiros', { metodo: 'POST', ficheiros: [new File(['a'], 'a.png', { type: 'image/png' })] })
    const { body, headers } = f.mock.calls[0][1]
    expect(body).toBeInstanceOf(FormData)
    expect(body.getAll('ficheiros')).toHaveLength(1)
    expect(headers['Content-Type']).toBeUndefined()
  })
})
