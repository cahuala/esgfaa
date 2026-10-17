import crypto from 'node:crypto'
import path from 'node:path'
import { createRequire } from 'node:module'
import { Router } from 'express'
import { z } from 'zod'
import { limitar } from '../middlewares/limites.js'
import { validar } from '../middlewares/validar.js'
import { paginaLeitor } from '../leitorPacote.js'
import { caminhoSeguro, tipoDoFicheiro } from '../../../infraestrutura/ficheiros/pacotes.js'

const exigir = createRequire(import.meta.url)
const RAIZ_H5P = path.join(path.dirname(exigir.resolve('h5p-standalone/package.json')), 'dist')
const pToken = z.object({ token: z.string().min(20).max(1000) })
const estado = z.object({
  estado: z.enum(['iniciado', 'concluido', 'aprovado', 'reprovado']).optional(),
  nota: z.union([z.number().min(0).max(20), z.null()]).optional(),
  dados: z.record(z.string().max(255), z.union([z.string().max(70_000), z.number(), z.boolean(), z.null()])).optional(),
  tempoSegundos: z.number().min(0).max(1e8).optional(),
})

/*
  /api/pacotes/<token>/… — o leitor e os ficheiros de um pacote SCORM ou H5P, mostrados numa moldura do portal.
  O endereço leva o token (não há cabeçalho de sessão nos pedidos que o pacote faz sozinho). A página pode
  estar numa moldura do portal (frame-ancestors); os ficheiros do pacote correm com os seus próprios scripts.
*/
export function rotasPacotes({ servicos, config }) {
  const r = Router()
  r.use(limitar(config.limites.pacotes))
  const p = servicos.ensino.pacotes
  const molduras = ["'self'", ...config.origens].join(' ')
  const deixarEmMoldura = (res) => { res.removeHeader('X-Frame-Options'); res.set('Cache-Control', 'private, no-store') }

  // leitor H5P (biblioteca h5p-standalone)
  r.get('/__h5p/*caminho', (req, res) => {
    const c = caminhoSeguro([].concat(req.params.caminho).join('/'))
    if (!c) return res.status(404).json({ erro: 'Não encontrado.' })
    res.set({ 'Content-Type': tipoDoFicheiro(c), 'Cache-Control': 'public, max-age=86400' })
    res.removeHeader('Content-Security-Policy')
    res.sendFile(path.join(RAIZ_H5P, c), { dotfiles: 'deny' }, (e) => { if (e && !res.headersSent) res.status(404).json({ erro: 'Não encontrado.' }) })
  })

  r.get('/:token/__leitor', validar({ params: pToken }), async (req, res) => {
    const D = await p.leitor(req.dados.params.token)
    const nonce = crypto.randomBytes(16).toString('base64')
    const base = `${req.baseUrl}/${req.dados.params.token}`
    deixarEmMoldura(res)
    res.set({
      'Content-Type': 'text/html; charset=utf-8',
      // o leitor H5P escreve scripts na página (H5PIntegration): aí não há nonce. A página não tem cookies nem sessão.
      'Content-Security-Policy': `default-src 'self' data: blob:; script-src 'self' ${D.tipo === 'h5p' ? "'unsafe-inline'" : `'nonce-${nonce}'`} 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' data: blob: https:; frame-src 'self' https:; connect-src 'self'; font-src 'self' data:; frame-ancestors ${molduras}`,
    })
    res.send(paginaLeitor(D, { nonce, base, raizH5p: `${req.baseUrl}/__h5p` }))
  })

  r.post('/:token/__estado', validar({ params: pToken, body: estado }), async (req, res) => res.json(await p.guardarEstado(req.dados.params.token, req.dados.body)))

  r.get('/:token/*caminho', validar({ params: z.object({ token: pToken.shape.token, caminho: z.union([z.string(), z.array(z.string())]) }) }), async (req, res) => {
    const f = await p.ficheiro(req.dados.params.token, [].concat(req.dados.params.caminho).join('/'))
    deixarEmMoldura(res)
    // o conteúdo do pacote traz os seus scripts: só se limita onde pode ser posto em moldura
    res.set({ 'Content-Type': tipoDoFicheiro(f), 'Content-Security-Policy': `frame-ancestors ${molduras}`, 'X-Content-Type-Options': 'nosniff' })
    res.sendFile(f, { dotfiles: 'allow' })
  })
  return r
}
