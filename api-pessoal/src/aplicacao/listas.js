import { invalido, naoEncontrado } from '../erros.js'
import { exigir } from './sessao.js'
import { CATEGORIAS_DOCENTE, CATEGORIAS_DOCENTE_CONTRATADO, ESTADOS_CIVIS, GENEROS, HABILITACOES, MOTIVOS_SAIDA, PROVINCIAS, TIPOS, TIPOS_DOCENTE, VINCULOS } from '../dominio/pessoal/ficha.js'
import { ABREVIATURAS, ARVORE_SITUACOES, CATEGORIAS, EFECTIVIDADES, ESTADOS, FORMAS_SERVICO, FUNCOES, GRUPOS, POSTOS, QUADROS_ESPECIAIS, RAMOS, SITUACOES, postosDoRamo } from '../dominio/pessoal/hierarquia.js'
import { CARREIRAS_CIVIS, VINCULOS_CIVIS } from '../dominio/pessoal/civis.js'
import { CURSOS_PROMOCAO, MODALIDADES, TIPOS_LICENCA } from '../dominio/pessoal/carreira.js'
import { NOMES_LICENCA } from './licencas.js'
import { TIPOS_AUSENCIA } from './ausencias.js'
import { ESTADOS_PROPOSTA, TIPOS_PROPOSTA } from './propostas.js'
import { TIPOS_EVENTO } from './pessoas.js'
import { ESTADOS_PROCESSO } from './processos.js'
import { TIPOS_EXTRACTO } from './extractos.js'
import { CLASSIFICACOES, DECISOES_DESPACHO, SENTIDOS } from './expediente.js'
import { TIPOS_DOCUMENTO } from './processos.js'
import { TIPOS_EXPEDIENTE } from './expediente.js'
import { TIPOS_UNIDADE } from './organica.js'

// bancos angolanos (sigla → nome); as cores dos cartões ficam no navegador
export const BANCOS = {
  BAI: 'Banco Angolano de Investimentos', BPC: 'Banco de Poupança e Crédito', BFA: 'Banco de Fomento Angola', BIC: 'Banco BIC',
  BNI: 'Banco de Negócios Internacional', ATL: 'Banco Millennium Atlântico', BCI: 'Banco de Comércio e Indústria', BSOL: 'Banco Sol',
  KEVE: 'Banco Keve', SBA: 'Standard Bank Angola', BCGA: 'Banco Caixa Geral Angola', BE: 'Banco Económico', BYETU: 'Banco Yetu',
}

// especialidades dos militares (por extenso); a Repartição acrescenta as que faltarem em Configurações › Listas do sistema
export const ESPECIALIDADES = [
  'Infantaria', 'Infantaria Motorizada', 'Artilharia', 'Tropas Blindadas', 'Defesa Antiaérea', 'Engenharia Militar', 'Telecomunicações',
  'Engenharia de Telecomunicações', 'Engenharia Informática', 'Criptologia', 'Inteligência Militar', 'Reconhecimento e Informação', 'Polícia Militar',
  'Justiça Militar', 'Logística', 'Logística Geral', 'Serviços de Saúde', 'Serviços Técnicos', 'Serviços de Material', 'Armamento e Técnica',
  'Aviação', 'Motor e Fuselagem', 'Defesa Nuclear, Biológica e Química', 'Topografia', 'Condutor Auto', 'Educação Patriótica', 'Comando',
  'Contra-Inteligência Militar (CIM)',
]

// listas que estavam só no navegador
export const PARENTESCOS = ['Cônjuge', 'Filho(a)', 'Pai', 'Mãe', 'Irmão/Irmã', 'Neto(a)', 'Outro']
export const CONDECORACOES = ['Medalha de Mérito Militar', 'Medalha de Serviço Distinto', 'Medalha Militar dos Serviços Distintos', 'Medalha de Bons Serviços', 'Medalha de Comportamento Exemplar', 'Medalha de Antiguidade', 'Medalha Militar do Tempo de Serviço', 'Medalha Militar Comemorativa das Forças Armadas Angolanas', 'Medalha Comemorativa de Aniversário das Forças Armadas Angolanas', 'Medalha Comemorativa de Evento Especial']
export const TIPOS_CURSO = { formacao: 'Formação', promocao: 'Promoção', qualificacao: 'Qualificação', actualizacao: 'Actualização', academico: 'Académico' }
export const NIVEIS_AVALIACAO = { MB: 'Muito bem', B: 'Bem', R: 'Razoável' }

/*
  Listas que vêm da lei ou que o sistema usa com regras: só se lhes muda o NOME (não se acrescentam nem se tiram,
  e a ordem fica a da lei). O nome novo passa a valer em todo o sistema (formulários, listas e documentos).
  alvos: onde o nome está guardado ([objecto, campo] ou [objecto] quando o valor é o próprio nome).
*/
const nomes = (grupo, nome, alvos, extra = {}) => ({ grupo, nome, tipo: 'nomes', alvos, ...extra })
const textoDe = (o, campo, k) => (campo ? o[k]?.[campo] : o[k])
// os postos de cada ramo (o mesmo posto tem nomes diferentes na Marinha)
const postosDe = (ramo) => ({
  chaves: () => postosDoRamo(ramo).map((p) => p.id),
  ler: (k) => POSTOS[k].nomes[ramo],
  escrever: (k, v) => {
    const antes = POSTOS[k].nomes[ramo]
    if (antes === v) return
    // a abreviatura acompanha o nome novo (Cor., Ten.-Gen.…)
    if (ABREVIATURAS[antes] && !ABREVIATURAS[v]) ABREVIATURAS[v] = ABREVIATURAS[antes]
    POSTOS[k].nomes[ramo] = v
  },
})
const quadrosDe = (ramo) => ({
  chaves: () => QUADROS_ESPECIAIS[ramo].map((q) => q.sigla),
  ler: (k) => QUADROS_ESPECIAIS[ramo].find((q) => q.sigla === k).nome,
  escrever: (k, v) => { QUADROS_ESPECIAIS[ramo].find((q) => q.sigla === k).nome = v },
})
// a árvore das situações tem cópias dos nomes
function sincronizarArvore() {
  for (const raiz of ARVORE_SITUACOES) {
    if (SITUACOES[raiz.id]) raiz.nome = SITUACOES[raiz.id]
    for (const g of raiz.filhos) for (const f of g.filhos) if (EFECTIVIDADES[f.id]) f.nome = EFECTIVIDADES[f.id].nome
  }
}

export const LISTAS_NOMES = {
  ramos: nomes('Militares (lei)', 'Ramos', [[RAMOS, 'nome']]),
  ...Object.fromEntries(Object.keys(RAMOS).map((r) => [`postos_${r}`, nomes('Militares (lei)', `Postos — ${RAMOS[r].nome}`, null, { fonte: 'Lei n.º 13/18', especial: postosDe(r) })])),
  categorias: nomes('Militares (lei)', 'Categorias dos postos', [[CATEGORIAS, 'nome']]),
  grupos: nomes('Militares (lei)', 'Grupos (oficiais, sargentos, praças)', [[GRUPOS]]),
  formasServico: nomes('Militares (lei)', 'Formas de prestação de serviço', [[FORMAS_SERVICO, 'nome']], { rotuloChave: 'Sigla' }),
  situacoes: nomes('Militares (lei)', 'Situações', [[SITUACOES]], { depois: sincronizarArvore }),
  efectividades: nomes('Militares (lei)', 'Efectividade (no activo)', [[EFECTIVIDADES, 'nome']], { depois: sincronizarArvore }),
  estados: nomes('Militares (lei)', 'Estados (destacado, em missão…)', [[ESTADOS]]),
  funcoes: nomes('Militares (lei)', 'Funções dos cargos', [[FUNCOES]]),
  ...Object.fromEntries(['EMG', ...Object.keys(RAMOS)].map((r) => [`quadros_${r}`, nomes('Militares (lei)', `Quadros especiais — ${r === 'EMG' ? 'comuns aos três ramos' : RAMOS[r].nome}`, null, { rotuloChave: 'Sigla', especial: quadrosDe(r) })])),
  modalidades: nomes('Carreira (lei)', 'Modalidades de promoção', [[MODALIDADES]]),
  cursosPromocao: nomes('Carreira (lei)', 'Cursos de promoção', [[CURSOS_PROMOCAO]]),
  tiposLicenca: nomes('Carreira (lei)', 'Tipos de licença', [[TIPOS_LICENCA, 'nome'], [NOMES_LICENCA]], { extraChaves: ['sem_vencimento'] }),
  tiposAusencia: nomes('Carreira (lei)', 'Tipos de ausência', [[TIPOS_AUSENCIA]]),
  tiposProposta: nomes('Propostas e extractos', 'Tipos de proposta', [[TIPOS_PROPOSTA, 'nome']]),
  estadosProposta: nomes('Propostas e extractos', 'Estados da proposta', [[ESTADOS_PROPOSTA]]),
  tiposExtracto: nomes('Propostas e extractos', 'Tipos de extracto', [[TIPOS_EXTRACTO]]),
  tiposEvento: nomes('Ficha individual', 'Tipos de registo no histórico', [[TIPOS_EVENTO]]),
  tipos: nomes('Ficha individual', 'Tipo (militar, civil)', [[TIPOS]]),
  vinculos: nomes('Ficha individual', 'Vínculos (docente, estudante, efectivo…)', [[VINCULOS]]),
  generos: nomes('Ficha individual', 'Géneros', [[GENEROS]]),
  tiposDocente: nomes('Docentes', 'Tipo de docente', [[TIPOS_DOCENTE]]),
  carreirasCivis: nomes('Civis', 'Carreiras dos civis', [[CARREIRAS_CIVIS, 'nome']]),
  vinculosCivis: nomes('Civis', 'Vínculo dos civis', [[VINCULOS_CIVIS]]),
  estadosProcesso: nomes('Processo individual', 'Estados do processo', [[ESTADOS_PROCESSO]]),
  classificacoes: nomes('Expediente', 'Classificação do expediente', [[CLASSIFICACOES]]),
  sentidos: nomes('Expediente', 'Sentido do expediente', [[SENTIDOS]]),
  decisoesDespacho: nomes('Expediente', 'Decisões do despacho', [[DECISOES_DESPACHO]]),
}
// as chaves e os nomes de origem (antes de qualquer mudança)
const chavesDe = (l) => (l.especial ? l.especial.chaves() : [...new Set([...Object.keys(l.alvos[0][0]), ...(l.extraChaves ?? [])])])
const lerNome = (l, k) => (l.especial ? l.especial.ler(k) : (l.alvos.map(([o, c]) => textoDe(o, c, k)).find((v) => typeof v === 'string') ?? ''))
for (const l of Object.values(LISTAS_NOMES)) l.padrao = Object.fromEntries(chavesDe(l).map((k) => [k, lerNome(l, k)]))
function aplicarNomes(l, valor) {
  for (const [k, original] of Object.entries(l.padrao)) {
    const v = valor?.[k] ?? original
    if (l.especial) l.especial.escrever(k, v)
    else for (const [o, c] of l.alvos) { if (!(k in o)) continue; if (c) o[k][c] = v; else o[k] = v }
  }
  l.depois?.()
}

/*
  Listas do sistema que a Repartição muda em Configurações (o que vem da lei com regras — postos, ramos,
  formas de prestação de serviço, situações, licenças — fica no código).
  Listas de texto: o que se escolhe fica escrito na ficha, por isso tirar uma entrada não estraga nada.
  Listas com chave (chaves: true): a ficha guarda a chave; as que vêm de origem mudam de nome mas não se tiram.
*/
export const LISTAS = {
  categoriasDocente: { grupo: 'Docentes', nome: 'Categorias do docente — carreira', fonte: 'Decreto Presidencial n.º 191/18, art. 4.º', padrao: CATEGORIAS_DOCENTE },
  categoriasDocenteContratado: { grupo: 'Docentes', nome: 'Categorias do docente — especialmente contratado', fonte: 'Decreto Presidencial n.º 191/18, art. 5.º', padrao: CATEGORIAS_DOCENTE_CONTRATADO },
  provincias: { grupo: 'Ficha individual', nome: 'Províncias', padrao: PROVINCIAS },
  especialidades: { grupo: 'Ficha individual', nome: 'Especialidades (militares)', padrao: ESPECIALIDADES },
  habilitacoes: { grupo: 'Ficha individual', nome: 'Habilitações literárias', chaves: true, padrao: { ...HABILITACOES }, alvo: HABILITACOES },
  estadosCivis: { grupo: 'Ficha individual', nome: 'Estados civis', chaves: true, padrao: { ...ESTADOS_CIVIS }, alvo: ESTADOS_CIVIS },
  parentescos: { grupo: 'Ficha individual', nome: 'Parentescos (agregado familiar)', padrao: PARENTESCOS },
  condecoracoes: { grupo: 'Ficha individual', nome: 'Condecorações', padrao: CONDECORACOES },
  tiposCurso: { grupo: 'Ficha individual', nome: 'Tipos de curso', chaves: true, padrao: TIPOS_CURSO },
  niveisAvaliacao: { grupo: 'Ficha individual', nome: 'Níveis da avaliação (registo biográfico)', chaves: true, padrao: NIVEIS_AVALIACAO },
  motivosSaida: { grupo: 'Ficha individual', nome: 'Motivos de saída da Escola', padrao: MOTIVOS_SAIDA },
  bancos: { grupo: 'Ficha individual', nome: 'Bancos', chaves: true, rotuloChave: 'Sigla', padrao: BANCOS },
  tiposDocumento: { grupo: 'Processo individual', nome: 'Tipos de documento do processo', chaves: true, padrao: TIPOS_DOCUMENTO },
  tiposExpediente: { grupo: 'Expediente', nome: 'Tipos de expediente', chaves: true, padrao: TIPOS_EXPEDIENTE },
  tiposUnidade: { grupo: 'Orgânica', nome: 'Tipos de unidade', chaves: true, padrao: TIPOS_UNIDADE },
}

const CHAVE = 'listas'
const CHAVE_VALIDA = /^[A-Za-z0-9_]{1,30}$/
const igual = (a, b) => a.localeCompare(b, 'pt', { sensitivity: 'base' }) === 0

export class ServicoListas {
  constructor({ bd, auditoria }) {
    Object.assign(this, { bd, auditoria })
    this.cache = null
  }

  // as listas em uso (as mudadas por cima das de origem); guardadas em memória até alguém mudar
  async todas() {
    if (!this.cache) {
      const d = await this.bd.definicao.findUnique({ where: { chave: CHAVE } })
      const mudadas = d?.valor ?? {}
      this.cache = Object.fromEntries(Object.entries(LISTAS).map(([k, l]) => [k, mudadas[k] ?? l.padrao]))
      // as de chave guardadas no sistema (habilitações, estados civis): os documentos e as listas usam o nome novo
      for (const [k, l] of Object.entries(LISTAS)) if (l.alvo) { for (const c of Object.keys(l.alvo)) if (!(c in this.cache[k])) delete l.alvo[c]; Object.assign(l.alvo, this.cache[k]) }
      // os nomes das listas da lei passam a valer em todo o sistema
      const nomesMudados = d?.valor?.__nomes ?? {}
      for (const [k, l] of Object.entries(LISTAS_NOMES)) aplicarNomes(l, nomesMudados[k])
      this.nomes = nomesMudados
    }
    return this.cache
  }

  async listar(u) {
    exigir(u, 'ver')
    const atuais = await this.todas()
    const proprias = Object.entries(LISTAS).map(([id, l]) => ({
      id, grupo: l.grupo, nome: l.nome, fonte: l.fonte ?? '', chaves: Boolean(l.chaves), rotuloChave: l.rotuloChave ?? 'Código',
      valor: atuais[id], fixas: l.chaves ? Object.keys(l.padrao) : [], mudada: JSON.stringify(atuais[id]) !== JSON.stringify(l.padrao),
    }))
    const daLei = Object.entries(LISTAS_NOMES).map(([id, l]) => {
      const valor = Object.fromEntries(Object.keys(l.padrao).map((k) => [k, lerNome(l, k)]))
      return { id, grupo: l.grupo, nome: l.nome, fonte: l.fonte ?? '', chaves: true, soNomes: true, rotuloChave: l.rotuloChave ?? 'Código', valor, fixas: Object.keys(l.padrao), mudada: JSON.stringify(valor) !== JSON.stringify(l.padrao) }
    })
    return [...proprias, ...daLei]
  }

  async guardar(u, id, valor) {
    exigir(u, 'administrar')
    if (LISTAS_NOMES[id]) return this.#guardarNomes(u, id, valor)
    const l = LISTAS[id]
    if (!l) throw naoEncontrado('Lista desconhecida.')
    const limpo = l.chaves ? validarComChave(l, valor) : validarTexto(valor)
    await this.#gravar((m) => ({ ...m, [id]: limpo }))
    await this.auditoria.registar(u, 'mudar_lista', l.nome)
    return (await this.listar(u)).find((x) => x.id === id)
  }

  // só os nomes (as chaves e a ordem são as da lei)
  async #guardarNomes(u, id, valor) {
    const l = LISTAS_NOMES[id]
    if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw invalido('A lista deve ter código e nome.', 'valor')
    const limpo = {}
    for (const k of Object.keys(l.padrao)) {
      const nome = String(valor[k] ?? '').trim().replace(/\s+/g, ' ')
      if (!nome) throw invalido(`Falta o nome de «${l.padrao[k]}».`, 'valor')
      if (nome.length > 120) throw invalido(`O nome de «${l.padrao[k]}» é demasiado comprido (até 120 letras).`, 'valor')
      if (Object.values(limpo).some((x) => igual(x, nome))) throw invalido(`«${nome}» está repetido.`, 'valor')
      if (nome !== l.padrao[k]) limpo[k] = nome
    }
    if (Object.keys(valor).some((k) => !(k in l.padrao))) throw invalido('Esta lista vem da lei: só se muda o nome (não se acrescentam entradas).', 'valor')
    await this.#gravar((m) => { const n = { ...(m.__nomes ?? {}) }; if (Object.keys(limpo).length) n[id] = limpo; else delete n[id]; return { ...m, __nomes: n } })
    await this.auditoria.registar(u, 'mudar_lista', l.nome)
    return (await this.listar(u)).find((x) => x.id === id)
  }

  // volta à lista de origem
  async repor(u, id) {
    exigir(u, 'administrar')
    if (LISTAS_NOMES[id]) {
      await this.#gravar((m) => { const n = { ...(m.__nomes ?? {}) }; delete n[id]; return { ...m, __nomes: n } })
      await this.auditoria.registar(u, 'repor_lista', LISTAS_NOMES[id].nome)
      return (await this.listar(u)).find((x) => x.id === id)
    }
    const l = LISTAS[id]
    if (!l) throw naoEncontrado('Lista desconhecida.')
    await this.#gravar((m) => { const n = { ...m }; delete n[id]; return n })
    await this.auditoria.registar(u, 'repor_lista', l.nome)
    return (await this.listar(u)).find((x) => x.id === id)
  }

  async #gravar(mudar) {
    const d = await this.bd.definicao.findUnique({ where: { chave: CHAVE } })
    const valor = mudar(d?.valor ?? {})
    await this.bd.definicao.upsert({ where: { chave: CHAVE }, create: { chave: CHAVE, valor }, update: { valor } })
    this.cache = null
  }
}

function validarTexto(valor) {
  if (!Array.isArray(valor)) throw invalido('A lista deve ser uma lista de nomes.', 'valor')
  const l = []
  for (const v of valor) {
    const t = String(v ?? '').trim().replace(/\s+/g, ' ')
    if (!t) continue
    if (t.length > 120) throw invalido(`«${t.slice(0, 40)}…» é demasiado comprido (até 120 letras).`, 'valor')
    if (l.some((x) => igual(x, t))) throw invalido(`«${t}» está repetido.`, 'valor')
    l.push(t)
  }
  if (!l.length) throw invalido('A lista não pode ficar vazia.', 'valor')
  if (l.length > 300) throw invalido('A lista tem entradas a mais (até 300).', 'valor')
  return l
}

function validarComChave(lista, valor) {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw invalido('A lista deve ter código e nome.', 'valor')
  const r = {}
  for (const [k, v] of Object.entries(valor)) {
    const chave = String(k).trim()
    const nome = String(v ?? '').trim().replace(/\s+/g, ' ')
    if (!CHAVE_VALIDA.test(chave)) throw invalido(`O código «${chave}» só pode ter letras sem acentos, algarismos e _ (até 30).`, 'valor')
    if (!nome) throw invalido(`Falta o nome de «${chave}».`, 'valor')
    if (nome.length > 120) throw invalido(`O nome de «${chave}» é demasiado comprido (até 120 letras).`, 'valor')
    if (Object.keys(r).some((x) => x.toLowerCase() === chave.toLowerCase())) throw invalido(`O código «${chave}» está repetido.`, 'valor')
    if (Object.values(r).some((x) => igual(x, nome))) throw invalido(`«${nome}» está repetido.`, 'valor')
    r[chave] = nome
  }
  // as de origem (a ficha e o sistema guardam o código) não se tiram
  const falta = Object.keys(lista.padrao).filter((k) => !(k in r))
  if (falta.length) throw invalido(`Estas não se podem tirar (o sistema usa-as): ${falta.map((k) => lista.padrao[k]).join(', ')}. Pode mudar-lhes o nome.`, 'valor')
  if (Object.keys(r).length > 300) throw invalido('A lista tem entradas a mais (até 300).', 'valor')
  return r
}
