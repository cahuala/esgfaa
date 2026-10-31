import express from 'express'

/*
  O protocolo «push» dos aparelhos de ponto (ZKTeco e compatíveis, também chamado ADMS ou iclock).
  No aparelho: Menu › Comunicação › Servidor (ADMS/Cloud) › endereço deste servidor e a porta.
  As respostas são texto simples; um aparelho por aprovar recebe 403 nos dados e volta a tentar mais tarde.
*/
export function rotasAparelhos(ponto) {
  const r = express.Router()
  const sn = (req) => String(req.query.SN ?? req.query.sn ?? '')
  const texto = (res, t, estado = 200) => res.status(estado).type('text/plain').send(t)
  const tratar = (fn) => async (req, res) => {
    try {
      await fn(req, res)
    } catch (e) {
      texto(res, `ERROR: ${e.codigo === 'validacao' ? e.message : 'falha no servidor'}`, e.codigo === 'validacao' ? 400 : 500)
      if (e.codigo !== 'invalido') console.error(JSON.stringify({ t: new Date().toISOString(), ponto: true, erro: e?.stack || String(e) }))
    }
  }
  r.get('/cdata', tratar(async (req, res) => texto(res, await ponto.apresentacao(sn(req), req.ip, { modelo: req.query.DeviceType ?? req.query.devicetype }))))
  r.post('/cdata', tratar(async (req, res) => {
    const n = await ponto.receber(sn(req), req.ip, String(req.query.table ?? '').toUpperCase(), typeof req.body === 'string' ? req.body : '')
    if (n === null) return texto(res, 'ERROR: aparelho por aprovar no Sistema de Pessoal', 403)
    texto(res, `OK: ${n}`)
  }))
  r.get('/getrequest', tratar(async (req, res) => texto(res, await ponto.ordens(sn(req), req.ip))))
  r.post('/devicecmd', tratar(async (req, res) => texto(res, await ponto.respostas(sn(req), req.ip, typeof req.body === 'string' ? req.body : ''))))
  r.get('/ping', (req, res) => texto(res, 'OK'))
  r.use((req, res) => texto(res, 'ERROR: desconhecido', 404))
  return r
}
