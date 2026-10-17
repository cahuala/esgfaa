import { describe, it, expect, vi } from 'vitest'
import { api, confirmarSessao, marcarSessao, temSessao, definirAoExpirar } from '../../src/admin/api'

const responder = (corpo, status = 200) => vi.fn(() => Promise.resolve(new Response(status === 204 ? null : JSON.stringify(corpo), { status })))

describe('cliente da API do painel', () => {
  it('envia o cookie da sessão (com o cabeçalho anti-CSRF) e JSON, sem token no JavaScript', async () => {
    marcarSessao(true)
    const f = responder({ ok: 1 })
    vi.stubGlobal('fetch', f)
    await api('/colecoes/noticias', { metodo: 'POST', corpo: { titulo: 'x' } })
    const [url, opcoes] = f.mock.calls[0]
    expect(url).toBe('http://api.teste/api/admin/colecoes/noticias')
    expect(opcoes.headers).toEqual({ 'X-Sessao': 'cookie', 'Content-Type': 'application/json' })
    expect(opcoes.credentials).toBe('include')
    expect(opcoes.body).toBe('{"titulo":"x"}')
  })

  it('no navegador fica só o sinal de sessão aberta, nunca o token', () => {
    marcarSessao(true)
    expect(localStorage.getItem('esgfaa-admin-sessao')).toBe('1')
    expect(sessionStorage.length).toBe(0)
    marcarSessao(null)
    expect(temSessao()).toBeNull()
  })

  it('API noutro domínio: se o navegador não guardar o cookie (Safari), usa o token de reserva; se guardar, ignora-o', async () => {
    // o cookie não chegou: /eu sem ele responde 401
    vi.stubGlobal('fetch', responder({ erro: 'Sessão em falta.' }, 401))
    await confirmarSessao({ sessao: 'cookie', tokenReserva: 'reserva-1' })
    const f = responder({ ok: 1 })
    vi.stubGlobal('fetch', f)
    await api('/eu')
    expect(f.mock.calls[0][1].headers).toEqual({ Authorization: 'Bearer reserva-1' })
    // mudar a palavra-passe nesse modo: o token novo passa a ser a reserva
    await confirmarSessao({ token: 'reserva-2' })
    await api('/eu')
    expect(f.mock.calls[1][1].headers).toEqual({ Authorization: 'Bearer reserva-2' })
    marcarSessao(null)
    // o cookie chegou: a reserva não se guarda
    vi.stubGlobal('fetch', responder({ id: 1 }))
    await confirmarSessao({ sessao: 'cookie', tokenReserva: 'reserva-3' })
    expect(sessionStorage.getItem('esgfaa-admin-sessao-reserva')).toBeNull()
    const g = responder({ ok: 1 })
    vi.stubGlobal('fetch', g)
    await api('/eu')
    expect(g.mock.calls[0][1].headers).toEqual({ 'X-Sessao': 'cookie' })
    marcarSessao(null)
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
