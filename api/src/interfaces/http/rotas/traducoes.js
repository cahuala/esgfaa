import { Router } from 'express'
import { z } from 'zod'
import { validar } from '../middlewares/validar.js'
import * as E from '../esquemas.js'

// Traduções do site no painel: /api/admin/traducoes/… (já autenticado)
export function rotasTraducoes({ servicos }) {
  const r = Router()
  const t = servicos.traducoes
  const ctx = (req) => req.contexto
  const p = (req) => req.dados.params

  r.post('/completar', async (req, res) => res.status(202).json(await t.traduzirTudo(ctx(req))))
  // as traduções dos dados dos painéis (antes de /:colecao)
  const d = servicos.traducaoDados
  const pTexto = z.object({ lingua: z.enum(['en', 'fr', 'es']), chave: z.string().regex(/^[0-9a-f]{64}$/) })
  r.get('/dados', validar({ query: z.object({ lingua: z.enum(['en', 'fr', 'es']), q: z.string().max(200).optional(), revisto: z.enum(['sim', 'nao']).optional() }) }), async (req, res) => {
    const q = req.dados.query
    res.json(await d.listarRevisao(ctx(req), { lingua: q.lingua, q: q.q, revisto: q.revisto === undefined ? undefined : q.revisto === 'sim' }))
  })
  r.put('/dados/:lingua/:chave', validar({ params: pTexto, body: z.object({ texto: z.string().max(4000) }) }), async (req, res) => res.json(await d.corrigir(ctx(req), p(req).lingua, p(req).chave, req.dados.body.texto)))
  r.delete('/dados/:lingua/:chave', validar({ params: pTexto }), async (req, res) => { await d.apagarRevisao(ctx(req), p(req).lingua, p(req).chave); res.status(204).end() })
  r.get('/:colecao', validar({ params: z.object({ colecao: E.alvoTraducao.shape.colecao }) }), async (req, res) => res.json(await t.estadosDaColecao(ctx(req), p(req).colecao)))
  r.get('/:colecao/:id', validar({ params: E.alvoTraducao }), async (req, res) => res.json(await t.estado(ctx(req), p(req).colecao, p(req).id)))
  r.post('/:colecao/:id/:lingua/ia', validar({ params: E.alvoTraducaoLingua }), async (req, res) => res.json(await t.traduzirIA(ctx(req), p(req).colecao, p(req).id, p(req).lingua)))
  r.put('/:colecao/:id/:lingua', validar({ params: E.alvoTraducaoLingua, body: E.traducao }), async (req, res) => res.json(await t.guardar(ctx(req), p(req).colecao, p(req).id, p(req).lingua, req.dados.body)))
  r.delete('/:colecao/:id/:lingua', validar({ params: E.alvoTraducaoLingua }), async (req, res) => { await t.apagar(ctx(req), p(req).colecao, p(req).id, p(req).lingua); res.status(204).end() })
  return r
}
