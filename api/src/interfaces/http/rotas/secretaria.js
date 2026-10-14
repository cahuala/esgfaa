import { Router } from 'express'
import { z } from 'zod'
import { validar } from '../middlewares/validar.js'
import { enviarFicheiro, receberFicheiro } from '../middlewares/ficheirosPrivados.js'
import * as E from '../esquemas.js'

const pId = z.object({ id: E.idNumerico })
const pFicheiro = z.object({ id: z.string().regex(/^[0-9a-f-]{36}$/, 'Ficheiro não encontrado.') })

// Gestão académica no painel (Repartição de Administração Escolar): /api/admin/academico/… (já autenticado)
export function rotasSecretaria({ servicos, config, privados }) {
  const r = Router()
  const s = servicos.secretaria
  const ctx = (req) => req.contexto
  const ficheiro = privados ? receberFicheiro({ privados, config }) : (req, res, next) => next()

  r.get('/contas', validar({ query: E.filtrosContas }), async (req, res) => res.json(await s.listarContas(ctx(req), req.dados.query)))
  r.post('/contas', validar({ body: E.conta }), async (req, res) => res.status(201).json(await s.criarConta(ctx(req), req.dados.body)))
  r.put('/contas/:id', validar({ params: pId, body: E.conta }), async (req, res) => res.json(await s.editarConta(ctx(req), req.dados.params.id, req.dados.body)))
  r.post('/contas/:id/repor-senha', validar({ params: pId }), async (req, res) => { await s.reporSenha(ctx(req), req.dados.params.id); res.status(204).end() })

  r.get('/turmas', async (req, res) => res.json(await s.listarTurmas(ctx(req))))
  r.post('/turmas', validar({ body: E.turma }), async (req, res) => res.status(201).json(await s.criarTurma(ctx(req), req.dados.body)))
  r.get('/turmas/:id', validar({ params: pId }), async (req, res) => res.json(await s.turma(ctx(req), req.dados.params.id)))
  r.put('/turmas/:id', validar({ params: pId, body: E.turma }), async (req, res) => res.json(await s.editarTurma(ctx(req), req.dados.params.id, req.dados.body)))
  r.post('/turmas/:id/matriculas', validar({ params: pId, body: E.matricula }), async (req, res) => res.status(201).json(await s.matricular(ctx(req), req.dados.params.id, req.dados.body)))
  r.post('/turmas/:id/matricula-nova', validar({ params: pId, body: E.conta }), async (req, res) => res.status(201).json(await s.matricularNovo(ctx(req), req.dados.params.id, req.dados.body)))
  r.put('/matriculas/:id', validar({ params: pId, body: E.matricula }), async (req, res) => res.json(await s.alterarMatricula(ctx(req), req.dados.params.id, req.dados.body)))

  r.post('/turmas/:id/cadeiras', validar({ params: pId, body: E.cadeira }), async (req, res) => res.status(201).json(await s.criarCadeira(ctx(req), req.dados.params.id, req.dados.body)))
  r.put('/cadeiras/:id', validar({ params: pId, body: E.cadeira }), async (req, res) => res.json(await s.editarCadeira(ctx(req), req.dados.params.id, req.dados.body)))
  r.delete('/cadeiras/:id', validar({ params: pId }), async (req, res) => { await s.apagarCadeira(ctx(req), req.dados.params.id); res.status(204).end() })
  r.get('/cadeiras/:id', validar({ params: pId }), async (req, res) => res.json(await s.cadeira(ctx(req), req.dados.params.id)))
  r.put('/cadeiras/:id/programa', ficheiro, validar({ params: pId, body: E.programa }), async (req, res) => res.json(await s.programa(ctx(req), req.dados.params.id, req.dados.body, req.ficheiro)))
  r.put('/cadeiras/:id/docentes', validar({ params: pId, body: E.alocacao }), async (req, res) => res.json(await s.alocarDocentes(ctx(req), req.dados.params.id, req.dados.body.docentes)))
  r.get('/origens-copia', async (req, res) => res.json(await s.origensDeCopia(ctx(req))))
  r.post('/cadeiras/:id/copiar', validar({ params: pId, body: E.copiarCadeira }), async (req, res) => res.json(await s.copiarParaCadeira(ctx(req), req.dados.params.id, req.dados.body)))
  r.post('/turmas/:id/copiar', validar({ params: pId, body: E.copiarTurma }), async (req, res) => res.json(await s.copiarTurma(ctx(req), req.dados.params.id, req.dados.body)))
  r.get('/alocacao', async (req, res) => res.json(await s.alocacao(ctx(req))))

  r.get('/cadeiras/:id/pauta', validar({ params: pId }), async (req, res) => res.json(await s.pauta(ctx(req), req.dados.params.id)))
  r.put('/cadeiras/:id/pauta', validar({ params: pId, body: E.pauta }), async (req, res) => res.json(await s.gravarPauta(ctx(req), req.dados.params.id, req.dados.body.linhas)))
  r.put('/cadeiras/:id/pauta/composicao', validar({ params: pId, body: E.composicao }), async (req, res) => res.json(await s.definirComposicao(ctx(req), req.dados.params.id, req.dados.body)))
  r.put('/cadeiras/:id/pauta/publicacao', validar({ params: pId, body: E.publicacaoNotas }), async (req, res) => res.json(await s.publicarNotas(ctx(req), req.dados.params.id, req.dados.body.publicadas)))
  r.post('/cadeiras/:id/horarios', validar({ params: pId, body: E.horario }), async (req, res) => res.status(201).json(await s.criarHorario(ctx(req), req.dados.params.id, req.dados.body)))
  r.delete('/horarios/:id', validar({ params: pId }), async (req, res) => { await s.apagarHorario(ctx(req), req.dados.params.id); res.status(204).end() })

  r.get('/pedidos', validar({ query: E.filtroEstado }), async (req, res) => res.json(await s.listarPedidos(ctx(req), req.dados.query)))
  r.put('/pedidos/:id', ficheiro, validar({ params: pId, body: E.tratarPedido }), async (req, res) => res.json(await s.tratarPedido(ctx(req), req.dados.params.id, req.dados.body, req.ficheiro)))
  r.get('/ficheiros/:id', validar({ params: pFicheiro }), async (req, res) => enviarFicheiro(req, res, await s.ficheiro(ctx(req), req.dados.params.id)))

  r.get('/eventos', async (req, res) => res.json(await s.listarEventos(ctx(req))))
  r.get('/cadeiras/:id/eventos', validar({ params: pId }), async (req, res) => res.json(await s.eventosDaCadeira(ctx(req), req.dados.params.id)))
  r.post('/eventos', validar({ body: E.evento }), async (req, res) => res.status(201).json(await s.criarEvento(ctx(req), req.dados.body)))
  r.delete('/eventos/:id', validar({ params: pId }), async (req, res) => { await s.apagarEvento(ctx(req), req.dados.params.id); res.status(204).end() })

  r.get('/avisos', async (req, res) => res.json(await s.listarAvisos(ctx(req))))
  r.post('/avisos', validar({ body: E.avisoGeral }), async (req, res) => res.status(201).json(await s.criarAviso(ctx(req), req.dados.body)))
  r.delete('/avisos/:id', validar({ params: pId }), async (req, res) => { await s.apagarAviso(ctx(req), req.dados.params.id); res.status(204).end() })

  return r
}
