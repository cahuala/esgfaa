import { z } from 'zod'
import { NOMES_COLECOES } from '../../dominio/conteudos/colecoes.js'

const texto = (max) => z.string().max(max)
export const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/, 'Identificador inválido.')
export const idNumerico = z.coerce.number().int().positive()
export const colecao = z.enum(NOMES_COLECOES, { error: 'Coleção desconhecida.' })
const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const entrar = z.object({ email: texto(254).default(''), senha: texto(200).default('') })
export const mudarSenha = z.object({ atual: texto(200).default(''), nova: texto(200).default('') })

export const corpoConteudo = z.looseObject({ _estado: z.enum(['rascunho', 'publicado']).optional() })
export const ordem = z.object({ ids: z.array(id).max(2000) })
export const pagina = z.record(z.string(), z.unknown())

export const papel = z.object({
  nome: texto(200).optional(),
  descricao: texto(1000).optional(),
  permissoes: z.array(texto(80)).max(200).optional(),
})

export const novoUtilizador = z.object({ nome: texto(200), email: texto(254), papel: texto(60), senha: texto(200) })
export const editarUtilizador = z.object({
  nome: texto(200).optional(),
  email: texto(254).optional(),
  papel: texto(60).optional(),
  ativo: z.boolean().optional(),
  senha: texto(200).optional(),
})

export const filtrosAtividades = z.object({
  utilizador: idNumerico.optional().catch(undefined),
  acao: texto(60).optional(),
  colecao: texto(60).optional(),
  desde: dataIso.optional().catch(undefined),
  ate: dataIso.optional().catch(undefined),
  q: texto(200).optional(),
  pagina: z.coerce.number().int().min(1).max(100000).default(1).catch(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(25).catch(25),
})

export const dias = z.object({ dias: z.coerce.number().int().min(1).max(365).default(30).catch(30) })

// ---------- público ----------
const visitante = texto(64).optional()
export const consultaVisitante = z.object({ visitante })
export const corpoVisitante = z.object({ visitante }).loose()
export const comentario = z.object({ nome: texto(200).default(''), texto: texto(5000).default(''), website: texto(500).optional(), visitante })
export const visita = z.object({ visitante, caminho: texto(500).optional(), origem: texto(2000).optional() })

// candidatura: a forma do pedido (as regras ficam no domínio); "website" é a armadilha para robôs
export const candidatura = z.looseObject({ website: texto(500).optional() })
export const filtrosCandidaturas = z.object({
  estado: texto(30).optional(),
  curso: texto(120).optional(),
  q: texto(200).optional(),
})
export const avaliacao = z.object({ estado: texto(30).optional(), notas: texto(4000).optional() })

// ---------- portal académico ----------
const textoLivre = (max) => z.union([z.string().max(max), z.number()]).optional()
export const conta = z.object({
  tipo: texto(20).optional(),
  nome: texto(200).optional(),
  email: texto(254).optional(),
  ativo: z.boolean().optional(),
  dados: z.record(z.string(), z.union([z.string().max(200), z.number()])).optional(),
})
export const filtrosContas = z.object({ tipo: texto(20).optional(), q: texto(200).optional() })
export const turma = z.object({ curso: texto(120).optional(), anoLetivo: texto(20).optional(), anoCurricular: textoLivre(2), nome: texto(120).optional(), ativa: z.boolean().optional(), anoFinal: z.boolean().optional() })
export const matricula = z.object({ estudanteId: idNumerico.optional(), estado: texto(20).optional() })
export const cadeira = z.object({
  codigo: texto(40).optional(), nome: texto(200).optional(), periodo: texto(10).optional(), horas: textoLivre(6), descricao: texto(3000).optional(),
})
export const alocacao = z.object({
  docentes: z.array(z.object({ docenteId: idNumerico, papel: texto(20).optional(), horas: textoLivre(6) })).max(20),
})
// multipart (com documento) ou JSON
export const programa = z.object({ texto: z.string().max(200_000).optional(), removerFicheiro: z.union([z.boolean(), z.literal('true'), z.literal('false')]).optional() })
export const horario = z.object({ diaSemana: textoLivre(2), inicio: texto(5), fim: texto(5), sala: texto(80).optional() })
export const avisoGeral = z.object({ turmaId: z.union([idNumerico, z.literal(''), z.null()]).optional(), titulo: texto(300), texto: texto(6000) })
export const tratarPedido = z.object({ estado: texto(30).optional(), resposta: texto(3000).optional() })
export const filtroEstado = z.object({ estado: texto(30).optional() })

export const pedidoNovo = z.object({ tipo: texto(80), motivo: texto(1200).optional() })
export const avisoCadeira = z.object({ titulo: texto(300), texto: texto(6000) })
// listas chegam como lista (JSON) ou como texto JSON (multipart)
const listaTexto = (item, max) => z.preprocess((v) => { if (typeof v !== 'string') return v; try { return JSON.parse(v) } catch { return v } }, z.array(item).max(max))
export const material = z.object({
  titulo: texto(300).optional(), descricao: texto(3000).optional(), secaoId: z.union([z.string().max(12), z.number(), z.null()]).optional(), tipo: texto(20).optional(), url: texto(2000).optional(),
  conteudo: texto(200_000).optional(), inicio: z.union([texto(40), z.null()]).optional(), duracao: z.union([z.number(), z.string().max(6)]).optional(),
  retirarFicheiros: listaTexto(z.string().max(40), 50).optional(),
})
const notaLivre = z.union([z.string().max(6), z.number(), z.null()]).optional()
export const pauta = z.object({ linhas: z.array(z.object({ estudanteId: idNumerico, p1: notaLivre, p2: notaLivre, exame: notaLivre, recurso: notaLivre, observacao: texto(400).optional() })).max(500) })
export const publicacaoNotas = z.object({ publicadas: z.array(z.enum(['p1', 'p2', 'exame', 'recurso'])).max(4) })
// a grelha chega como lista (JSON) ou como texto JSON (multipart)
const grelhaLivre = z.union([z.string().max(20_000), z.array(z.object({ criterio: texto(200).optional(), descricao: texto(600).optional(), pontos: z.union([z.number(), z.string().max(4)]).optional() })).max(15)]).optional()
const pontosLivres = z.union([z.string().max(2000), z.record(z.string().regex(/^\d{1,2}$/), z.union([z.number(), z.string().max(6), z.null()]))]).optional()
export const trabalho = z.object({
  secaoId: z.union([z.string().max(12), z.number(), z.null()]).optional(), titulo: texto(300).optional(), enunciado: texto(12000).optional(), prazo: texto(40).optional(),
  aceitaAtraso: z.union([z.boolean(), z.literal('true'), z.literal('false')]).optional(),
  tipoEntrega: texto(10).optional(), maxFicheiros: z.union([z.number(), z.string().max(3)]).optional(), grelha: grelhaLivre,
  emGrupo: z.union([z.boolean(), z.literal('true'), z.literal('false')]).optional(),
})
export const correcao = z.object({ nota: z.union([z.string().max(6), z.number(), z.null()]).optional(), correcao: texto(6000).optional(), grelha: pontosLivres, removerFicheiro: z.union([z.boolean(), z.literal('true'), z.literal('false')]).optional() })
export const prorrogacao = z.object({ estudanteId: idNumerico, prazo: z.union([texto(40), z.null()]), motivo: texto(500).optional() })
export const aula = z.object({
  data: texto(10).optional(), sumario: texto(3000).optional(),
  presencas: z.array(z.object({ estudanteId: idNumerico, estado: texto(20) })).max(500).optional(),
})
export const entrega = z.object({ comentario: texto(3000).optional(), texto: texto(60_000).optional() })

// ---------- recursos da cadeira (fórum, calendário, progresso, questionários) ----------
export const topico = z.object({ titulo: texto(300).optional(), texto: texto(12_000).optional(), tipo: texto(20).optional() })
export const pesquisaForum = z.object({ q: texto(200).optional() })
export const seguir = z.object({ ativa: z.boolean() })
export const respostaCerta = z.object({ respostaId: z.union([idNumerico, z.null()]) })
export const respostaForum = z.object({ texto: texto(12_000) })
export const moderarTopico = z.object({ fixado: z.boolean().optional(), fechado: z.boolean().optional() })
export const evento = z.object({
  tipo: texto(20), titulo: texto(200).optional(), data: dataIso, inicio: texto(5).optional(), fim: texto(5).optional(),
  local: texto(200).optional(), descricao: texto(3000).optional(),
  turmaId: z.union([idNumerico, z.null()]).optional(), cadeiraId: z.union([idNumerico, z.null()]).optional(),
})
export const intervalo = z.object({ de: dataIso, ate: dataIso })
export const conclusao = z.object({ concluido: z.boolean().optional() })
const dataHora = z.union([z.string().max(40), z.null()]).optional()
export const questionario = z.object({
  titulo: texto(300).optional(), descricao: texto(4000).optional(), abre: dataHora, fecha: dataHora,
  duracao: z.union([z.number(), z.string().max(4)]).optional(), tentativas: z.union([z.number(), z.string().max(3)]).optional(),
  publicado: z.boolean().optional(), mostrarRespostas: z.boolean().optional(), secaoId: z.union([z.string().max(12), z.number(), z.null()]).optional(),
  baralhar: z.boolean().optional(), perguntasPorTentativa: z.union([z.number(), z.string().max(4)]).optional(),
})
const valorLivre = z.union([z.number(), z.string().max(40)])
export const pergunta = z.object({
  tipo: texto(20), enunciado: texto(3000), pontos: z.union([z.number(), z.string().max(8)]).optional(), categoria: texto(100).optional(),
  opcoes: z.union([
    z.array(z.object({ texto: texto(600).optional(), correta: z.boolean().optional() })).max(8),
    z.object({
      respostas: z.array(texto(300)).max(10).optional(), valor: valorLivre.optional(), tolerancia: valorLivre.optional(),
      pares: z.array(z.object({ a: texto(400).optional(), b: texto(400).optional() })).max(8).optional(), orientacao: texto(1200).optional(),
    }),
  ]).optional(),
  correta: z.union([z.boolean(), z.literal('verdadeiro'), z.literal('falso')]).optional(),
})
// resposta de cada pergunta: índices (escolha, correspondência), texto (curta, dissertação) ou número
export const respostasQuestionario = z.object({
  respostas: z.record(z.string().regex(/^\d{1,10}$/), z.union([
    z.array(z.union([z.number().int().min(0).max(20), z.null()])).max(8), z.string().max(20_000), z.number(),
  ])).optional(),
})
export const correcaoTentativa = z.object({ pontos: z.record(z.string().regex(/^\d{1,10}$/), z.union([z.number(), z.string().max(8)])).optional(), comentario: texto(3500).optional() })
export const paraBanco = z.object({ categoria: texto(100).optional() })
export const doBanco = z.object({ ids: z.array(idNumerico).min(1).max(100) })
export const secao = z.object({ titulo: texto(300).optional(), resumo: texto(4000).optional(), visivel: z.boolean().optional(), disponivelDe: z.union([texto(40), z.null()]).optional() })
export const ordemSecoes = z.object({ ids: z.array(idNumerico).max(200) })
export const moverAtividade = z.object({ tipo: texto(20), id: idNumerico, secaoId: z.union([z.string().max(12), z.number(), z.null()]).optional() })
// ---------- notificações e mensagens ----------
export const lerNotificacoes = z.object({ ids: z.array(idNumerico).max(200).optional(), todas: z.boolean().optional() })
export const paginaNotificacoes = z.object({ antesDe: idNumerico.optional() })
export const preferencias = z.object({ notificarEmail: z.boolean() })
export const mensagem = z.object({ texto: texto(6000) })
export const composicao = z.object({
  componente: texto(10),
  itens: z.union([z.array(z.object({ tipo: texto(20), id: idNumerico, peso: z.union([z.number(), z.string().max(4)]).optional() })).max(20), z.null()]),
})
export const copiarCadeira = z.object({ origemId: idNumerico, docentes: z.boolean().optional() })
export const copiarTurma = z.object({ origemTurmaId: idNumerico, docentes: z.boolean().optional() })
export const restricoes = z.object({
  tipo: texto(20), id: idNumerico, visivel: z.boolean().optional(), disponivelDe: z.union([texto(40), z.null()]).optional(),
  requisitos: z.array(z.object({ tipo: texto(20), id: idNumerico, notaMinima: z.union([z.number(), z.string().max(6), z.null()]).optional() })).max(10).optional(),
})

// ---------- inquéritos ----------
export const sondagem = z.object({
  titulo: texto(300).optional(), descricao: texto(3000).optional(), secaoId: z.union([z.string().max(12), z.number(), z.null()]).optional(),
  pergunta: texto(600).optional(), opcoes: z.array(texto(300)).max(12).optional(), multipla: z.boolean().optional(), anonimo: z.boolean().optional(),
  mostrarResultados: texto(20).optional(), fecha: z.union([texto(40), z.null()]).optional(),
})
export const respostasInquerito = z.object({ respostas: z.record(z.string().max(3), z.union([z.array(z.number()).max(12), z.number(), z.string().max(2000)])) })
export const lancarAvaliacao = z.object({ fecha: texto(40), titulo: texto(120).optional() })

// ---------- grupos ----------
export const grupo = z.object({ nome: texto(80).optional(), membros: z.array(idNumerico).max(200).optional() })
export const gruposAutomaticos = z.object({ modo: z.enum(['tamanho', 'numero']), valor: z.number().int().min(1).max(200), prefixo: texto(40).optional(), soSemGrupo: z.boolean().optional() })

// importação de estudantes (folha lida no navegador)
const celula = z.union([z.string().max(300), z.number()]).optional()
export const importarEstudantes = z.object({
  simular: z.boolean().optional(),
  linhas: z.array(z.object({ nome: celula, email: celula, numero: celula, posto: celula, ramo: celula, nip: celula, telefone: celula })).max(500),
})
export const importarPessoas = z.object({ tipo: texto(20).optional(), simular: z.boolean().optional(), linhas: z.array(z.object({ nome: celula, email: celula, posto: celula, ramo: celula, nip: celula, telefone: celula })).max(500) })
export const matricularVarios = z.object({ estudanteIds: z.array(idNumerico).max(300) })

// ---------- registos e relatórios ----------
export const vista = z.object({ tipo: texto(20), id: idNumerico })
export const filtroRegistos = z.object({ estudanteId: idNumerico.optional(), antesDe: idNumerico.optional() })
export const filtroIndicadores = z.object({ anoLetivo: texto(20).optional() })

// ---------- avaliação por pares ----------
export const workshop = z.object({
  titulo: texto(300).optional(), enunciado: texto(12_000).optional(), secaoId: z.union([z.string().max(12), z.number(), z.null()]).optional(),
  grelha: grelhaLivre, fimSubmissao: texto(40).optional(), fimAvaliacao: texto(40).optional(),
  avaliacoesPorPar: z.union([z.number(), z.string().max(3)]).optional(), anonimo: z.union([z.boolean(), z.literal('true'), z.literal('false')]).optional(),
})
export const submissaoWorkshop = z.object({ texto: texto(60_000).optional() })
export const avaliacaoPar = z.object({ pontos: pontosLivres, comentario: texto(6000).optional() })
export const notaWorkshop = z.object({ nota: z.union([z.string().max(6), z.number(), z.null()]).optional(), comentario: texto(6000).optional() })

// ---------- glossário e wiki ----------
export const termo = z.object({ termo: texto(200).optional(), definicao: texto(6000).optional(), aprovado: z.boolean().optional() })
export const paginaWiki = z.object({ titulo: texto(200).optional(), conteudo: texto(200_000).optional(), base: idNumerico.optional(), resumo: texto(300).optional() })
export const versaoWiki = z.object({ versao: idNumerico.optional() })
export const restaurarWiki = z.object({ versaoId: idNumerico })
export const inscricao = z.object({ estudanteId: idNumerico, motivo: texto(20).optional(), observacao: texto(400).optional() })
export const tfc = z.object({ tema: texto(400).optional(), orientador: texto(200).optional(), juri: texto(600).optional(), dataDefesa: z.union([texto(20), z.null()]).optional(), nota: z.union([z.string().max(6), z.number(), z.null()]).optional(), observacao: texto(600).optional() })

// ---------- inquéritos institucionais ----------
const perguntaOpiniao = z.object({ tipo: texto(20), texto: texto(600), opcoes: z.array(texto(300)).max(12).optional(), multipla: z.boolean().optional() })
export const inqueritoInstitucional = z.object({
  titulo: texto(300).optional(), descricao: texto(3000).optional(), perguntas: z.array(perguntaOpiniao).max(30).optional(),
  publico: texto(20).optional(), turmaIds: z.array(idNumerico).max(100).optional(), fecha: texto(40).optional(),
})
