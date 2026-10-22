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
export const entrar = z.object({ email: txt(200, 3), senha: txt(200, 1), codigo: txt(20).optional() })
export const codigo2fa = z.object({ codigo: txt(20, 1) }).strict()
export const desligar2fa = z.object({ senha: txt(200, 1), codigo: txt(20, 1) }).strict()
export const mudarSenha = z.object({ atual: txt(200, 1), nova: txt(200, 1) })
export const utilizador = z.object({ nome: txt(150, 3), email: z.email().max(200), papel: txt(20), senha: txt(200, 1), unidadeId: idOpc })
export const editarUtilizador = z.object({ nome: txt(150, 3).optional(), papel: opc(20), ativo: z.boolean().optional(), senha: opc(200), unidadeId: idOpc })

export const pessoa = z.object({
  tipo: z.enum(['militar', 'civil']),
  vinculo: z.enum(['docente', 'estudante', 'funcionario', 'domiciliar']).default('funcionario'),
  militarAlocadoId: idOpc,
  nome: txt(150, 5), nomeGuerra: opc(60),
  nip: identificador, numeroAgente: identificador, bi: z.union([txt(20).regex(/^[A-Z0-9]*$/i, 'O BI só tem letras e números.'), z.null()]).optional(),
  dataNascimento: dataOpc, genero: z.union([z.enum(['M', 'F']), z.literal(''), z.null()]).optional(),
  estadoCivil: opc(20).nullable(), naturalidade: opc(80), provincia: opc(40), nacionalidade: opc(40), pai: opc(150), mae: opc(150),
  email: z.union([z.email().max(200), z.literal(''), z.null()]).optional(), telefone: opc(40), morada: opc(250),
  habilitacao: opc(20).nullable(), areaFormacao: opc(120),
  unidadeId: idOpc, cargoId: idOpc, dataCargo: dataOpc,
  ramo: opc(3).nullable(), posto: opc(30).nullable(), fps: opc(3).nullable(), quadroEspecial: opc(10).nullable(), especialidade: opc(80),
  situacao: opc(10).nullable(), efectividade: opc(30).nullable(), estado: opc(30).nullable(),
  dataIngresso: dataOpc, dataIngressoQP: dataOpc, dataAntiguidadePosto: dataOpc, dataSituacao: dataOpc,
  avaliacaoFavoravel: z.boolean().optional(), aptidaoFisica: z.boolean().optional(), processoPendente: z.boolean().optional(),
  carreiraCivil: opc(30).nullable(), categoriaCivil: opc(80).nullable(), vinculoCivil: opc(30).nullable(), dataAdmissao: dataOpc, dataCategoria: dataOpc,
  ativo: z.boolean().optional(), observacoes: opc(2000),
  outrosVinculos: z.array(z.enum(['docente', 'estudante', 'funcionario'])).max(3).optional(),
  dataEntradaEscola: dataOpc, dataSaidaEscola: dataOpc, motivoSaida: opc(300), destinoSaida: opc(200),
  // ficha individual (modelos da ESG)
  municipio: opc(80), bairro: opc(120), rua: opc(150), casa: opc(30), caixaPostal: opc(30), telefoneAlternativo: opc(40),
  biEmitidoEm: dataOpc, biValidade: dataOpc, biLocalEmissao: opc(80), grupoSanguineo: z.union([z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']), z.literal('')]).optional(),
  conjuge: opc(150), conjugeLocalServico: opc(150),
  registo: z.object({
    estudos: z.array(z.object({ classe: opc(30), ano: opc(20) }).strict()).max(6).optional(),
    linguas: z.array(z.object({ lingua: opc(30), nivel: z.union([z.enum(['MB', 'B', 'R']), z.literal('')]).optional() }).strict()).max(4).optional(),
    locaisAnteriores: z.array(z.object({ local: opc(150), de: opc(10), ate: opc(10), profissao: opc(100) }).strict()).max(3).optional(),
    colocacoes: z.array(z.object({ categoria: opc(100), despacho: opc(60), data: opc(10), dr: opc(40), inicio: opc(10), situacao: opc(80), colocacao: opc(120), responsabilidade: opc(150) }).strict()).max(6).optional(),
    situacaoMilitar: z.object({ tipo: z.union([z.enum(['adiado', 'disponibilidade', 'isento', 'nao_apto', 'refratario', 'militar']), z.literal('')]).optional(), desde: opc(10), reiniciou: opc(10) }).strict().optional(),
    saude: z.object({ dador: z.union([z.boolean(), z.null()]).optional(), defeitoFisico: opc(200), doencas: opc(300) }).strict().optional(),
    classificacoes: z.array(z.object({ ano: opc(4), ponderacao: opc(20), pontos: opc(20) }).strict()).max(20).optional(),
    assiduidade: z.array(z.object({ ano: opc(4), justificadas: opc(5), injustificadas: opc(5) }).strict()).max(40).optional(),
    outrasInformacoes: opc(4000),
  }).strict().optional(),
  agregado: z.array(z.object({ nome: txt(150, 1), parentesco: opc(40), dataNascimento: dataOpc, nacionalidade: opc(40), profissao: opc(80), bi: opc(20), genero: z.union([z.enum(['M', 'F']), z.literal('')]).optional(), estadoCivil: opc(20), naturalidade: opc(80), provincia: opc(40), localTrabalho: opc(150), telefone: opc(40), pai: opc(150), mae: opc(150) }).strict()).max(30).optional(),
  vencimento: z.union([z.coerce.number().min(0).max(1e9), z.literal(''), z.null()]).optional(), inss: opc(30), banco: opc(80), iban: opc(40), numeroConta: opc(40),
  localIncorporacao: opc(120), voluntario: z.union([z.boolean(), z.null()]).optional(),
  tipoDocente: z.union([z.enum(['efectivo', 'colaborador']), z.literal(''), z.null()]).optional(), categoriaDocente: opc(60), funcaoActual: opc(200), paisNascimento: opc(60),
}).strict()
export const editarPessoa = pessoa.partial().strict()

const pessoaAssina = z.object({ cargo: txt(120), nome: txt(150), posto: txt(60) }).strict()
export const assinaturas = z.object({ comandante: pessoaAssina, chefeRpq: pessoaAssina, local: txt(60, 2) }).strict()
export const emitirDocumentos = z.object({ documentos: z.array(z.object({ tipo: txt(40, 1), dados: z.record(z.string(), z.union([z.string().max(2000), z.number(), z.boolean(), z.null()])).optional() }).strict()).min(1).max(20) }).strict()
export const filtrosPessoas = z.record(z.string(), z.string().max(60)).optional().default({})
export const curso = z.object({ chave: z.union([txt(40), z.null()]).optional(), nome: txt(200, 3), tipo: z.enum(['formacao', 'promocao', 'qualificacao', 'actualizacao', 'academico']).default('formacao'), local: opc(150), inicio: dataOpc, fim: dataOpc, aproveitamento: z.boolean().nullable().optional(), classificacao: z.coerce.number().min(0).max(20).nullable().optional() }).strict()
export const evento = z.object({ tipo: txt(30), data, descricao: txt(1000).default(''), documento: txt(150).default(''), entidade: txt(150).default(''), pena: txt(300).default('') }).strict()
export const fimGraduacao = z.object({ fim: data, motivo: txt(500).default('') })

const item = z.object({ pessoaId: id, postoProposto: opc(30), modalidade: opc(20), cargoId: idOpc, inicio: dataOpc, fim: dataOpc, justificacao: txt(1000).default('') }).strict()
export const itemProposta = item
export const proposta = z.object({ tipo: z.enum(['promocao', 'graduacao', 'nomeacao', 'exoneracao', 'progressao', 'curso']), titulo: txt(200, 3), fundamentacao: txt(4000).default(''), curso: txt(200).default(''), itens: z.array(item).max(300).default([]) }).strict()
export const editarProposta = z.object({ titulo: txt(200, 3).optional(), fundamentacao: txt(4000).optional(), curso: txt(200).optional() }).strict()
export const despacho = z.object({ documento: txt(150, 2), dataDocumento: data, entidade: txt(150).default('') }).strict()
export const motivo = z.object({ motivo: txt(1000).default('') })
export const motivoObrigatorio = z.object({ motivo: txt(1000, 3) })

export const licenca = z.object({ pessoaId: id, tipo: txt(30), inicio: data, fim: data, despacho: txt(150).default(''), observacoes: txt(1000).default('') }).strict()
export const unidade = z.object({ nome: txt(150, 2), sigla: txt(20).default(''), tipo: txt(20).default('outro'), paiId: idOpc, ordem: z.coerce.number().int().min(0).max(999).default(0) }).strict()
export const cargo = z.object({ nome: txt(150, 2), unidadeId: idOpc, funcao: txt(20).default('execucao'), tipo: z.enum(['militar', 'civil', 'ambos']).default('militar'), postoRequerido: z.union([txt(30), z.null()]).optional(), categoriaCivil: z.union([txt(80), z.null()]).optional(), vagas: z.coerce.number().int().min(1).max(500).default(1) }).strict()

export const importarQuadro = z.object({ simular: z.boolean().default(true), linhas: z.array(z.record(z.string(), z.union([z.string().max(300), z.number(), z.null()]))).min(1).max(3000) }).strict()
export const importar = z.object({ modo: z.enum(['novos', 'actualizar']), simular: z.boolean().default(true), verificarBi: z.boolean().default(false), linhas: z.array(z.record(z.string(), z.union([z.string().max(500), z.number(), z.null()]))).min(1).max(3000) })
export const processo = z.object({ estante: txt(30).default(''), prateleira: txt(30).default(''), posicao: txt(30).default(''), estado: txt(20).default('activo'), observacoes: txt(1000).default('') }).strict()
export const documentoPessoal = z.object({ tipo: txt(30), titulo: txt(200).default(''), data: dataOpc })
export const extracto = z.object({ tipo: txt(20), numero: txt(80, 1), data, entidade: txt(150).default(''), propostaId: z.union([z.coerce.number().int().positive(), z.literal(''), z.null()]).optional().transform((v) => (v === '' ? null : v ?? null)), texto: z.string().max(500_000).default('') })
export const itemExtracto = z.object({ pessoaId: id, postoNovo: z.union([txt(30), z.null()]).optional(), cargoId: idOpc })
export const editarItemExtracto = z.object({ postoNovo: z.union([txt(30), z.literal(''), z.null()]).optional(), cargoId: idOpc }).strict()
export const indeferir = z.object({ motivo: txt(1000, 3), documento: txt(150).default(''), dataDocumento: dataOpc })
export const enviarProposta = z.object({ documento: txt(150).default('') })
export const contasPessoas = z.object({ pessoaIds: z.array(id).max(5000).optional() })
export const expediente = z.object({
  sentido: z.enum(['interno', 'entrada', 'saida']).default('interno'), tipo: txt(30).default('oficio'), numero: txt(80).default(''), assunto: txt(300, 3), resumo: txt(4000).default(''),
  classificacao: z.enum(['normal', 'urgente', 'confidencial']).default('normal'), entidadeExterna: txt(200).default(''), temFisico: z.boolean().default(false), prazo: dataOpc,
  destinos: z.array(id).max(50).default([]), nota: txt(1000).default(''), portador: txt(150).default(''),
})
export const encaminhar = z.object({ destinos: z.array(id).min(1).max(50), nota: txt(1000).default(''), fisico: z.boolean().default(false), portador: txt(150).default('') })
export const entregue = z.object({ portador: txt(150).default('') })
export const grupo = z.object({ nome: txt(100, 2), membros: z.array(id).min(2).max(500) })
