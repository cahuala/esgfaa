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
  const a = servicos.administracaoEscolar
  const p = servicos.pessoal
  const ctx = (req) => req.contexto
  const ficheiro = privados ? receberFicheiro({ privados, config }) : (req, res, next) => next()

  r.get('/contas', validar({ query: E.filtrosContas }), async (req, res) => res.json(await p.registo.listarContas(ctx(req), req.dados.query)))
  r.post('/contas', validar({ body: E.conta }), async (req, res) => res.status(201).json(await p.registo.criarConta(ctx(req), req.dados.body)))
  r.put('/contas/:id', validar({ params: pId, body: E.conta }), async (req, res) => res.json(await p.registo.editarConta(ctx(req), req.dados.params.id, req.dados.body)))
  r.post('/contas/:id/repor-senha', validar({ params: pId }), async (req, res) => { await p.registo.reporSenha(ctx(req), req.dados.params.id); res.status(204).end() })

  r.get('/turmas', async (req, res) => res.json(await a.turmas.listarTurmas(ctx(req))))
  r.post('/turmas', validar({ body: E.turma }), async (req, res) => res.status(201).json(await a.turmas.criarTurma(ctx(req), req.dados.body)))
  r.get('/turmas/:id', validar({ params: pId }), async (req, res) => res.json(await a.turmas.turma(ctx(req), req.dados.params.id)))
  r.put('/turmas/:id', validar({ params: pId, body: E.turma }), async (req, res) => res.json(await a.turmas.editarTurma(ctx(req), req.dados.params.id, req.dados.body)))
  r.post('/turmas/:id/matriculas', validar({ params: pId, body: E.matricula }), async (req, res) => res.status(201).json(await a.turmas.matricular(ctx(req), req.dados.params.id, req.dados.body)))
  r.post('/contas/importar', validar({ body: E.importarPessoas }), async (req, res) => res.json(await p.registo.importar(ctx(req), req.dados.body)))
  r.post('/turmas/:id/matricular', validar({ params: pId, body: E.matricularVarios }), async (req, res) => res.json(await a.turmas.matricularVarios(ctx(req), req.dados.params.id, req.dados.body)))
  r.post('/turmas/:id/importar', validar({ params: pId, body: E.importarEstudantes }), async (req, res) => res.json(await a.turmas.importarEstudantes(ctx(req), req.dados.params.id, req.dados.body)))
  r.post('/turmas/:id/transicao', validar({ params: pId, body: E.transicao }), async (req, res) => res.json(await a.turmas.transicao(ctx(req), req.dados.params.id, req.dados.body)))
  r.put('/matriculas/:id', validar({ params: pId, body: E.matricula }), async (req, res) => res.json(await a.turmas.alterarMatricula(ctx(req), req.dados.params.id, req.dados.body)))

  r.post('/turmas/:id/cadeiras', validar({ params: pId, body: E.cadeira }), async (req, res) => res.status(201).json(await a.cadeiras.criarCadeira(ctx(req), req.dados.params.id, req.dados.body)))
  r.put('/cadeiras/:id', validar({ params: pId, body: E.cadeira }), async (req, res) => res.json(await a.cadeiras.editarCadeira(ctx(req), req.dados.params.id, req.dados.body)))
  r.delete('/cadeiras/:id', validar({ params: pId }), async (req, res) => { await a.cadeiras.apagarCadeira(ctx(req), req.dados.params.id); res.status(204).end() })
  r.get('/cadeiras/:id', validar({ params: pId }), async (req, res) => res.json(await a.cadeiras.cadeira(ctx(req), req.dados.params.id)))
  r.put('/cadeiras/:id/programa', ficheiro, validar({ params: pId, body: E.programa }), async (req, res) => res.json(await a.cadeiras.programa(ctx(req), req.dados.params.id, req.dados.body, req.ficheiro)))
  r.put('/cadeiras/:id/docentes', validar({ params: pId, body: E.alocacao }), async (req, res) => res.json(await a.cadeiras.alocarDocentes(ctx(req), req.dados.params.id, req.dados.body.docentes)))
  r.get('/origens-copia', async (req, res) => res.json(await a.cadeiras.origensDeCopia(ctx(req))))
  r.post('/cadeiras/:id/copiar', validar({ params: pId, body: E.copiarCadeira }), async (req, res) => res.json(await a.cadeiras.copiarParaCadeira(ctx(req), req.dados.params.id, req.dados.body)))
  r.post('/turmas/:id/copiar', validar({ params: pId, body: E.copiarTurma }), async (req, res) => res.json(await a.cadeiras.copiarTurma(ctx(req), req.dados.params.id, req.dados.body)))
  // inquérito pedagógico: avaliação dos docentes pelos estudantes
  const q = servicos.inqueritos
  r.get('/turmas/:id/avaliacao', validar({ params: pId }), async (req, res) => res.json(await q.avaliacoesDaTurma(ctx(req), req.dados.params.id)))
  r.post('/turmas/:id/avaliacao', validar({ params: pId, body: E.lancarAvaliacao }), async (req, res) => res.status(201).json(await q.lancarAvaliacao(ctx(req), req.dados.params.id, req.dados.body)))
  r.get('/inqueritos/:id', validar({ params: pId }), async (req, res) => res.json(await q.resultadosAdmin(ctx(req), req.dados.params.id)))
  r.delete('/inqueritos/:id', validar({ params: pId }), async (req, res) => { await q.apagarAvaliacao(ctx(req), req.dados.params.id); res.status(204).end() })
  r.get('/indicadores', validar({ query: E.filtroIndicadores }), async (req, res) => res.json(await servicos.indicadores.indicadores(ctx(req), req.dados.query)))
  r.get('/cadeiras/:id/inscricoes', validar({ params: pId }), async (req, res) => res.json(await a.inscricoes.daCadeira(ctx(req), req.dados.params.id)))
  r.post('/cadeiras/:id/inscricoes', validar({ params: pId, body: E.inscricao }), async (req, res) => res.status(201).json(await a.inscricoes.inscrever(ctx(req), req.dados.params.id, req.dados.body)))
  r.delete('/inscricoes/:id', validar({ params: pId }), async (req, res) => res.json(await a.inscricoes.anular(ctx(req), req.dados.params.id)))
  // conclusão do curso e documentos para imprimir
  r.get('/turmas/:id/finalistas', validar({ params: pId }), async (req, res) => res.json(await a.conclusao.finalistas(ctx(req), req.dados.params.id)))
  r.put('/turmas/:id/tfc/:estudanteId', validar({ params: z.object({ id: E.idNumerico, estudanteId: E.idNumerico }), body: E.tfc }), async (req, res) => res.json(await a.conclusao.lancarTfc(ctx(req), req.dados.params.id, req.dados.params.estudanteId, req.dados.body)))
  r.get('/documentos-academicos', async (req, res) => res.json(await a.conclusao.documentosAcademicos(ctx(req))))
  r.put('/documentos-academicos', validar({ body: E.documentosAcademicos }), async (req, res) => res.json(await a.conclusao.guardarDocumentosAcademicos(ctx(req), req.dados.body)))
  r.post('/turmas/:id/certificados/:estudanteId', validar({ params: z.object({ id: E.idNumerico, estudanteId: E.idNumerico }) }), async (req, res) => res.status(201).json(await a.conclusao.emitirCertificado(ctx(req), req.dados.params.id, req.dados.params.estudanteId)))
  r.get('/estudantes/:id/historico', validar({ params: pId }), async (req, res) => res.json(await a.conclusao.historico(ctx(req), req.dados.params.id)))
  r.get('/turmas/:id/pauta-geral', validar({ params: pId }), async (req, res) => res.json(await a.documentos.pautaDaTurma(ctx(req), req.dados.params.id)))
  r.get('/cadeiras/:id/folha-presencas', validar({ params: pId }), async (req, res) => res.json(await a.documentos.folhaPresencas(ctx(req), req.dados.params.id)))
  r.get('/cadeiras/:id/lista-prova', validar({ params: pId }), async (req, res) => res.json(await a.documentos.listaProva(ctx(req), req.dados.params.id)))
  // inquéritos institucionais de satisfação
  const iq = servicos.qualidade.inqueritos
  r.get('/satisfacao', async (req, res) => res.json(await iq.listar(ctx(req))))
  r.post('/satisfacao', validar({ body: E.inqueritoInstitucional }), async (req, res) => res.status(201).json(await iq.criar(ctx(req), req.dados.body)))
  r.put('/satisfacao/:id', validar({ params: pId, body: E.inqueritoInstitucional }), async (req, res) => res.json(await iq.atualizar(ctx(req), req.dados.params.id, req.dados.body)))
  r.post('/satisfacao/:id/lancar', validar({ params: pId }), async (req, res) => res.json(await iq.lancar(ctx(req), req.dados.params.id)))
  r.get('/satisfacao/:id/resultados', validar({ params: pId }), async (req, res) => res.json(await iq.resultados(ctx(req), req.dados.params.id)))
  r.delete('/satisfacao/:id', validar({ params: pId }), async (req, res) => { await iq.apagar(ctx(req), req.dados.params.id); res.status(204).end() })
  r.get('/alocacao', async (req, res) => res.json(await a.cadeiras.alocacao(ctx(req))))

  r.get('/cadeiras/:id/pauta', validar({ params: pId }), async (req, res) => res.json(await a.pautas.pauta(ctx(req), req.dados.params.id)))
  r.put('/cadeiras/:id/pauta', validar({ params: pId, body: E.pauta }), async (req, res) => res.json(await a.pautas.gravarPauta(ctx(req), req.dados.params.id, req.dados.body.linhas)))
  r.put('/cadeiras/:id/pauta/composicao', validar({ params: pId, body: E.composicao }), async (req, res) => res.json(await a.pautas.definirComposicao(ctx(req), req.dados.params.id, req.dados.body)))
  r.put('/cadeiras/:id/pauta/publicacao', validar({ params: pId, body: E.publicacaoNotas }), async (req, res) => res.json(await a.pautas.publicarNotas(ctx(req), req.dados.params.id, req.dados.body.publicadas)))
  r.post('/cadeiras/:id/horarios', validar({ params: pId, body: E.horario }), async (req, res) => res.status(201).json(await a.cadeiras.criarHorario(ctx(req), req.dados.params.id, req.dados.body)))
  r.delete('/horarios/:id', validar({ params: pId }), async (req, res) => { await a.cadeiras.apagarHorario(ctx(req), req.dados.params.id); res.status(204).end() })

  r.get('/pedidos', validar({ query: E.filtroEstado }), async (req, res) => res.json(await a.pedidos.listarPedidos(ctx(req), req.dados.query)))
  r.put('/pedidos/:id', ficheiro, validar({ params: pId, body: E.tratarPedido }), async (req, res) => res.json(await a.pedidos.tratarPedido(ctx(req), req.dados.params.id, req.dados.body, req.ficheiro)))
  r.get('/ficheiros/:id', validar({ params: pFicheiro }), async (req, res) => enviarFicheiro(req, res, await a.pedidos.ficheiro(ctx(req), req.dados.params.id)))

  r.get('/eventos', async (req, res) => res.json(await a.calendario.listarEventos(ctx(req))))
  r.get('/cadeiras/:id/eventos', validar({ params: pId }), async (req, res) => res.json(await a.calendario.eventosDaCadeira(ctx(req), req.dados.params.id)))
  r.post('/eventos', validar({ body: E.evento }), async (req, res) => res.status(201).json(await a.calendario.criarEvento(ctx(req), req.dados.body)))
  r.delete('/eventos/:id', validar({ params: pId }), async (req, res) => { await a.calendario.apagarEvento(ctx(req), req.dados.params.id); res.status(204).end() })
  // prazos de lançamento das notas (o docente só lança dentro deles)
  r.get('/prazos-notas', async (req, res) => res.json(await a.prazosNotas.listar(ctx(req))))
  r.post('/prazos-notas', validar({ body: E.prazoNotas }), async (req, res) => res.status(201).json(await a.prazosNotas.criar(ctx(req), req.dados.body)))
  r.delete('/prazos-notas/:id', validar({ params: pId }), async (req, res) => { await a.prazosNotas.apagar(ctx(req), req.dados.params.id); res.status(204).end() })

  r.get('/avisos', async (req, res) => res.json(await a.avisos.listarAvisos(ctx(req))))
  r.post('/avisos', validar({ body: E.avisoGeral }), async (req, res) => res.status(201).json(await a.avisos.criarAviso(ctx(req), req.dados.body)))
  r.delete('/avisos/:id', validar({ params: pId }), async (req, res) => { await a.avisos.apagarAviso(ctx(req), req.dados.params.id); res.status(204).end() })

  return r
}
