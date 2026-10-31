/*
  Avisos instantâneos às páginas abertas (painel, portal e site). O aviso diz só «isto mudou» ({ tipo, … }):
  a página volta a pedir os dados pelas rotas de sempre, que verificam as permissões.
  emitir: logo, às contas indicadas (ou a todos os da aplicação); avisar: a todos, juntando os avisos iguais
  que chegam no mesmo segundo (uma importação ou muitos comentários seguidos dão um só aviso).
*/
export class TempoReal {
  #ouvintes = new Set()
  #emEspera = new Map()

  constructor({ esperaMs = 1000 } = {}) {
    this.esperaMs = esperaMs
  }

  ouvir(app, enviar, { conta = null } = {}) {
    const o = { app, enviar, conta }
    this.#ouvintes.add(o)
    return () => this.#ouvintes.delete(o)
  }

  emitir(app, dados, { contas } = {}) {
    const ids = contas ? new Set(contas.map(Number)) : null
    for (const o of this.#ouvintes) {
      if (o.app !== app || (ids && !ids.has(o.conta))) continue
      try { o.enviar(dados) } catch { /* ligação já fechada */ }
    }
  }

  avisar(app, dados) {
    const chave = `${app}|${JSON.stringify(dados)}`
    if (this.#emEspera.has(chave)) return
    const t = setTimeout(() => { this.#emEspera.delete(chave); this.emitir(app, dados) }, this.esperaMs)
    t.unref?.()
    this.#emEspera.set(chave, t)
  }

  get ligados() {
    return this.#ouvintes.size
  }
}

/*
  Abre o fluxo de eventos (Server-Sent Events) e liga-o ao TempoReal. A ligação fecha-se sozinha ao fim de
  15 minutos e o navegador volta a ligar (a sessão é verificada outra vez).
*/
export function fluxoEventos(req, res, subscrever, { duracaoMs = 15 * 60_000, batidaMs = 25_000 } = {}) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store, no-transform',
    'X-Accel-Buffering': 'no',
    // sem compressão: cada aviso tem de sair logo (o proxy não comprime o que já vem codificado)
    'Content-Encoding': 'identity',
  })
  res.flushHeaders?.()
  const escrever = (texto) => { if (!res.writableEnded) res.write(texto) }
  escrever('retry: 3000\n\n')
  const largar = subscrever((dados) => escrever(`data: ${JSON.stringify(dados)}\n\n`))
  const batida = setInterval(() => escrever(': ping\n\n'), batidaMs)
  const fim = setTimeout(() => res.end(), duracaoMs)
  batida.unref?.()
  fim.unref?.()
  const fechar = () => { clearInterval(batida); clearTimeout(fim); largar() }
  req.on('close', fechar)
  res.on('close', fechar)
}
