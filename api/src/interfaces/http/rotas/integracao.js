import crypto from 'node:crypto'
import express from 'express'
import { z } from 'zod'

const JANELA_S = 300
const pessoa = z.object({
  ref: z.string().max(40), contaId: z.number().int().positive().optional(), tipo: z.enum(['docente', 'estudante']), nome: z.string().max(150), email: z.string().max(200), ativo: z.boolean(),
  dados: z.record(z.string(), z.string().max(120)).default({}),
})
const corpo = z.object({ pessoas: z.array(pessoa).max(200) })

/*
  Entrada do Sistema de Gestão de Pessoal (que corre na rede interna e só envia, nunca recebe).
  Cada pedido vem assinado com a chave partilhada: HMAC-SHA256 de "<data>.<corpo>", e a data
  (segundos) tem de estar a menos de 5 minutos da hora do servidor, para não se poder repetir mais tarde.
*/
export function rotasIntegracao({ servicos, config }) {
  const r = express.Router()
  r.post('/pessoal/contas', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
    const chave = config.chaveIntegracaoPessoal
    if (!chave) return res.status(404).json({ erro: 'Endereço não encontrado.', codigo: 'nao_encontrado' })
    const data = String(req.get('x-pessoal-data') || '')
    const assinatura = String(req.get('x-pessoal-assinatura') || '')
    const bruto = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0)
    const esperada = crypto.createHmac('sha256', chave).update(`${data}.`).update(bruto).digest()
    const recebida = /^[0-9a-f]{64}$/.test(assinatura) ? Buffer.from(assinatura, 'hex') : Buffer.alloc(0)
    const atual = /^\d{10}$/.test(data) && Math.abs(Date.now() / 1000 - Number(data)) <= JANELA_S
    if (!atual || recebida.length !== esperada.length || !crypto.timingSafeEqual(recebida, esperada)) {
      return res.status(401).json({ erro: 'Assinatura inválida ou fora de prazo.', codigo: 'nao_autenticado' })
    }
    let dados
    try {
      dados = corpo.parse(JSON.parse(bruto.toString('utf8')))
    } catch {
      return res.status(400).json({ erro: 'Pedido mal formado.', codigo: 'validacao' })
    }
    res.json(await servicos.pessoal.registo.sincronizarDoPessoal({ actor: null, ip: req.ip, agente: 'Sistema de Gestão de Pessoal' }, dados.pessoas))
  })
  return r
}
