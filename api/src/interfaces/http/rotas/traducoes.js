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

  r.get('/:colecao', validar({ params: z.object({ colecao: E.alvoTraducao.shape.colecao }) }), async (req, res) => res.json(await t.estadosDaColecao(ctx(req), p(req).colecao)))
  r.get('/:colecao/:id', validar({ params: E.alvoTraducao }), async (req, res) => res.json(await t.estado(ctx(req), p(req).colecao, p(req).id)))
  r.post('/:colecao/:id/:lingua/ia', validar({ params: E.alvoTraducaoLingua }), async (req, res) => res.json(await t.traduzirIA(ctx(req), p(req).colecao, p(req).id, p(req).lingua)))
  r.put('/:colecao/:id/:lingua', validar({ params: E.alvoTraducaoLingua, body: E.traducao }), async (req, res) => res.json(await t.guardar(ctx(req), p(req).colecao, p(req).id, p(req).lingua, req.dados.body)))
  r.delete('/:colecao/:id/:lingua', validar({ params: E.alvoTraducaoLingua }), async (req, res) => { await t.apagar(ctx(req), p(req).colecao, p(req).id, p(req).lingua); res.status(204).end() })
  return r
}
