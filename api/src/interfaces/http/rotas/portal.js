import { Router } from 'express'
import { z } from 'zod'
import { SenhaPorMudar } from '../../../dominio/comum/erros.js'
import { limitar } from '../middlewares/limites.js'
import { contextoAnonimo } from '../middlewares/pedido.js'
import { validar } from '../middlewares/validar.js'
import { enviarFicheiro, receberCopia, receberFicheiro } from '../middlewares/ficheirosPrivados.js'
import * as E from '../esquemas.js'
import { baseUrl } from '../apresentacao.js'

const pId = z.object({ id: E.idNumerico })
const pFicheiro = z.object({ id: z.string().regex(/^[0-9a-f-]{36}$/, 'Ficheiro não encontrado.') })

// Portal académico: /api/portal/… (estudantes e docentes)
export function rotasPortal({ servicos, config, privados }) {
  const r = Router()
  const L = config.limites
  const e = servicos.ensino
  const ctx = (req) => req.contexto
  const ficheiro = privados ? receberFicheiro({ privados, config }) : (req, res, next) => next()
  const ficheiros = privados ? receberFicheiro({ privados, config, maximo: 10 }) : (req, res, next) => next()
  const pasta = privados ? receberFicheiro({ privados, config, maximo: 20 }) : (req, res, next) => next()

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

  r.post('/traduzir', validar({ body: E.traduzirTextos }), async (req, res) => res.json(await servicos.traducaoDados.traduzir(ctx(req), req.dados.body)))
  r.get('/eu', async (req, res) => res.json(await servicos.sessaoPortal.eu(ctx(req))))
  r.post('/sair', async (req, res) => { await servicos.sessaoPortal.sair(ctx(req)); res.status(204).end() })
  r.put('/eu/senha', validar({ body: E.mudarSenha }), async (req, res) => res.json(await servicos.sessaoPortal.mudarSenha(ctx(req), req.dados.body)))

  // com a palavra-passe inicial (o e-mail) não se usa mais nada
  r.use((req, res, next) => {
    if (req.contexto.conta.deveMudarSenha) throw new SenhaPorMudar()
    next()
  })

  // ---------- comum ----------
  r.get('/inicio', async (req, res) => res.json(await e.painel.inicio(ctx(req))))
  r.get('/cadeiras', async (req, res) => res.json(await e.painel.cadeiras(ctx(req))))
  r.get('/cadeiras/:id', validar({ params: pId }), async (req, res) => res.json(await e.painel.cadeira(ctx(req), req.dados.params.id)))
  r.get('/horario', async (req, res) => res.json(await e.estudante.horario(ctx(req))))
  r.get('/ficheiros/:id', validar({ params: pFicheiro }), async (req, res) => enviarFicheiro(req, res, await e.ficheiros.ficheiro(ctx(req), req.dados.params.id)))

  // ---------- originalidade (docentes) ----------
  const o = servicos.integridade
  r.get('/integridade', async (req, res) => res.json(await o.minhas(ctx(req))))
  r.post('/integridade', ficheiro, validar({ body: E.verificarDocumento }), async (req, res) => res.status(201).json(await o.verificarPortal(ctx(req), req.ficheiro, req.dados.body)))
  r.get('/integridade/:id', validar({ params: pId }), async (req, res) => res.json(await o.relatorioPortal(ctx(req), req.dados.params.id)))
  r.get('/trabalhos/:id/integridade', validar({ params: pId }), async (req, res) => res.json(await o.doTrabalho(ctx(req), req.dados.params.id)))
  r.post('/entregas/:id/integridade', validar({ params: pId }), async (req, res) => res.status(202).json(await o.reanalisarEntrega(ctx(req), req.dados.params.id)))

  // ---------- biblioteca ----------
  const b = servicos.biblioteca
  r.get('/biblioteca', validar({ query: E.filtrosObras }), async (req, res) => res.json(await b.catalogo.pesquisar(ctx(req), req.dados.query)))
  r.get('/biblioteca/obras/:id', validar({ params: pId }), async (req, res) => res.json(await b.catalogo.obraPortal(ctx(req), req.dados.params.id)))
  // os livros da biblioteca leem-se no portal: o servidor não os envia como descarga
  r.get('/biblioteca/obras/:id/digital', validar({ params: pId }), async (req, res) => enviarFicheiro(req, res, await b.catalogo.digitalPortal(ctx(req), req.dados.params.id), { soLeitura: true }))
  r.get('/biblioteca/emprestimos', async (req, res) => res.json(await b.circulacao.meus(ctx(req))))
  r.post('/biblioteca/obras/:id/reserva', validar({ params: pId }), async (req, res) => res.status(201).json(await b.circulacao.reservar(ctx(req), req.dados.params.id)))
  r.delete('/biblioteca/reservas/:id', validar({ params: pId }), async (req, res) => res.json(await b.circulacao.cancelarMinhaReserva(ctx(req), req.dados.params.id)))
  r.post('/biblioteca/emprestimos/:id/renovar', validar({ params: pId }), async (req, res) => res.json(await b.circulacao.renovarMeu(ctx(req), req.dados.params.id)))

  // ---------- estudante ----------
  r.get('/notas', async (req, res) => res.json(await e.estudante.notas(ctx(req))))
  r.get('/percurso', async (req, res) => res.json(await e.estudante.percurso(ctx(req))))
  r.get('/presencas', async (req, res) => res.json(await e.estudante.presencas(ctx(req))))
  r.get('/avisos', async (req, res) => res.json(await e.estudante.avisosGerais(ctx(req))))
  r.get('/pedidos', async (req, res) => res.json(await e.estudante.pedidos(ctx(req))))
  r.post('/pedidos', validar({ body: E.pedidoNovo }), async (req, res) => res.status(201).json(await e.estudante.criarPedido(ctx(req), req.dados.body)))
  r.post('/trabalhos/:id/entrega', ficheiros, validar({ params: pId, body: E.entrega }), async (req, res) => {
    res.status(201).json(await e.trabalhos.entregar(ctx(req), req.dados.params.id, req.ficheiros || [], req.dados.body))
  })

  // ---------- docente ----------
  r.post('/cadeiras/:id/materiais', pasta, validar({ params: pId, body: E.material }), async (req, res) => {
    res.status(201).json(await e.materiais.criarMaterial(ctx(req), req.dados.params.id, req.dados.body, req.ficheiros || []))
  })
  r.put('/materiais/:id', pasta, validar({ params: pId, body: E.material }), async (req, res) => res.json(await e.materiais.editarMaterial(ctx(req), req.dados.params.id, req.dados.body, req.ficheiros || [])))
  r.delete('/materiais/:id', validar({ params: pId }), async (req, res) => { await e.materiais.apagarMaterial(ctx(req), req.dados.params.id); res.status(204).end() })

  r.post('/cadeiras/:id/avisos', validar({ params: pId, body: E.avisoCadeira }), async (req, res) => res.status(201).json(await e.materiais.criarAviso(ctx(req), req.dados.params.id, req.dados.body)))
  r.delete('/avisos/:id', validar({ params: pId }), async (req, res) => { await e.materiais.apagarAviso(ctx(req), req.dados.params.id); res.status(204).end() })

  r.get('/cadeiras/:id/pauta', validar({ params: pId }), async (req, res) => res.json(await e.pautaDocente.pauta(ctx(req), req.dados.params.id)))
  r.put('/cadeiras/:id/pauta', validar({ params: pId, body: E.pauta }), async (req, res) => res.json(await e.pautaDocente.gravarPauta(ctx(req), req.dados.params.id, req.dados.body.linhas)))
  r.put('/cadeiras/:id/pauta/composicao', validar({ params: pId, body: E.composicao }), async (req, res) => res.json(await e.pautaDocente.definirComposicao(ctx(req), req.dados.params.id, req.dados.body)))
  r.put('/cadeiras/:id/pauta/publicacao', validar({ params: pId, body: E.publicacaoNotas }), async (req, res) => res.json(await e.pautaDocente.publicarNotas(ctx(req), req.dados.params.id, req.dados.body.publicadas)))

  r.post('/cadeiras/:id/trabalhos', ficheiro, validar({ params: pId, body: E.trabalho }), async (req, res) => {
    res.status(201).json(await e.trabalhos.criarTrabalho(ctx(req), req.dados.params.id, req.dados.body, req.ficheiro))
  })
  r.delete('/trabalhos/:id', validar({ params: pId }), async (req, res) => { await e.trabalhos.apagarTrabalho(ctx(req), req.dados.params.id); res.status(204).end() })
  r.get('/trabalhos/:id/entregas', validar({ params: pId }), async (req, res) => res.json(await e.trabalhos.entregas(ctx(req), req.dados.params.id)))
  r.put('/entregas/:id', ficheiro, validar({ params: pId, body: E.correcao }), async (req, res) => res.json(await e.trabalhos.corrigir(ctx(req), req.dados.params.id, req.dados.body, req.ficheiro)))
  r.put('/trabalhos/:id', validar({ params: pId, body: E.trabalho }), async (req, res) => res.json(await e.trabalhos.editarTrabalho(ctx(req), req.dados.params.id, req.dados.body)))
  r.post('/trabalhos/:id/libertar-notas', validar({ params: pId }), async (req, res) => res.json(await e.trabalhos.libertarNotas(ctx(req), req.dados.params.id)))
  r.put('/trabalhos/:id/prorrogacao', validar({ params: pId, body: E.prorrogacao }), async (req, res) => res.json(await e.trabalhos.prorrogar(ctx(req), req.dados.params.id, req.dados.body)))

  r.get('/cadeiras/:id/aulas', validar({ params: pId }), async (req, res) => res.json(await e.presencas.aulas(ctx(req), req.dados.params.id)))
  r.post('/cadeiras/:id/aulas', validar({ params: pId, body: E.aula }), async (req, res) => res.status(201).json(await e.presencas.registarAula(ctx(req), req.dados.params.id, req.dados.body)))
  r.put('/aulas/:id', validar({ params: pId, body: E.aula }), async (req, res) => { await e.presencas.atualizarAula(ctx(req), req.dados.params.id, req.dados.body); res.status(204).end() })
  r.delete('/aulas/:id', validar({ params: pId }), async (req, res) => { await e.presencas.apagarAula(ctx(req), req.dados.params.id); res.status(204).end() })


  // ---------- notificações e mensagens ----------
  const n = servicos.comunicacao
  r.get('/notificacoes', validar({ query: E.paginaNotificacoes }), async (req, res) => res.json(await n.listar(ctx(req), req.dados.query)))
  r.put('/notificacoes/lidas', validar({ body: E.lerNotificacoes }), async (req, res) => res.json(await n.marcarLidas(ctx(req), req.dados.body)))
  r.get('/eu/avisos', async (req, res) => res.json(await n.resumo(ctx(req))))
  // avisos no telemóvel: a chave pública do servidor e a subscrição deste aparelho
  r.get('/push/chave', async (req, res) => res.json(n.chavePush()))
  r.post('/push/subscricao', validar({ body: E.subscricaoPush }), async (req, res) => res.status(201).json(await n.subscrever(ctx(req), req.dados.body)))
  r.delete('/push/subscricao', validar({ body: E.cancelarPush }), async (req, res) => res.json(await n.cancelarSubscricao(ctx(req), req.dados.body)))
  r.get('/eu/preferencias', async (req, res) => res.json(await n.preferencias(ctx(req))))
  r.put('/eu/preferencias', validar({ body: E.preferencias }), async (req, res) => res.json(await n.definirPreferencias(ctx(req), req.dados.body)))
  r.get('/contactos', async (req, res) => res.json(await n.contactos(ctx(req))))
  r.get('/mensagens', async (req, res) => res.json(await n.conversas(ctx(req))))
  r.get('/mensagens/:id', validar({ params: pId }), async (req, res) => res.json(await n.conversa(ctx(req), req.dados.params.id)))
  r.post('/mensagens/:id', limitar(L.mensagens, { mensagem: 'Demasiadas mensagens seguidas. Aguarde um minuto.', chave: (req) => req.contexto?.conta?.id ?? '' }), validar({ params: pId, body: E.mensagem }), async (req, res) => res.status(201).json(await n.enviar(ctx(req), req.dados.params.id, req.dados.body)))

  // ---------- capítulos e participantes ----------
  r.post('/cadeiras/:id/secoes', validar({ params: pId, body: E.secao }), async (req, res) => res.status(201).json(await e.organizacao.criarSecao(ctx(req), req.dados.params.id, req.dados.body)))
  r.put('/cadeiras/:id/secoes/ordem', validar({ params: pId, body: E.ordemSecoes }), async (req, res) => res.json(await e.organizacao.ordenarSecoes(ctx(req), req.dados.params.id, req.dados.body.ids)))
  r.put('/secoes/:id', validar({ params: pId, body: E.secao }), async (req, res) => res.json(await e.organizacao.atualizarSecao(ctx(req), req.dados.params.id, req.dados.body)))
  r.delete('/secoes/:id', validar({ params: pId }), async (req, res) => { await e.organizacao.apagarSecao(ctx(req), req.dados.params.id); res.status(204).end() })
  // registos de acesso e relatórios de participação
  const rg = servicos.registos
  r.post('/cadeiras/:id/vistas', validar({ params: pId, body: E.vista }), async (req, res) => res.json(await rg.vista(ctx(req), req.dados.params.id, req.dados.body)))
  r.get('/cadeiras/:id/relatorios/participacao', validar({ params: pId }), async (req, res) => res.json(await rg.participacao(ctx(req), req.dados.params.id)))
  r.get('/cadeiras/:id/relatorios/registos', validar({ params: pId, query: E.filtroRegistos }), async (req, res) => res.json(await rg.lista(ctx(req), req.dados.params.id, req.dados.query)))
  // avaliação por pares
  const ws = servicos.workshops
  r.post('/cadeiras/:id/workshops', validar({ params: pId, body: E.workshop }), async (req, res) => res.status(201).json(await ws.criar(ctx(req), req.dados.params.id, req.dados.body)))
  r.get('/workshops/:id', validar({ params: pId }), async (req, res) => res.json(await ws.ver(ctx(req), req.dados.params.id)))
  r.put('/workshops/:id', validar({ params: pId, body: E.workshop }), async (req, res) => res.json(await ws.atualizar(ctx(req), req.dados.params.id, req.dados.body)))
  r.delete('/workshops/:id', validar({ params: pId }), async (req, res) => { await ws.apagar(ctx(req), req.dados.params.id); res.status(204).end() })
  r.post('/workshops/:id/submissao', ficheiro, validar({ params: pId, body: E.submissaoWorkshop }), async (req, res) => res.status(201).json(await ws.submeter(ctx(req), req.dados.params.id, req.dados.body, req.ficheiro)))
  r.put('/avaliacoes-pares/:id', validar({ params: pId, body: E.avaliacaoPar }), async (req, res) => res.json(await ws.avaliar(ctx(req), req.dados.params.id, req.dados.body)))
  r.put('/submissoes-workshop/:id', validar({ params: pId, body: E.notaWorkshop }), async (req, res) => res.json(await ws.notaFinal(ctx(req), req.dados.params.id, req.dados.body)))
  // glossário e wiki da cadeira
  const cb = servicos.colaborativo
  r.get('/cadeiras/:id/glossario', validar({ params: pId, query: E.pesquisaForum }), async (req, res) => res.json(await cb.termos(ctx(req), req.dados.params.id, req.dados.query)))
  r.post('/cadeiras/:id/glossario', validar({ params: pId, body: E.termo }), async (req, res) => res.status(201).json(await cb.criarTermo(ctx(req), req.dados.params.id, req.dados.body)))
  r.put('/glossario/:id', validar({ params: pId, body: E.termo }), async (req, res) => res.json(await cb.atualizarTermo(ctx(req), req.dados.params.id, req.dados.body)))
  r.delete('/glossario/:id', validar({ params: pId }), async (req, res) => { await cb.apagarTermo(ctx(req), req.dados.params.id); res.status(204).end() })
  r.get('/cadeiras/:id/wiki', validar({ params: pId }), async (req, res) => res.json(await cb.paginas(ctx(req), req.dados.params.id)))
  r.post('/cadeiras/:id/wiki', validar({ params: pId, body: E.paginaWiki }), async (req, res) => res.status(201).json(await cb.criarPagina(ctx(req), req.dados.params.id, req.dados.body)))
  r.get('/wiki/:id', validar({ params: pId, query: E.versaoWiki }), async (req, res) => res.json(await cb.pagina(ctx(req), req.dados.params.id, req.dados.query)))
  r.put('/wiki/:id', validar({ params: pId, body: E.paginaWiki }), async (req, res) => res.json(await cb.editarPagina(ctx(req), req.dados.params.id, req.dados.body)))
  r.post('/wiki/:id/restaurar', validar({ params: pId, body: E.restaurarWiki }), async (req, res) => res.json(await cb.restaurar(ctx(req), req.dados.params.id, req.dados.body)))
  r.delete('/wiki/:id', validar({ params: pId }), async (req, res) => { await cb.apagarPagina(ctx(req), req.dados.params.id); res.status(204).end() })
  r.get('/pesquisa', validar({ query: E.pesquisaForum }), async (req, res) => res.json(await servicos.pesquisa.pesquisar(ctx(req), req.dados.query)))
  // inquéritos institucionais (satisfação): responder no portal
  const iq = servicos.qualidade.inqueritos
  r.get('/inqueritos-escola', async (req, res) => res.json(await iq.doPortal(ctx(req))))
  r.get('/inqueritos-escola/:id', validar({ params: pId }), async (req, res) => res.json(await iq.ver(ctx(req), req.dados.params.id)))
  r.post('/inqueritos-escola/:id/respostas', validar({ params: pId, body: E.respostasInquerito }), async (req, res) => res.json(await iq.responder(ctx(req), req.dados.params.id, req.dados.body.respostas)))
  // assinatura do calendário (iCal)
  r.get('/eu/calendario-ical', async (req, res) => res.json(await e.calendario.tokenCalendario(ctx(req))))
  r.post('/eu/calendario-ical', async (req, res) => res.json(await e.calendario.tokenCalendario(ctx(req), { renovar: true })))
  // grupos de estudantes da cadeira
  const g = servicos.grupos
  r.get('/cadeiras/:id/grupos', validar({ params: pId }), async (req, res) => res.json(await g.listar(ctx(req), req.dados.params.id)))
  r.post('/cadeiras/:id/grupos', validar({ params: pId, body: E.grupo }), async (req, res) => res.status(201).json(await g.criar(ctx(req), req.dados.params.id, req.dados.body)))
  r.post('/cadeiras/:id/grupos/automatico', validar({ params: pId, body: E.gruposAutomaticos }), async (req, res) => res.json(await g.automatico(ctx(req), req.dados.params.id, req.dados.body)))
  r.put('/grupos/:id', validar({ params: pId, body: E.grupo }), async (req, res) => res.json(await g.atualizar(ctx(req), req.dados.params.id, req.dados.body)))
  r.delete('/grupos/:id', validar({ params: pId }), async (req, res) => { await g.apagar(ctx(req), req.dados.params.id); res.status(204).end() })
  // sondagens e inquéritos de avaliação do docente
  const q = servicos.inqueritos
  r.post('/cadeiras/:id/sondagens', validar({ params: pId, body: E.sondagem }), async (req, res) => res.status(201).json(await q.criarSondagem(ctx(req), req.dados.params.id, req.dados.body)))
  r.put('/inqueritos/:id', validar({ params: pId, body: E.sondagem }), async (req, res) => res.json(await q.atualizarSondagem(ctx(req), req.dados.params.id, req.dados.body)))
  r.delete('/inqueritos/:id', validar({ params: pId }), async (req, res) => { await q.apagar(ctx(req), req.dados.params.id); res.status(204).end() })
  r.get('/inqueritos/:id', validar({ params: pId }), async (req, res) => res.json(await q.ver(ctx(req), req.dados.params.id)))
  r.post('/inqueritos/:id/respostas', validar({ params: pId, body: E.respostasInquerito }), async (req, res) => res.json(await q.responder(ctx(req), req.dados.params.id, req.dados.body.respostas)))
  r.put('/atividades/restricoes', validar({ body: E.restricoes }), async (req, res) => res.json(await e.organizacao.restricoes(ctx(req), req.dados.body)))
  r.put('/atividades/capitulo', validar({ body: E.moverAtividade }), async (req, res) => { await e.organizacao.moverAtividade(ctx(req), req.dados.body); res.status(204).end() })
  // ferramentas externas (LTI 1.3): as que o docente pode usar, e o início do lançamento
  r.get('/lti/ferramentas', async (req, res) => res.json(await e.lti.ativas()))
  r.post('/materiais/:id/lti', validar({ params: pId }), async (req, res) => res.json(await e.lti.lancamento(ctx(req), req.dados.params.id, baseUrl(req, config))))

  // pacotes SCORM e H5P: endereço do leitor (assinado) e resultados da turma
  r.post('/materiais/:id/pacote', validar({ params: pId }), async (req, res) => res.json(await e.pacotes.abrir(ctx(req), req.dados.params.id, baseUrl(req, config))))
  r.get('/materiais/:id/pacote/resultados', validar({ params: pId }), async (req, res) => res.json(await e.pacotes.resultados(ctx(req), req.dados.params.id)))

  // cópia de segurança da cadeira num ficheiro, e restauração (desse ficheiro ou de um curso do Moodle)
  r.get('/cadeiras/:id/copia-seguranca', validar({ params: pId }), async (req, res) => {
    const { nome, dados } = await e.copiaSeguranca.exportar(ctx(req), req.dados.params.id)
    res.set({ 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="copia.zip"; filename*=UTF-8''${encodeURIComponent(nome)}`, 'Cache-Control': 'private, no-store' }).send(dados)
  })
  r.post('/cadeiras/:id/restaurar', limitar(L.mensagens), receberCopia({ config }), validar({ params: pId }), async (req, res) => res.json(await e.copiaSeguranca.restaurar(ctx(req), req.dados.params.id, req.copia)))
  r.post('/cadeiras/:id/importar', validar({ params: pId, body: E.copiarCadeira }), async (req, res) => res.json(await e.organizacao.importar(ctx(req), req.dados.params.id, req.dados.body)))
  r.get('/cadeiras/:id/participantes', validar({ params: pId }), async (req, res) => res.json(await e.organizacao.participantes(ctx(req), req.dados.params.id)))

  // ---------- fórum, calendário, progresso e questionários ----------
  const anexosForum = privados ? receberFicheiro({ privados, config, maximo: 3 }) : (req, res, next) => next()
  r.get('/cadeiras/:id/forum', validar({ params: pId, query: E.pesquisaForum }), async (req, res) => res.json(await e.forum.topicos(ctx(req), req.dados.params.id, req.dados.query)))
  r.post('/cadeiras/:id/forum', anexosForum, validar({ params: pId, body: E.topico }), async (req, res) => res.status(201).json(await e.forum.criarTopico(ctx(req), req.dados.params.id, req.dados.body, req.ficheiros || [])))
  r.get('/cadeiras/:id/forum/subscricao', validar({ params: pId }), async (req, res) => res.json(await e.forum.subscricaoForum(ctx(req), req.dados.params.id)))
  r.put('/cadeiras/:id/forum/subscricao', validar({ params: pId, body: E.seguir }), async (req, res) => res.json(await e.forum.seguirForum(ctx(req), req.dados.params.id, req.dados.body)))
  r.get('/forum/:id', validar({ params: pId }), async (req, res) => res.json(await e.forum.topico(ctx(req), req.dados.params.id)))
  r.post('/forum/:id/respostas', anexosForum, validar({ params: pId, body: E.respostaForum }), async (req, res) => res.status(201).json(await e.forum.responder(ctx(req), req.dados.params.id, req.dados.body, req.ficheiros || [])))
  r.put('/forum/:id', validar({ params: pId, body: E.moderarTopico }), async (req, res) => res.json(await e.forum.moderar(ctx(req), req.dados.params.id, req.dados.body)))
  r.put('/forum/:id/texto', validar({ params: pId, body: E.topico }), async (req, res) => res.json(await e.forum.editarTopico(ctx(req), req.dados.params.id, req.dados.body)))
  r.put('/forum/:id/certa', validar({ params: pId, body: E.respostaCerta }), async (req, res) => res.json(await e.forum.marcarCerta(ctx(req), req.dados.params.id, req.dados.body)))
  r.put('/forum/:id/subscricao', validar({ params: pId, body: E.seguir }), async (req, res) => res.json(await e.forum.seguirTopico(ctx(req), req.dados.params.id, req.dados.body)))
  r.put('/forum-respostas/:id', validar({ params: pId, body: E.respostaForum }), async (req, res) => res.json(await e.forum.editarResposta(ctx(req), req.dados.params.id, req.dados.body)))
  r.delete('/forum/:id', validar({ params: pId }), async (req, res) => { await e.forum.apagarTopico(ctx(req), req.dados.params.id); res.status(204).end() })
  r.delete('/forum-respostas/:id', validar({ params: pId }), async (req, res) => { await e.forum.apagarResposta(ctx(req), req.dados.params.id); res.status(204).end() })

  r.get('/calendario', validar({ query: E.intervalo }), async (req, res) => res.json(await e.calendario.calendario(ctx(req), req.dados.query)))
  r.get('/cadeiras/:id/eventos', validar({ params: pId }), async (req, res) => res.json(await e.calendario.eventosDaCadeira(ctx(req), req.dados.params.id)))
  r.post('/cadeiras/:id/eventos', validar({ params: pId, body: E.evento }), async (req, res) => res.status(201).json(await e.calendario.criarEvento(ctx(req), req.dados.params.id, req.dados.body)))
  r.delete('/eventos/:id', validar({ params: pId }), async (req, res) => { await e.calendario.apagarEvento(ctx(req), req.dados.params.id); res.status(204).end() })

  r.get('/cadeiras/:id/conclusao', validar({ params: pId }), async (req, res) => res.json(await e.progresso.conclusao(ctx(req), req.dados.params.id)))
  r.post('/cadeiras/:id/certificado', validar({ params: pId }), async (req, res) => res.status(201).json(await e.progresso.emitirCertificado(ctx(req), req.dados.params.id)))
  r.get('/progresso', async (req, res) => res.json(await e.progresso.progressoGeral(ctx(req))))
  r.get('/emblemas', async (req, res) => res.json(await e.progresso.emblemas(ctx(req))))
  r.get('/cadeiras/:id/progresso', validar({ params: pId }), async (req, res) => res.json(await e.progresso.progresso(ctx(req), req.dados.params.id)))
  // lições: o caminho do estudante (o servidor decide a página seguinte) e os resultados para o docente
  r.get('/materiais/:id/licao', validar({ params: pId }), async (req, res) => res.json(await e.licoes.estado(ctx(req), req.dados.params.id)))
  r.post('/materiais/:id/licao/avancar', validar({ params: pId, body: E.passoLicao }), async (req, res) => res.json(await e.licoes.avancar(ctx(req), req.dados.params.id, req.dados.body)))
  r.post('/materiais/:id/licao/resposta', validar({ params: pId, body: E.passoLicao }), async (req, res) => res.json(await e.licoes.responder(ctx(req), req.dados.params.id, req.dados.body)))
  r.post('/materiais/:id/licao/recomecar', validar({ params: pId }), async (req, res) => res.json(await e.licoes.recomecar(ctx(req), req.dados.params.id)))
  r.get('/materiais/:id/licao/resultados', validar({ params: pId }), async (req, res) => res.json(await e.licoes.resultados(ctx(req), req.dados.params.id)))
  r.put('/materiais/:id/conclusao', validar({ params: pId, body: E.conclusao }), async (req, res) => res.json(await e.progresso.marcarConclusao(ctx(req), req.dados.params.id, req.dados.body)))

  r.get('/cadeiras/:id/questionarios', validar({ params: pId }), async (req, res) => res.json(await e.questionarios.questionarios(ctx(req), req.dados.params.id)))
  r.post('/cadeiras/:id/questionarios', validar({ params: pId, body: E.questionario }), async (req, res) => res.status(201).json(await e.questionarios.criarQuestionario(ctx(req), req.dados.params.id, req.dados.body)))
  r.get('/questionarios/:id/edicao', validar({ params: pId }), async (req, res) => res.json(await e.questionarios.questionarioDocente(ctx(req), req.dados.params.id)))
  r.put('/questionarios/:id', validar({ params: pId, body: E.questionario }), async (req, res) => res.json(await e.questionarios.atualizarQuestionario(ctx(req), req.dados.params.id, req.dados.body)))
  r.delete('/questionarios/:id', validar({ params: pId }), async (req, res) => { await e.questionarios.apagarQuestionario(ctx(req), req.dados.params.id); res.status(204).end() })
  r.post('/questionarios/:id/perguntas', validar({ params: pId, body: E.pergunta }), async (req, res) => res.status(201).json(await e.questionarios.criarPergunta(ctx(req), req.dados.params.id, req.dados.body)))
  r.put('/perguntas/:id', validar({ params: pId, body: E.pergunta }), async (req, res) => res.json(await e.questionarios.atualizarPergunta(ctx(req), req.dados.params.id, req.dados.body)))
  r.delete('/perguntas/:id', validar({ params: pId }), async (req, res) => res.json(await e.questionarios.apagarPergunta(ctx(req), req.dados.params.id)))

  r.put('/questionarios/:id/excecoes', validar({ params: pId, body: E.excecaoQuestionario }), async (req, res) => res.json(await e.questionarios.guardarExcecao(ctx(req), req.dados.params.id, req.dados.body)))
  r.delete('/questionarios/:id/excecoes/:estudanteId', validar({ params: z.object({ id: E.idNumerico, estudanteId: E.idNumerico }) }), async (req, res) => { await e.questionarios.apagarExcecao(ctx(req), req.dados.params.id, req.dados.params.estudanteId); res.status(204).end() })
  r.get('/questionarios/:id/estatisticas', validar({ params: pId }), async (req, res) => res.json(await e.questionarios.estatisticas(ctx(req), req.dados.params.id)))
  r.get('/tentativas/:id/correcao', validar({ params: pId }), async (req, res) => res.json(await e.questionarios.tentativaParaCorrigir(ctx(req), req.dados.params.id)))
  r.put('/tentativas/:id/correcao', validar({ params: pId, body: E.correcaoTentativa }), async (req, res) => res.json(await e.questionarios.corrigirTentativa(ctx(req), req.dados.params.id, req.dados.body)))
  r.get('/banco', async (req, res) => res.json(await e.questionarios.banco(ctx(req))))
  r.post('/banco', validar({ body: E.pergunta }), async (req, res) => res.status(201).json(await e.questionarios.criarNoBanco(ctx(req), req.dados.body)))
  r.delete('/banco/:id', validar({ params: pId }), async (req, res) => { await e.questionarios.apagarDoBanco(ctx(req), req.dados.params.id); res.status(204).end() })
  r.post('/perguntas/:id/banco', validar({ params: pId, body: E.paraBanco }), async (req, res) => res.status(201).json(await e.questionarios.guardarNoBanco(ctx(req), req.dados.params.id, req.dados.body)))
  r.post('/questionarios/:id/do-banco', validar({ params: pId, body: E.doBanco }), async (req, res) => res.json(await e.questionarios.juntarDoBanco(ctx(req), req.dados.params.id, req.dados.body)))

  r.get('/questionarios/:id', validar({ params: pId }), async (req, res) => res.json(await e.questionarios.verQuestionario(ctx(req), req.dados.params.id)))
  r.post('/questionarios/:id/tentativas', validar({ params: pId, body: E.iniciarQuestionario }), async (req, res) => res.status(201).json(await e.questionarios.iniciar(ctx(req), req.dados.params.id, req.dados.body)))
  r.put('/tentativas/:id/pagina', validar({ params: pId, body: E.avancarPagina }), async (req, res) => res.json(await e.questionarios.avancar(ctx(req), req.dados.params.id, req.dados.body)))
  r.put('/tentativas/:id/respostas', validar({ params: pId, body: E.respostasQuestionario }), async (req, res) => res.json(await e.questionarios.guardarRespostas(ctx(req), req.dados.params.id, req.dados.body.respostas)))
  r.post('/tentativas/:id/entrega', validar({ params: pId, body: E.respostasQuestionario }), async (req, res) => res.json(await e.questionarios.entregar(ctx(req), req.dados.params.id, req.dados.body.respostas)))
  r.get('/tentativas/:id', validar({ params: pId }), async (req, res) => res.json(await e.questionarios.revisao(ctx(req), req.dados.params.id)))

  return r
}
