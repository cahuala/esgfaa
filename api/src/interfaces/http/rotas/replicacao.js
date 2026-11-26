import express from 'express'
import { verificarAssinatura } from '../../../infraestrutura/replicacao/motor.js'

/*
  O servidor online recebe aqui cada troca dos sistemas internos (a Gestão Escolar e a Gestão do Site): o que mudou
  lá, e responde com o que mudou cá desde a última troca. Pedido assinado com a chave partilhada (REPLICACAO_CHAVE);
  o corpo lê-se tal como vem (a assinatura é sobre ele).
*/
export function rotasReplicacao({ contentor }) {
  const r = express.Router()
  const rep = contentor.replicacao
  r.post('/trocar', express.raw({ type: 'application/json', limit: '64mb' }), async (req, res, next) => {
    try {
      const sistema = String(req.get('x-sistema') || '')
      const corpo = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : ''
      if (!rep || rep.sistema !== 'online' || !rep.pares.includes(sistema)) return res.status(404).json({ erro: 'Não encontrado.' })
      if (!verificarAssinatura(rep.chave, sistema, req.get('x-data'), corpo, req.get('x-assinatura'))) return res.status(401).json({ erro: 'Assinatura inválida.' })
      res.json(await rep.servirTroca(sistema, JSON.parse(corpo || '{}')))
    } catch (e) { next(e) }
  })
  return r
}
