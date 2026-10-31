/*
  Avisos instantâneos do servidor (Server-Sent Events). Lê-se com fetch, e não com EventSource, para levar os
  cabeçalhos da sessão (cookie + X-Sessao ou o token de reserva). Se a ligação cair, volta a ligar
  (2 s, 4 s… até 30 s); sem sessão (401/403) desiste. O aviso só diz o que mudou: a página volta a pedir.
  Devolve a função que desliga.
*/
export function ouvirTempoReal(url, opcoes, aoAviso) {
  let parar = false
  let controlo = null
  let espera = 2000

  async function ler(resposta) {
    const leitor = resposta.body.pipeThrough(new TextDecoderStream()).getReader()
    let resto = ''
    for (;;) {
      const { value, done } = await leitor.read()
      if (done) return
      resto += value
      for (let i = resto.indexOf('\n\n'); i >= 0; i = resto.indexOf('\n\n')) {
        const linha = resto.slice(0, i).split('\n').find((l) => l.startsWith('data: '))
        resto = resto.slice(i + 2)
        if (linha) {
          try { aoAviso(JSON.parse(linha.slice(6))) } catch { /* aviso inválido */ }
        }
      }
    }
  }

  async function ligar() {
    while (!parar) {
      controlo = new AbortController()
      try {
        const r = await fetch(url, { ...opcoes(), cache: 'no-store', signal: controlo.signal })
        if (r.status === 401 || r.status === 403) return
        if (!r.ok || !r.body) throw new Error('sem fluxo')
        espera = 2000
        await ler(r)
      } catch {
        if (parar) return
      }
      await new Promise((ok) => setTimeout(ok, espera))
      espera = Math.min(espera * 2, 30_000)
    }
  }

  if (typeof fetch === 'function' && typeof TextDecoderStream === 'function' && url) ligar()
  return () => {
    parar = true
    controlo?.abort()
  }
}
