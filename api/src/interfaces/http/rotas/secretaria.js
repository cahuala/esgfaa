import { Router } from 'express'
import { z } from 'zod'
import { validar } from '../middlewares/validar.js'
import { enviarFicheiro, receberFicheiro } from '../middlewares/ficheirosPrivados.js'
import * as E from '../esquemas.js'
import { CORPO_SECRETARIA, REGRAS_SECRETARIA, bloquearAnoFechado } from '../middlewares/anoFechado.js'

const pId = z.object({ id: E.idNumerico })
const pFicheiro = z.object({ id: z.string().regex(/^[0-9a-f-]{36}$/, 'Ficheiro não encontrado.') })

// Gestão académica no painel (Repartição de Administração Escolar): /api/admin/academico/… (já autenticado)
export function rotasSecretaria({ servicos, config, privados }) {
  const r = Router()
  const a = servicos.administracaoEscolar
  const p = servicos.pessoal
  const ctx = (req) => req.contexto
  const ficheiro = privados ? receberFicheiro({ privados, config }) : (req, res, next) => next()

  // anos letivos: datas do ano e dos semestres, e qual é o atual
  const anos = a.anosLetivos
  // ano lectivo fechado: não se altera nada dele (reabre-se por ordem do Comandante)
  r.use(bloquearAnoFechado(anos, REGRAS_SECRETARIA, { doCorpo: CORPO_SECRETARIA }))
  const pAno = z.object({ id: z.string().regex(/^\d{4}-\d{4}$/, 'Ano lectivo não encontrado.') })
  const idAno = (req) => req.dados.params.id.replace('-', '/')
  const datasAno = z.object({ inicio: z.string().max(10), fim: z.string().max(10), semestre1Inicio: z.string().max(10), semestre1Fim: z.string().max(10), semestre2Inicio: z.string().max(10), semestre2Fim: z.string().max(10) })
  r.get('/anos-letivos', async (req, res) => res.json(await anos.listar(ctx(req))))
  r.post('/anos-letivos', validar({ body: datasAno.extend({ id: z.string().max(9) }) }), async (req, res) => res.status(201).json(await anos.criar(ctx(req), req.dados.body)))
  r.put('/anos-letivos/:id', validar({ params: pAno, body: datasAno }), async (req, res) => res.json(await anos.editar(ctx(req), idAno(req), req.dados.body)))
  r.post('/anos-letivos/:id/atual', validar({ params: pAno }), async (req, res) => res.json(await anos.tornarAtual(ctx(req), idAno(req))))
  r.delete('/anos-letivos/:id', validar({ params: pAno }), async (req, res) => { await anos.apagar(ctx(req), idAno(req)); res.status(204).end() })
  // fechar o ano lectivo; reabrir só por ordem do Comandante (a Administração Escolar pede, ele aprova)
  r.post('/anos-letivos/:id/fechar', validar({ params: pAno, body: z.object({ motivo: z.string().max(1000).optional() }) }), async (req, res) => res.json(await anos.fechar(ctx(req), idAno(req), req.dados.body)))
  r.post('/anos-letivos/:id/reabrir', validar({ params: pAno, body: z.object({ motivo: z.string().max(1000), finalidade: z.enum(['actividades', 'documento']).optional(), documento: z.string().max(300).optional() }) }), async (req, res) => res.json(await anos.pedirReabertura(ctx(req), idAno(req), req.dados.body)))

  // controlo centralizado: provas escritas para imprimir (Repartição), alterações de notas e docentes (Comandante)
  const ctl = servicos.controlo
  r.get('/pendentes', async (req, res) => res.json(await ctl.pendentes(ctx(req))))
  r.get('/provas-escritas', validar({ query: E.filtroEstado }), async (req, res) => res.json(await ctl.paraImprimir(ctx(req), req.dados.query)))
  r.put('/provas-escritas/:id', validar({ params: pId, body: z.object({ impresso: z.boolean() }) }), async (req, res) => res.json(await ctl.marcarImpresso(ctx(req), req.dados.params.id, req.dados.body.impresso)))
  r.get('/alteracoes-notas', validar({ query: E.filtroEstado }), async (req, res) => res.json(await ctl.pedidosParaDecidir(ctx(req), req.dados.query)))
  r.post('/alteracoes-notas/decidir', validar({ body: E.decisaoAlteracaoNota }), async (req, res) => res.json(await ctl.decidir(ctx(req), req.dados.body)))
  r.get('/docentes-verificacao', async (req, res) => res.json(await ctl.docentes(ctx(req))))
  r.post('/docentes-verificacao', validar({ body: E.verificarDocentes }), async (req, res) => res.json(await ctl.verificarDocentes(ctx(req), req.dados.body.ids)))

  r.get('/contas/origem', (req, res) => res.json(p.registo.origem(ctx(req))))
  r.get('/contas', validar({ query: E.filtrosContas }), async (req, res) => res.json(await p.registo.listarContas(ctx(req), req.dados.query)))
  r.get('/contas/:id/foto', validar({ params: pId }), async (req, res) => enviarFicheiro(req, res, await p.registo.fotoDaConta(ctx(req), req.dados.params.id), { soLeitura: true }))
  r.post('/contas', validar({ body: E.conta }), async (req, res) => res.status(201).json(await p.registo.criarConta(ctx(req), req.dados.body)))
  r.put('/contas/:id', validar({ params: pId, body: E.conta }), async (req, res) => res.json(await p.registo.editarConta(ctx(req), req.dados.params.id, req.dados.body)))
  r.post('/contas/:id/repor-senha', validar({ params: pId }), async (req, res) => res.json(await p.registo.reporSenha(ctx(req), req.dados.params.id)))

  r.get('/turmas', async (req, res) => res.json(await a.turmas.listarTurmas(ctx(req))))
  r.post('/turmas', validar({ body: E.turma }), async (req, res) => res.status(201).json(await a.turmas.criarTurma(ctx(req), req.dados.body)))
  r.get('/turmas/:id', validar({ params: pId }), async (req, res) => res.json(await a.turmas.turma(ctx(req), req.dados.params.id)))
  // horário mensal da turma: os dias úteis × os tempos, com a cadeira (e a sessão) ou um texto em cada célula
  r.get('/turmas/:id/horario-mensal', validar({ params: pId, query: z.object({ mes: z.string().regex(/^\d{4}-\d{2}$/) }) }), async (req, res) => res.json(await a.horarioMensal.doMes(ctx(req), req.dados.params.id, req.dados.query.mes)))
  r.put('/turmas/:id/horario-mensal', validar({ params: pId, body: z.object({ data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), bloco: z.string().max(20), cadeiraId: z.number().int().positive().nullable().optional(), texto: z.string().max(40).optional() }) }), async (req, res) => res.json(await a.horarioMensal.guardar(ctx(req), req.dados.params.id, req.dados.body)))
  // lista do curso (todas as turmas de um curso num ano lectivo), pela ordem hierárquica
  // o Director de cada curso (designado pela Administração Escolar)
  r.get('/directores-curso', async (req, res) => res.json(await a.turmas.directoresDeCurso(ctx(req))))
  r.put('/cursos/:curso/director', validar({ params: z.object({ curso: z.string().max(120) }), body: z.object({ utilizadorId: z.number().int().positive().nullable() }) }), async (req, res) => res.json(await a.turmas.definirDirectorDeCurso(ctx(req), req.dados.params.curso, req.dados.body.utilizadorId)))
  r.get('/cursos/:curso/lista', validar({ params: z.object({ curso: z.string().max(120) }), query: z.object({ anoLetivo: z.string().regex(/^\d{4}\/\d{4}$/).optional() }) }), async (req, res) => res.json(await a.turmas.listaDoCurso(ctx(req), req.dados.params.curso, req.dados.query.anoLetivo)))
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
  // documentos do ano lectivo: dados estatísticos, dados por ramos, resumo, entrega dos diplomas, lista para os diplomas
  // estrutura do ensino: os cursos com o Director e os departamentos com as suas cadeiras (e quem lá trabalha)
  r.get('/estrutura', validar({ query: z.object({ anoLetivo: z.string().regex(/^\d{4}\/\d{4}$/).optional() }) }), async (req, res) => res.json(await a.turmas.estruturaDoEnsino(ctx(req), req.dados.query.anoLetivo)))
  r.put('/cadeiras/:id/departamento', validar({ params: pId, body: z.object({ departamento: z.string().max(120) }) }), async (req, res) => res.json(await a.turmas.departamentoDaCadeira(ctx(req), req.dados.params.id, req.dados.body.departamento)))
  r.get('/documentos-do-ano', validar({ query: z.object({ anoLetivo: z.string().regex(/^\d{4}\/\d{4}$/) }) }), async (req, res) => res.json(await a.documentos.documentosDoAno(ctx(req), req.dados.query.anoLetivo)))
  // pauta final do curso: UC por bloco, médias, média final e classificação (PDF e Excel com as fórmulas)
  r.get('/turmas/:id/pauta-final', validar({ params: pId }), async (req, res) => res.json(await a.documentos.pautaFinal(ctx(req), req.dados.params.id)))
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
  // o Ensino envia ao Comandante a distribuição dos docentes de uma turma
  // a distribuição dos docentes: uma só lista por ano lectivo (para imprimir e enviar ao Comandante)
  const anoLetivo = z.object({ anoLetivo: z.string().min(4).max(20) })
  r.get('/distribuicao', validar({ query: anoLetivo }), async (req, res) => res.json(await a.aprovacoes.listaDoAno(ctx(req), req.dados.query.anoLetivo)))
  r.post('/distribuicao', validar({ body: anoLetivo }), async (req, res) => res.json(await a.aprovacoes.enviarDistribuicao(ctx(req), req.dados.body.anoLetivo)))

  r.get('/cadeiras/:id/pauta', validar({ params: pId }), async (req, res) => res.json(await a.pautas.pauta(ctx(req), req.dados.params.id)))
  r.put('/cadeiras/:id/pauta', validar({ params: pId, body: E.pauta }), async (req, res) => res.json(await a.pautas.gravarPauta(ctx(req), req.dados.params.id, req.dados.body.linhas)))
  r.put('/cadeiras/:id/pauta/composicao', validar({ params: pId, body: E.composicao }), async (req, res) => res.json(await a.pautas.definirComposicao(ctx(req), req.dados.params.id, req.dados.body)))
  r.put('/cadeiras/:id/pauta/publicacao', validar({ params: pId, body: E.publicacaoNotas }), async (req, res) => res.json(await a.pautas.publicarNotas(ctx(req), req.dados.params.id, req.dados.body.publicadas)))
  // planos de curso da ESG: o plano, os modelos 2026/2027, a pauta geral e as provas TAI/TAG de cada UC
  const pc = a.planosCurso
  const pProva = z.object({ id: E.idNumerico, prova: E.idNumerico })
  r.get('/planos-curso', async (req, res) => res.json(await pc.listar(ctx(req))))
  r.post('/planos-curso', validar({ body: E.planoCurso }), async (req, res) => res.status(201).json(await pc.guardar(ctx(req), null, req.dados.body)))
  r.put('/planos-curso/:id', validar({ params: pId, body: E.planoCurso }), async (req, res) => res.json(await pc.guardar(ctx(req), req.dados.params.id, req.dados.body)))
  r.put('/planos-curso/:id/documento', ficheiro, validar({ params: pId, body: E.programa }), async (req, res) => res.json(await pc.documento(ctx(req), req.dados.params.id, req.dados.body, req.ficheiro)))
  r.delete('/planos-curso/:id', validar({ params: pId }), async (req, res) => { await pc.apagar(ctx(req), req.dados.params.id); res.status(204).end() })
  r.get('/turmas/:id/plano-curso', validar({ params: pId }), async (req, res) => res.json(await pc.daTurma(ctx(req), req.dados.params.id)))
  r.post('/turmas/:id/plano-curso', validar({ params: pId, body: E.modeloPlano }), async (req, res) => res.status(201).json(await pc.carregarModelo(ctx(req), req.dados.params.id, req.dados.body.modelo)))
  r.get('/turmas/:id/pauta-plano', validar({ params: pId }), async (req, res) => res.json(await pc.pautaGeral(ctx(req), req.dados.params.id)))
  // Conselho de Curso e homologação (Director de Ensino e Comandante)
  const cc = a.conselhoCurso
  const pEst = z.object({ id: E.idNumerico, estudanteId: E.idNumerico })
  r.get('/turmas/:id/conselho', validar({ params: pId }), async (req, res) => res.json(await cc.estado(ctx(req), req.dados.params.id)))
  r.put('/turmas/:id/conselho/juizo/:estudanteId', validar({ params: pEst, body: E.juizo }), async (req, res) => res.json(await cc.guardarJuizo(ctx(req), req.dados.params.id, req.dados.params.estudanteId, req.dados.body)))
  r.put('/turmas/:id/conselho/ajuste/:estudanteId', validar({ params: pEst, body: E.ajusteCurso }), async (req, res) => res.json(await cc.guardarAjuste(ctx(req), req.dados.params.id, req.dados.params.estudanteId, req.dados.body.ajuste)))
  r.get('/turmas/:id/revisoes', validar({ params: pId }), async (req, res) => res.json(await cc.revisoes(ctx(req), req.dados.params.id)))
  r.put('/turmas/:id/revisoes', validar({ params: pId, body: E.decidirRevisao }), async (req, res) => res.json(await cc.decidirRevisao(ctx(req), req.dados.params.id, req.dados.body)))
  r.post('/turmas/:id/conselho/propor', validar({ params: pId }), async (req, res) => res.json(await cc.propor(ctx(req), req.dados.params.id)))
  r.post('/turmas/:id/conselho/confirmar', validar({ params: pId, body: E.confirmarConselho }), async (req, res) => res.json(await cc.confirmar(ctx(req), req.dados.params.id, req.dados.body)))
  r.post('/turmas/:id/conselho/homologar', validar({ params: pId, body: E.homologarCurso }), async (req, res) => res.json(await cc.homologar(ctx(req), req.dados.params.id, req.dados.body)))
  r.post('/turmas/:id/conselho/reabrir', validar({ params: pId, body: E.reabrirCurso }), async (req, res) => res.json(await cc.reabrir(ctx(req), req.dados.params.id, req.dados.body)))
  r.post('/cadeiras/:id/provas', validar({ params: pId, body: E.provaUc }), async (req, res) => res.status(201).json(await pc.criarProva(ctx(req), req.dados.params.id, req.dados.body)))
  r.put('/cadeiras/:id/provas/:prova', validar({ params: pProva, body: E.provaUc }), async (req, res) => res.json(await pc.editarProva(ctx(req), req.dados.params.id, req.dados.params.prova, req.dados.body)))
  r.delete('/cadeiras/:id/provas/:prova', validar({ params: pProva }), async (req, res) => res.json(await pc.apagarProva(ctx(req), req.dados.params.id, req.dados.params.prova)))
  r.put('/cadeiras/:id/provas/:prova/notas', validar({ params: pProva, body: E.notasProva }), async (req, res) => res.json(await pc.notasProva(ctx(req), req.dados.params.id, req.dados.params.prova, req.dados.body.linhas)))
  r.put('/cadeiras/:id/provas/:prova/publicacao', validar({ params: pProva, body: E.publicarProva }), async (req, res) => res.json(await pc.publicarProva(ctx(req), req.dados.params.id, req.dados.params.prova, req.dados.body.publicar)))
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
