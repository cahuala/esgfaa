import { Router } from 'express'
import { z } from 'zod'
import { SenhaPorMudar } from '../../../dominio/comum/erros.js'
import { limitar } from '../middlewares/limites.js'
import { contextoAnonimo } from '../middlewares/pedido.js'
import { validar } from '../middlewares/validar.js'
import { enviarFicheiro, receberFicheiro } from '../middlewares/ficheirosPrivados.js'
import * as E from '../esquemas.js'

const pId = z.object({ id: E.idNumerico })
const pFicheiro = z.object({ id: z.string().regex(/^[0-9a-f-]{36}$/, 'Ficheiro não encontrado.') })

// Portal académico: /api/portal/… (estudantes e docentes)
export function rotasPortal({ servicos, config, privados }) {
  const r = Router()
  const L = config.limites
  const s = servicos.portal
  const ctx = (req) => req.contexto
  const ficheiro = privados ? receberFicheiro({ privados, config }) : (req, res, next) => next()

  r.post(
    '/entrar',
    limitar(L.entrarPortalIp, { mensagem: 'Demasiadas tentativas a partir deste endereço. Aguarde 15 minutos.' }),
    limitar(L.entrarPortal, { mensagem: 'Demasiadas tentativas. Aguarde 15 minutos.', chave: (req) => String(req.body?.email || '').trim().toLowerCase().slice(0, 254) }),
    validar({ body: E.entrar }),
    async (req, res) => res.json(await servicos.sessaoPortal.entrar(contextoAnonimo(req), req.dados.body)),
  )

  // tudo o resto exige sessão do portal
  r.use(limitar(L.portal))
  r.use(async (req, res, next) => {
    const cab = req.get('authorization') || ''
    const { conta, sessao } = await servicos.sessaoPortal.autenticar(cab.startsWith('Bearer ') ? cab.slice(7).trim() : null)
    req.contexto = { ...contextoAnonimo(req), conta, sessao }
    next()
  })

  r.get('/eu', async (req, res) => res.json(await servicos.sessaoPortal.eu(ctx(req))))
  r.post('/sair', async (req, res) => { await servicos.sessaoPortal.sair(ctx(req)); res.status(204).end() })
  r.put('/eu/senha', validar({ body: E.mudarSenha }), async (req, res) => res.json(await servicos.sessaoPortal.mudarSenha(ctx(req), req.dados.body)))

  // com a palavra-passe inicial (o e-mail) não se usa mais nada
  r.use((req, res, next) => {
    if (req.contexto.conta.deveMudarSenha) throw new SenhaPorMudar()
    next()
  })

  // ---------- comum ----------
  r.get('/inicio', async (req, res) => res.json(await s.inicio(ctx(req))))
  r.get('/cadeiras', async (req, res) => res.json(await s.cadeiras(ctx(req))))
  r.get('/cadeiras/:id', validar({ params: pId }), async (req, res) => res.json(await s.cadeira(ctx(req), req.dados.params.id)))
  r.get('/horario', async (req, res) => res.json(await s.horario(ctx(req))))
  r.get('/ficheiros/:id', validar({ params: pFicheiro }), async (req, res) => enviarFicheiro(req, res, await s.ficheiro(ctx(req), req.dados.params.id)))

  // ---------- estudante ----------
  r.get('/notas', async (req, res) => res.json(await s.notas(ctx(req))))
  r.get('/percurso', async (req, res) => res.json(await s.percurso(ctx(req))))
  r.get('/presencas', async (req, res) => res.json(await s.presencas(ctx(req))))
  r.get('/avisos', async (req, res) => res.json(await s.avisosGerais(ctx(req))))
  r.get('/pedidos', async (req, res) => res.json(await s.pedidos(ctx(req))))
  r.post('/pedidos', validar({ body: E.pedidoNovo }), async (req, res) => res.status(201).json(await s.criarPedido(ctx(req), req.dados.body)))
  r.post('/trabalhos/:id/entrega', ficheiro, validar({ params: pId, body: E.entrega }), async (req, res) => {
    res.status(201).json(await s.entregar(ctx(req), req.dados.params.id, req.ficheiro, req.dados.body))
  })

  // ---------- docente ----------
  r.post('/cadeiras/:id/materiais', ficheiro, validar({ params: pId, body: E.material }), async (req, res) => {
    res.status(201).json(await s.criarMaterial(ctx(req), req.dados.params.id, req.dados.body, req.ficheiro))
  })
  r.delete('/materiais/:id', validar({ params: pId }), async (req, res) => { await s.apagarMaterial(ctx(req), req.dados.params.id); res.status(204).end() })

  r.post('/cadeiras/:id/avisos', validar({ params: pId, body: E.avisoCadeira }), async (req, res) => res.status(201).json(await s.criarAviso(ctx(req), req.dados.params.id, req.dados.body)))
  r.delete('/avisos/:id', validar({ params: pId }), async (req, res) => { await s.apagarAviso(ctx(req), req.dados.params.id); res.status(204).end() })

  r.get('/cadeiras/:id/pauta', validar({ params: pId }), async (req, res) => res.json(await s.pauta(ctx(req), req.dados.params.id)))
  r.put('/cadeiras/:id/pauta', validar({ params: pId, body: E.pauta }), async (req, res) => res.json(await s.gravarPauta(ctx(req), req.dados.params.id, req.dados.body.linhas)))
  r.put('/cadeiras/:id/pauta/publicacao', validar({ params: pId, body: E.publicacaoNotas }), async (req, res) => res.json(await s.publicarNotas(ctx(req), req.dados.params.id, req.dados.body.publicadas)))

  r.post('/cadeiras/:id/trabalhos', ficheiro, validar({ params: pId, body: E.trabalho }), async (req, res) => {
    res.status(201).json(await s.criarTrabalho(ctx(req), req.dados.params.id, req.dados.body, req.ficheiro))
  })
  r.delete('/trabalhos/:id', validar({ params: pId }), async (req, res) => { await s.apagarTrabalho(ctx(req), req.dados.params.id); res.status(204).end() })
  r.get('/trabalhos/:id/entregas', validar({ params: pId }), async (req, res) => res.json(await s.entregas(ctx(req), req.dados.params.id)))
  r.put('/entregas/:id', validar({ params: pId, body: E.correcao }), async (req, res) => res.json(await s.corrigir(ctx(req), req.dados.params.id, req.dados.body)))

  r.get('/cadeiras/:id/aulas', validar({ params: pId }), async (req, res) => res.json(await s.aulas(ctx(req), req.dados.params.id)))
  r.post('/cadeiras/:id/aulas', validar({ params: pId, body: E.aula }), async (req, res) => res.status(201).json(await s.registarAula(ctx(req), req.dados.params.id, req.dados.body)))
  r.put('/aulas/:id', validar({ params: pId, body: E.aula }), async (req, res) => { await s.atualizarAula(ctx(req), req.dados.params.id, req.dados.body); res.status(204).end() })
  r.delete('/aulas/:id', validar({ params: pId }), async (req, res) => { await s.apagarAula(ctx(req), req.dados.params.id); res.status(204).end() })

  return r
}
