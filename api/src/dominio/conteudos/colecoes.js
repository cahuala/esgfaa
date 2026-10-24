import { z } from 'zod'
import { ErroValidacao } from '../comum/erros.js'
import { validarUrls } from '../comum/urls.js'
import { verificarEstrutura } from '../comum/estrutura.js'

const porDataDesc = (a, b) => (b.data || '').localeCompare(a.data || '')
const porDataAsc = (a, b) => (a.data || '').localeCompare(b.data || '')

const texto = (max) => z.string().max(max, `Texto demasiado longo (máximo ${max} caracteres).`)
const data = z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use AAAA-MM-DD).')])
const hora = z.union([z.literal(''), z.string().regex(/^\d{2}:\d{2}$/, 'Hora inválida (use HH:MM).')])
// vídeos curtos das actividades realizadas (como os estados do WhatsApp): o vídeo carregado, a capa e a legenda
const videosCurtos = z.array(z.looseObject({ src: texto(2000), poster: texto(2000).optional(), legenda: texto(300).optional() })).max(20, 'No máximo 20 vídeos curtos.')
const blocos = z.array(z.record(z.string(), z.unknown())).max(400, 'O conteúdo tem demasiados elementos.')

// campos comuns aceites com o tipo indicado; outros campos passam (o painel é dono do formato)
const ESQUEMAS = {
  noticias: z.looseObject({
    titulo: texto(300), categoria: texto(80).optional(), data: data.optional(), autor: texto(120).optional(),
    resumo: texto(1000).optional(), capa: texto(2000).optional(), destaque: z.boolean().optional(), conteudo: blocos.optional(),
    videosCurtos: videosCurtos.optional(),
  }),
  artigos: z.looseObject({
    titulo: texto(300), tipo: texto(80).optional(), area: texto(80).optional(), autor: texto(80).optional(), data: data.optional(),
    resumo: texto(3000).optional(), palavrasChave: z.array(texto(60)).max(20).optional(), conteudo: blocos.optional(),
  }),
  eventos: z.looseObject({
    titulo: texto(300), categoria: texto(80).optional(), data: data.optional(), horaInicio: hora.optional(), horaFim: hora.optional(),
    local: texto(200).optional(), resumo: texto(1000).optional(), inscricoes: z.boolean().optional(), conteudo: blocos.optional(),
    programa: z.array(z.looseObject({ hora: hora.optional(), atividade: texto(300).optional() })).max(60).optional(),
    videosCurtos: videosCurtos.optional(),
  }),
  cursos: z.looseObject({
    nome: texto(200), sigla: texto(20).optional(), resumo: texto(1000).optional(), duracao: texto(60).optional(),
    vagas: z.union([texto(20), z.number()]).optional(), coordenador: texto(80).optional(),
  }),
  pessoas: z.looseObject({
    nome: texto(150), cargo: texto(150).optional(), destaque: texto(600).optional(),
  }),
  // números da revista da Escola: um PDF que qualquer visitante lê no site
  revistas: z.looseObject({
    titulo: texto(300), numero: texto(40).optional(), data: data.optional(), resumo: texto(2000).optional(),
    capa: texto(2000).optional(), pdf: texto(2000).optional(), destaque: z.boolean().optional(),
    sumario: z.array(z.looseObject({ titulo: texto(300).optional(), autor: texto(200).optional(), pagina: z.union([texto(10), z.number()]).optional() })).max(80).optional(),
  }),
  publicidade: z.looseObject({
    titulo: texto(200), anunciante: texto(120).optional(), tipo: z.enum(['composto', 'imagem']).optional(),
    texto: texto(400).optional(), botao: texto(40).optional(), ligacao: texto(2000).optional(),
    posicao: z.enum(['home-topo', 'home-meio', 'noticias-lateral', 'noticia-fim', 'rodape']).optional(),
    inicio: data.optional(), fim: data.optional(), ativo: z.boolean().optional(),
  }),
}

/*
  Coleções editáveis:
  chave: campo que identifica o item no endereço do site; titulo: campo do título;
  interativa: aceita gostos/comentários/visualizações; ordenavel: ordem manual no painel.
*/
export const COLECOES = {
  noticias: { chave: 'slug', titulo: 'titulo', ordenar: porDataDesc, interativa: true },
  artigos: { chave: 'slug', titulo: 'titulo', ordenar: porDataDesc, interativa: true },
  eventos: { chave: 'id', titulo: 'titulo', ordenar: porDataAsc, interativa: true },
  cursos: { chave: 'id', titulo: 'nome', ordenar: null, ordenavel: true },
  pessoas: { chave: 'id', titulo: 'nome', ordenar: null, ordenavel: true },
  revistas: { chave: 'slug', titulo: 'titulo', ordenar: porDataDesc },
  publicidade: { chave: 'id', titulo: 'titulo', ordenar: null, ordenavel: true },
}

export const NOMES_COLECOES = Object.keys(COLECOES)
export const INTERATIVAS = NOMES_COLECOES.filter((c) => COLECOES[c].interativa)
export const TAMANHO_MAXIMO_DADOS = 1_000_000

export function definicao(colecao) {
  const def = COLECOES[colecao]
  if (!def) throw new ErroValidacao('Coleção desconhecida.')
  return def
}

// valida os dados de um item; devolve os dados sem campos internos (começados por _)
export function validarDados(colecao, dados) {
  const def = definicao(colecao)
  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) throw new ErroValidacao('Dados inválidos.')
  verificarEstrutura(dados)
  const limpos = Object.fromEntries(Object.entries(dados).filter(([k]) => !k.startsWith('_')))
  const titulo = limpos[def.titulo]
  if (typeof titulo !== 'string' || !titulo.trim()) throw new ErroValidacao('O título é obrigatório.')
  const r = ESQUEMAS[colecao].safeParse(limpos)
  if (!r.success) {
    const p = r.error.issues[0]
    throw new ErroValidacao(`${p.path.join('.') || 'dados'}: ${p.message}`)
  }
  if (JSON.stringify(limpos).length > TAMANHO_MAXIMO_DADOS) throw new ErroValidacao('O conteúdo é demasiado grande.')
  validarUrls(limpos)
  return limpos
}
