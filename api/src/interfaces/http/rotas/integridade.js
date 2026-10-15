import { Router } from 'express'
import { z } from 'zod'
import { validar } from '../middlewares/validar.js'
import { receberFicheiro } from '../middlewares/ficheirosPrivados.js'
import * as E from '../esquemas.js'

const pId = z.object({ id: E.idNumerico })

// Integridade académica (anti-plágio) no painel: /api/admin/integridade/… (já autenticado)
export function rotasIntegridade({ servicos, config, privados }) {
  const r = Router()
  const o = servicos.integridade
  const ctx = (req) => req.contexto
  const ficheiro = privados ? receberFicheiro({ privados, config }) : (req, res, next) => next()

  r.get('/', async (req, res) => res.json(await o.resumo(ctx(req))))
  r.get('/analises/:id', validar({ params: pId }), async (req, res) => res.json(await o.relatorioPainel(ctx(req), req.dados.params.id)))
  r.post('/verificar', ficheiro, validar({ body: E.verificarDocumento }), async (req, res) => res.status(201).json(await o.verificarPainel(ctx(req), req.ficheiro, req.dados.body)))
  r.get('/repositorio', async (req, res) => res.json(await o.repositorio(ctx(req))))
  r.post('/repositorio', ficheiro, validar({ body: E.verificarDocumento }), async (req, res) => res.status(201).json(await o.adicionarReferencia(ctx(req), req.ficheiro, req.dados.body)))
  r.delete('/documentos/:id', validar({ params: pId }), async (req, res) => { await o.apagarDocumento(ctx(req), req.dados.params.id); res.status(204).end() })
  r.post('/reindexar', async (req, res) => res.status(202).json(await o.reindexar(ctx(req))))
  return r
}
