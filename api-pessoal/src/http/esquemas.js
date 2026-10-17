import { z } from 'zod'

const txt = (max, min = 0) => z.string().trim().min(min).max(max)
const opc = (max) => txt(max).optional()
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data no formato AAAA-MM-DD.')
const dataOpc = z.union([data, z.literal(''), z.null()]).optional()
const id = z.coerce.number().int().positive()
const idOpc = z.union([id, z.literal(''), z.null()]).optional().transform((v) => (v === '' ? null : v))
const identificador = z.union([txt(30).regex(/^[A-Za-z0-9./-]*$/, 'Só letras, números, ponto, barra e hífen.'), z.null()]).optional()

export const pId = z.object({ id })
export const pIdSub = z.object({ id, sub: id })
export const entrar = z.object({ email: txt(200, 3), senha: txt(200, 1) })
export const mudarSenha = z.object({ atual: txt(200, 1), nova: txt(200, 1) })
export const utilizador = z.object({ nome: txt(150, 3), email: z.email().max(200), papel: txt(20), senha: txt(200, 1) })
export const editarUtilizador = z.object({ nome: txt(150, 3).optional(), papel: opc(20), ativo: z.boolean().optional(), senha: opc(200) })

export const pessoa = z.object({
  tipo: z.enum(['militar', 'civil']),
  vinculo: z.enum(['docente', 'estudante', 'funcionario']).default('funcionario'),
  nome: txt(150, 5), nomeGuerra: opc(60),
  nip: identificador, numeroAgente: identificador, bi: z.union([txt(20).regex(/^[A-Z0-9]*$/i, 'O BI só tem letras e números.'), z.null()]).optional(),
  dataNascimento: dataOpc, genero: z.union([z.enum(['M', 'F']), z.literal(''), z.null()]).optional(),
  estadoCivil: opc(20).nullable(), naturalidade: opc(80), provincia: opc(40), nacionalidade: opc(40), pai: opc(150), mae: opc(150),
  email: z.union([z.email().max(200), z.literal(''), z.null()]).optional(), telefone: opc(40), morada: opc(250),
  habilitacao: opc(20).nullable(), areaFormacao: opc(120),
  unidadeId: idOpc, cargoId: idOpc, dataCargo: dataOpc,
  ramo: opc(3).nullable(), posto: opc(30).nullable(), fps: opc(3).nullable(), quadroEspecial: opc(10).nullable(), especialidade: opc(80),
  situacao: opc(10).nullable(), efectividade: opc(30).nullable(),
  dataIngresso: dataOpc, dataIngressoQP: dataOpc, dataAntiguidadePosto: dataOpc, dataSituacao: dataOpc,
  avaliacaoFavoravel: z.boolean().optional(), aptidaoFisica: z.boolean().optional(), processoPendente: z.boolean().optional(),
  carreiraCivil: opc(30).nullable(), categoriaCivil: opc(80).nullable(), vinculoCivil: opc(30).nullable(), dataAdmissao: dataOpc, dataCategoria: dataOpc,
  ativo: z.boolean().optional(), observacoes: opc(2000),
}).strict()
export const editarPessoa = pessoa.partial().strict()

export const filtrosPessoas = z.record(z.string(), z.string().max(60)).optional().default({})
export const curso = z.object({ chave: z.union([txt(40), z.null()]).optional(), nome: txt(200, 3), tipo: z.enum(['formacao', 'promocao', 'qualificacao', 'actualizacao', 'academico']).default('formacao'), local: opc(150), inicio: dataOpc, fim: dataOpc, aproveitamento: z.boolean().nullable().optional(), classificacao: z.coerce.number().min(0).max(20).nullable().optional() }).strict()
export const evento = z.object({ tipo: txt(30), data, descricao: txt(1000).default(''), documento: txt(150).default(''), entidade: txt(150).default('') }).strict()
export const fimGraduacao = z.object({ fim: data, motivo: txt(500).default('') })

const item = z.object({ pessoaId: id, postoProposto: opc(30), modalidade: opc(20), cargoId: idOpc, inicio: dataOpc, fim: dataOpc, justificacao: txt(1000).default('') }).strict()
export const itemProposta = item
export const proposta = z.object({ tipo: z.enum(['promocao', 'graduacao', 'nomeacao', 'exoneracao', 'progressao']), titulo: txt(200, 3), fundamentacao: txt(4000).default(''), itens: z.array(item).max(300).default([]) }).strict()
export const editarProposta = z.object({ titulo: txt(200, 3).optional(), fundamentacao: txt(4000).optional() }).strict()
export const despacho = z.object({ documento: txt(150, 2), dataDocumento: data, entidade: txt(150).default('') }).strict()
export const motivo = z.object({ motivo: txt(1000).default('') })
export const motivoObrigatorio = z.object({ motivo: txt(1000, 3) })

export const licenca = z.object({ pessoaId: id, tipo: txt(30), inicio: data, fim: data, despacho: txt(150).default(''), observacoes: txt(1000).default('') }).strict()
export const unidade = z.object({ nome: txt(150, 2), sigla: txt(20).default(''), paiId: idOpc, ordem: z.coerce.number().int().min(0).max(999).default(0) }).strict()
export const cargo = z.object({ nome: txt(150, 2), unidadeId: idOpc, funcao: txt(20).default('execucao'), tipo: z.enum(['militar', 'civil', 'ambos']).default('militar'), postoRequerido: z.union([txt(30), z.null()]).optional(), categoriaCivil: z.union([txt(80), z.null()]).optional(), vagas: z.coerce.number().int().min(1).max(500).default(1) }).strict()
