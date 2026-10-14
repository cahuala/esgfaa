import { Router } from 'express'
import { z } from 'zod'
import { validar } from '../middlewares/validar.js'
import { enviarFicheiro, receberFicheiro } from '../middlewares/ficheirosPrivados.js'
import * as E from '../esquemas.js'

const pId = z.object({ id: E.idNumerico })

// Biblioteca no painel: /api/admin/biblioteca/… (já autenticado)
export function rotasBiblioteca({ servicos, config, privados }) {
  const r = Router()
  const { catalogo, circulacao } = servicos.biblioteca
  const ctx = (req) => req.contexto
  const ficheiro = privados ? receberFicheiro({ privados, config }) : (req, res, next) => next()

  r.get('/', async (req, res) => res.json(await catalogo.resumo(ctx(req))))
  r.get('/obras', validar({ query: E.filtrosObras }), async (req, res) => res.json(await catalogo.listar(ctx(req), req.dados.query)))
  r.post('/obras', ficheiro, validar({ body: E.obra }), async (req, res) => res.status(201).json(await catalogo.criar(ctx(req), req.dados.body, req.ficheiro)))
  r.get('/obras/:id', validar({ params: pId }), async (req, res) => res.json(await catalogo.obra(ctx(req), req.dados.params.id)))
  r.put('/obras/:id', ficheiro, validar({ params: pId, body: E.obra }), async (req, res) => res.json(await catalogo.atualizar(ctx(req), req.dados.params.id, req.dados.body, req.ficheiro)))
  r.delete('/obras/:id', validar({ params: pId }), async (req, res) => { await catalogo.apagar(ctx(req), req.dados.params.id); res.status(204).end() })
  r.get('/obras/:id/digital', validar({ params: pId }), async (req, res) => enviarFicheiro(req, res, await catalogo.digitalPainel(ctx(req), req.dados.params.id)))
  r.post('/obras/:id/exemplares', validar({ params: pId, body: E.exemplares }), async (req, res) => res.status(201).json(await catalogo.adicionarExemplares(ctx(req), req.dados.params.id, req.dados.body)))
  r.put('/exemplares/:id', validar({ params: pId, body: E.exemplar }), async (req, res) => res.json(await catalogo.editarExemplar(ctx(req), req.dados.params.id, req.dados.body)))
  r.delete('/exemplares/:id', validar({ params: pId }), async (req, res) => res.json(await catalogo.apagarExemplar(ctx(req), req.dados.params.id)))
  r.get('/exportar', async (req, res) => {
    const xml = await catalogo.exportar(ctx(req))
    res.set({ 'Content-Type': 'application/xml; charset=utf-8', 'Content-Disposition': 'attachment; filename="catalogo-dublin-core.xml"' }).send(xml)
  })

  r.get('/emprestimos', validar({ query: E.filtrosEmprestimos }), async (req, res) => res.json(await circulacao.listar(ctx(req), req.dados.query)))
  r.post('/emprestimos', validar({ body: E.emprestar }), async (req, res) => res.status(201).json(await circulacao.emprestar(ctx(req), req.dados.body)))
  r.post('/devolucoes', validar({ body: E.devolver }), async (req, res) => res.json(await circulacao.devolver(ctx(req), req.dados.body)))
  r.post('/emprestimos/:id/renovar', validar({ params: pId }), async (req, res) => res.json(await circulacao.renovar(ctx(req), req.dados.params.id)))
  r.post('/avisar-atrasos', async (req, res) => res.json(await circulacao.avisarAtrasados(ctx(req))))
  r.get('/reservas', async (req, res) => res.json(await circulacao.reservas(ctx(req))))
  r.post('/reservas/:id/preparar', validar({ params: pId }), async (req, res) => res.json(await circulacao.prepararReserva(ctx(req), req.dados.params.id)))
  r.post('/reservas/:id/cancelar', validar({ params: pId }), async (req, res) => res.json(await circulacao.cancelarReserva(ctx(req), req.dados.params.id)))
  r.get('/leitores', validar({ query: E.procurarLeitor }), async (req, res) => res.json(await circulacao.leitores(ctx(req), req.dados.query)))
  r.get('/leitores/:id', validar({ params: pId }), async (req, res) => res.json(await circulacao.leitor(ctx(req), req.dados.params.id)))
  return r
}
