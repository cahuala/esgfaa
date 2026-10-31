import http from 'node:http'
import { once } from 'node:events'

const pausa = () => new Promise((r) => setTimeout(r, 50))

// abre o fluxo de eventos (SSE) de uma rota e junta os avisos que chegam
export async function abrirEventos(app, caminho, token) {
  const srv = app.listen(0)
  await once(srv, 'listening')
  const recebidos = []
  const req = http.get({ port: srv.address().port, path: caminho, headers: token ? { authorization: `Bearer ${token}` } : {} })
  const res = await new Promise((ok, falha) => { req.on('response', ok); req.on('error', falha) })
  res.setEncoding('utf8')
  let resto = ''
  res.on('data', (d) => {
    resto += d
    for (let i = resto.indexOf('\n\n'); i >= 0; i = resto.indexOf('\n\n')) {
      const linha = resto.slice(0, i).split('\n').find((l) => l.startsWith('data: '))
      resto = resto.slice(i + 2)
      if (linha) recebidos.push(JSON.parse(linha.slice(6)))
    }
  })
  return {
    estado: res.statusCode,
    tipo: res.headers['content-type'],
    recebidos,
    // espera até chegar um aviso deste tipo (no máximo 3 s)
    async esperar(tipo) {
      for (let t = 0; t < 60 && !recebidos.some((e) => e.tipo === tipo); t++) await pausa()
      return recebidos.filter((e) => e.tipo === tipo)
    },
    fechar() {
      req.destroy()
      srv.close()
    },
  }
}
