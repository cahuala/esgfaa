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
