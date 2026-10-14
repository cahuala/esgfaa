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


  // ---------- notificações e mensagens ----------
  const n = servicos.comunicacao
  r.get('/notificacoes', validar({ query: E.paginaNotificacoes }), async (req, res) => res.json(await n.listar(ctx(req), req.dados.query)))
  r.put('/notificacoes/lidas', validar({ body: E.lerNotificacoes }), async (req, res) => res.json(await n.marcarLidas(ctx(req), req.dados.body)))
  r.get('/eu/avisos', async (req, res) => res.json(await n.resumo(ctx(req))))
  r.get('/eu/preferencias', async (req, res) => res.json(await n.preferencias(ctx(req))))
  r.put('/eu/preferencias', validar({ body: E.preferencias }), async (req, res) => res.json(await n.definirPreferencias(ctx(req), req.dados.body)))
  r.get('/contactos', async (req, res) => res.json(await n.contactos(ctx(req))))
  r.get('/mensagens', async (req, res) => res.json(await n.conversas(ctx(req))))
  r.get('/mensagens/:id', validar({ params: pId }), async (req, res) => res.json(await n.conversa(ctx(req), req.dados.params.id)))
  r.post('/mensagens/:id', limitar(L.mensagens, { mensagem: 'Demasiadas mensagens seguidas. Aguarde um minuto.', chave: (req) => req.contexto?.conta?.id ?? '' }), validar({ params: pId, body: E.mensagem }), async (req, res) => res.status(201).json(await n.enviar(ctx(req), req.dados.params.id, req.dados.body)))

  // ---------- capítulos e participantes ----------
  r.post('/cadeiras/:id/secoes', validar({ params: pId, body: E.secao }), async (req, res) => res.status(201).json(await s.criarSecao(ctx(req), req.dados.params.id, req.dados.body)))
  r.put('/cadeiras/:id/secoes/ordem', validar({ params: pId, body: E.ordemSecoes }), async (req, res) => res.json(await s.ordenarSecoes(ctx(req), req.dados.params.id, req.dados.body.ids)))
  r.put('/secoes/:id', validar({ params: pId, body: E.secao }), async (req, res) => res.json(await s.atualizarSecao(ctx(req), req.dados.params.id, req.dados.body)))
  r.delete('/secoes/:id', validar({ params: pId }), async (req, res) => { await s.apagarSecao(ctx(req), req.dados.params.id); res.status(204).end() })
  r.put('/atividades/capitulo', validar({ body: E.moverAtividade }), async (req, res) => { await s.moverAtividade(ctx(req), req.dados.body); res.status(204).end() })
  r.get('/cadeiras/:id/participantes', validar({ params: pId }), async (req, res) => res.json(await s.participantes(ctx(req), req.dados.params.id)))

  // ---------- fórum, calendário, progresso e questionários ----------
  const m = servicos.recursos
  r.get('/cadeiras/:id/forum', validar({ params: pId }), async (req, res) => res.json(await m.topicos(ctx(req), req.dados.params.id)))
  r.post('/cadeiras/:id/forum', validar({ params: pId, body: E.topico }), async (req, res) => res.status(201).json(await m.criarTopico(ctx(req), req.dados.params.id, req.dados.body)))
  r.get('/forum/:id', validar({ params: pId }), async (req, res) => res.json(await m.topico(ctx(req), req.dados.params.id)))
  r.post('/forum/:id/respostas', validar({ params: pId, body: E.respostaForum }), async (req, res) => res.status(201).json(await m.responder(ctx(req), req.dados.params.id, req.dados.body)))
  r.put('/forum/:id', validar({ params: pId, body: E.moderarTopico }), async (req, res) => res.json(await m.moderar(ctx(req), req.dados.params.id, req.dados.body)))
  r.delete('/forum/:id', validar({ params: pId }), async (req, res) => { await m.apagarTopico(ctx(req), req.dados.params.id); res.status(204).end() })
  r.delete('/forum-respostas/:id', validar({ params: pId }), async (req, res) => { await m.apagarResposta(ctx(req), req.dados.params.id); res.status(204).end() })

  r.get('/calendario', validar({ query: E.intervalo }), async (req, res) => res.json(await m.calendario(ctx(req), req.dados.query)))
  r.get('/cadeiras/:id/eventos', validar({ params: pId }), async (req, res) => res.json(await m.eventosDaCadeira(ctx(req), req.dados.params.id)))
  r.post('/cadeiras/:id/eventos', validar({ params: pId, body: E.evento }), async (req, res) => res.status(201).json(await m.criarEvento(ctx(req), req.dados.params.id, req.dados.body)))
  r.delete('/eventos/:id', validar({ params: pId }), async (req, res) => { await m.apagarEvento(ctx(req), req.dados.params.id); res.status(204).end() })

  r.get('/progresso', async (req, res) => res.json(await m.progressoGeral(ctx(req))))
  r.get('/cadeiras/:id/progresso', validar({ params: pId }), async (req, res) => res.json(await m.progresso(ctx(req), req.dados.params.id)))
  r.put('/materiais/:id/conclusao', validar({ params: pId, body: E.conclusao }), async (req, res) => res.json(await m.marcarConclusao(ctx(req), req.dados.params.id, req.dados.body)))

  r.get('/cadeiras/:id/questionarios', validar({ params: pId }), async (req, res) => res.json(await m.questionarios(ctx(req), req.dados.params.id)))
  r.post('/cadeiras/:id/questionarios', validar({ params: pId, body: E.questionario }), async (req, res) => res.status(201).json(await m.criarQuestionario(ctx(req), req.dados.params.id, req.dados.body)))
  r.get('/questionarios/:id/edicao', validar({ params: pId }), async (req, res) => res.json(await m.questionarioDocente(ctx(req), req.dados.params.id)))
  r.put('/questionarios/:id', validar({ params: pId, body: E.questionario }), async (req, res) => res.json(await m.atualizarQuestionario(ctx(req), req.dados.params.id, req.dados.body)))
  r.delete('/questionarios/:id', validar({ params: pId }), async (req, res) => { await m.apagarQuestionario(ctx(req), req.dados.params.id); res.status(204).end() })
  r.post('/questionarios/:id/perguntas', validar({ params: pId, body: E.pergunta }), async (req, res) => res.status(201).json(await m.criarPergunta(ctx(req), req.dados.params.id, req.dados.body)))
  r.put('/perguntas/:id', validar({ params: pId, body: E.pergunta }), async (req, res) => res.json(await m.atualizarPergunta(ctx(req), req.dados.params.id, req.dados.body)))
  r.delete('/perguntas/:id', validar({ params: pId }), async (req, res) => res.json(await m.apagarPergunta(ctx(req), req.dados.params.id)))

  r.get('/questionarios/:id', validar({ params: pId }), async (req, res) => res.json(await m.verQuestionario(ctx(req), req.dados.params.id)))
  r.post('/questionarios/:id/tentativas', validar({ params: pId }), async (req, res) => res.status(201).json(await m.iniciar(ctx(req), req.dados.params.id)))
  r.put('/tentativas/:id/respostas', validar({ params: pId, body: E.respostasQuestionario }), async (req, res) => res.json(await m.guardarRespostas(ctx(req), req.dados.params.id, req.dados.body.respostas)))
  r.post('/tentativas/:id/entrega', validar({ params: pId, body: E.respostasQuestionario }), async (req, res) => res.json(await m.entregar(ctx(req), req.dados.params.id, req.dados.body.respostas)))
  r.get('/tentativas/:id', validar({ params: pId }), async (req, res) => res.json(await m.revisao(ctx(req), req.dados.params.id)))

  return r
}
