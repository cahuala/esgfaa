import { CATEGORIAS, ESTADOS, FORMAS_SERVICO, POSTOS, RAMOS, SITUACOES, EFECTIVIDADES, abreviaturaDoPosto, caminhoDaSituacao, existeNoRamo, grupoDoPosto, nomeDoPosto, quadroEspecial } from './hierarquia.js'
import { idade, proximoPosto, reservaEReforma, tempoNoPosto, tempoServico, verificarPromocao } from './carreira.js'
import { CARREIRAS_CIVIS, VINCULOS_CIVIS, remuneracaoDaCategoria, verificarProgressaoCivil } from './civis.js'
import { vencimentoDoPosto } from './tabelaSalarial.js'

export const TIPOS = { militar: 'Militar', civil: 'Civil' }
// a função principal e as outras (sem repetir); a domiciliar não acumula
export const vinculosDe = (p) => (p.vinculo === 'domiciliar' ? ['domiciliar'] : [...new Set([p.vinculo, ...(p.outrosVinculos ?? [])].filter(Boolean))])
export const VINCULOS = { docente: 'Docente', estudante: 'Estudante', funcionario: 'Funcionário', domiciliar: 'Empregada(o) domiciliar' }
// do mais baixo ao mais alto, com os níveis do Mod. 5/DPQ («base» fica para as fichas antigas, sem o pormenor)
export const HABILITACOES = { sem_instrucao: 'Sem instrução', primaria: 'Primária', primeiro_ciclo: '1.º Ciclo', base: 'Ensino de base', segundo_ciclo: '2.º Ciclo', medio: 'Técnico médio', bacharelato: 'Bacharelato', licenciatura: 'Licenciatura', pos_graduacao: 'Pós-graduação', mestrado: 'Mestrado', doutoramento: 'Doutoramento' }
export const TIPOS_DOCENTE = { efectivo: 'Efectivo', colaborador: 'Colaborador' }
export const CATEGORIAS_DOCENTE = ['Assistente estagiário', 'Assistente', 'Professor auxiliar', 'Professor associado', 'Professor catedrático', 'Instrutor', 'Formador']
export const GENEROS = { M: 'Masculino', F: 'Feminino' }
// motivos de saída da Escola (o texto é o que fica na ficha; «Outro» escreve-se à mão). Os mapas de ausências
// contam por eles os transferidos, os mortos e os condenados.
export const MOTIVOS_SAIDA = ['Transferência', 'Fim do curso', 'Passagem à reserva', 'Passagem à reforma', 'Exoneração', 'Fim do contrato', 'Rescisão por iniciativa do funcionário', 'Falecimento', 'Condenação', 'Deserção']
export const ESTADOS_CIVIS = { solteiro: 'Solteiro(a)', casado: 'Casado(a)', uniao_facto: 'União de facto', divorciado: 'Divorciado(a)', viuvo: 'Viúvo(a)' }
export const PROVINCIAS = ['Bengo', 'Benguela', 'Bié', 'Cabinda', 'Cuando', 'Cubango', 'Cuanza Norte', 'Cuanza Sul', 'Cunene', 'Huambo', 'Huíla', 'Icolo e Bengo', 'Luanda', 'Lunda Norte', 'Lunda Sul', 'Malanje', 'Moxico', 'Moxico Leste', 'Namibe', 'Uíge', 'Zaire']

// agregado familiar guardado como JSON (texto cifrado)
function lerRegisto(v) {
  if (v && typeof v === 'object') return v
  try {
    return v ? JSON.parse(v) : {}
  } catch {
    return {}
  }
}
function lerAgregado(v) {
  if (Array.isArray(v)) return v
  try {
    return v ? JSON.parse(v) : []
  } catch {
    return []
  }
}

const dia = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null)
const arred = (n) => (n === null || n === undefined ? null : Math.floor(n * 10) / 10)

// datas como "AAAA-MM-DD" para o navegador
const DATAS = ['dataNascimento', 'dataEntradaEscola', 'dataSaidaEscola', 'dataCargo', 'dataIngresso', 'dataIngressoQP', 'dataAntiguidadePosto', 'dataSituacao', 'dataAdmissao', 'dataCategoria', 'biEmitidoEm', 'biValidade']

/*
  Ficha com os campos calculados: nome do posto no ramo, categoria, idades e tempos, e a situação
  na carreira (próximo posto, se está em condições de ser promovido, quando passa à reserva).
*/
export function comDerivados(p, hoje = new Date()) {
  const f = { ...p }
  for (const k of DATAS) f[k] = dia(p[k])
  f.idade = idade(p, hoje)
  f.agregado = lerAgregado(p.agregado)
  f.registo = lerRegisto(p.registo)
  f.vencimento = p.vencimento ? Number(p.vencimento) : null
  f.unidadeNome = p.unidade?.nome ?? ''
  f.cargoNome = p.cargo?.nome ?? ''
  // a função do cargo (comando, direcção/chefia, estado-maior, execução): conta para a ordem hierárquica
  f.funcao = p.cargo?.funcao ?? null
  // o posto que o cargo exige (para encontrar quem está num cargo de posto acima do seu)
  f.cargoPostoRequerido = p.cargo?.postoRequerido ?? null
  if (p.tipo === 'militar') {
    const posto = POSTOS[p.posto]
    f.postoNome = nomeDoPosto(p.posto, p.ramo)
    f.postoAbreviatura = abreviaturaDoPosto(p.posto, p.ramo)
    f.grau = posto?.grau ?? 0
    f.categoria = posto?.categoria ?? null
    f.categoriaNome = CATEGORIAS[posto?.categoria]?.nome ?? ''
    f.grupo = grupoDoPosto(p.posto)
    f.ramoNome = RAMOS[p.ramo]?.nome ?? ''
    f.fpsNome = FORMAS_SERVICO[p.fps]?.nome ?? ''
    f.situacaoNome = SITUACOES[p.situacao] ?? ''
    f.efectividadeNome = p.situacao === 'activo' ? EFECTIVIDADES[p.efectividade]?.nome ?? '' : ''
    const cs = caminhoDaSituacao(p.situacao, p.efectividade)
    f.situacaoCaminho = cs.caminho.join(' › ')
    f.situacaoArtigo = cs.artigo
    f.efectivo = p.situacao === 'activo' && EFECTIVIDADES[p.efectividade]?.efectividade !== false
    f.estadoNome = ESTADOS[p.estado] ?? ''
    f.quadroNome = quadroEspecial(p.ramo, p.quadroEspecial)?.nome ?? ''
    f.tempoServico = arred(tempoServico(p, hoje))
    f.tempoNoPosto = arred(tempoNoPosto(p, hoje))
    f.proximoPosto = proximoPosto(p)
    f.proximoPostoNome = f.proximoPosto ? nomeDoPosto(f.proximoPosto, p.ramo) : ''
    // com cursos e histórico só quando vem da ficha completa; na lista conta-se o que há
    const promo = f.proximoPosto ? verificarPromocao({ ...p, cursos: p.cursos ?? [], historico: p.eventos ?? [] }, { hoje }) : null
    f.elegivelPromocao = Boolean(promo?.elegivel)
    const rr = reservaEReforma(p, hoje)
    f.dataReserva = p.situacao === 'activo' ? rr?.reserva?.data ?? null : null
    f.dataReforma = p.situacao !== 'reforma' ? rr?.reforma?.data ?? null : null
    f.descricao = [f.postoAbreviatura, f.ramo].filter(Boolean).join(' · ')
    f.vencimentoTabela = vencimentoDoPosto(p.posto, p.fps)
  } else {
    f.carreiraNome = CARREIRAS_CIVIS[p.carreiraCivil]?.nome ?? ''
    f.nivelCategoria = CARREIRAS_CIVIS[p.carreiraCivil]?.nivel ?? null
    f.remuneracao = remuneracaoDaCategoria(p.carreiraCivil)
    f.vinculoCivilNome = VINCULOS_CIVIS[p.vinculoCivil] ?? ''
    f.tempoServico = arred(p.dataAdmissao ? (hoje - new Date(p.dataAdmissao)) / (365.2425 * 86_400_000) : null)
    f.tempoNaCategoria = arred(p.dataCategoria ? (hoje - new Date(p.dataCategoria)) / (365.2425 * 86_400_000) : null)
    const prog = verificarProgressaoCivil(p, { hoje })
    f.proximaCategoria = prog.categoriaProposta
    f.elegivelPromocao = prog.elegivel
    f.descricao = p.vinculo === 'domiciliar' ? 'Empregada(o) domiciliar' : p.categoriaCivil || 'Civil'
    if (p.militarAlocado) f.militarAlocadoNome = `${abreviaturaDoPosto(p.militarAlocado.posto, p.militarAlocado.ramo)} ${p.militarAlocado.nome}`
  }
  // todas as funções na Escola (a principal e as outras): «Funcionário · Docente»
  f.vinculos = vinculosDe(p)
  f.vinculoNome = f.vinculos.map((v) => VINCULOS[v]).filter(Boolean).join(' · ')
  f.docente = f.vinculos.includes('docente')
  f.discente = f.vinculos.includes('estudante')
  f.tipoDocenteNome = TIPOS_DOCENTE[p.tipoDocente] ?? ''
  f.generoNome = GENEROS[p.genero] ?? ''
  f.habilitacaoNome = HABILITACOES[p.habilitacao] ?? ''
  delete f.biIndice // índice do BI (HMAC): fica no servidor
  delete f.unidade
  delete f.cargo
  delete f.militarAlocado
  return f
}

// verifica a coerência dos dados de uma ficha (já validados no formato); devolve a mensagem do 1.º problema
export function problemaNaFicha(p) {
  if (p.tipo === 'militar') {
    if (p.vinculo === 'domiciliar') return ['vinculo', 'Empregados domiciliares são pessoal civil.']
    if (!RAMOS[p.ramo]) return ['ramo', 'Indique o ramo (Exército, Força Aérea ou Marinha).']
    if (!POSTOS[p.posto]) return ['posto', 'Indique o posto.']
    if (!existeNoRamo(p.posto, p.ramo)) return ['posto', `O posto ${nomeDoPosto(p.posto)} não existe na ${RAMOS[p.ramo].nome}.`]
    if (!FORMAS_SERVICO[p.fps]) return ['fps', 'Indique a forma de prestação de serviço.']
    if (!p.nip) return ['nip', 'O militar tem de ter NIP.']
    if (p.situacao && !SITUACOES[p.situacao]) return ['situacao', 'Situação desconhecida.']
    if (p.situacao === 'activo' && p.efectividade && !EFECTIVIDADES[p.efectividade]) return ['efectividade', 'Efectividade desconhecida.']
    if (p.estado && !ESTADOS[p.estado]) return ['estado', 'Estado desconhecido.']
    if (p.quadroEspecial && !quadroEspecial(p.ramo, p.quadroEspecial)) return ['quadroEspecial', 'Esse quadro especial não existe no ramo.']
    if (['aspirante', 'subsargento', 'soldado', 'segundo_cabo', 'primeiro_cabo'].includes(p.posto) && p.fps === 'QP') return ['posto', 'Esse posto é do Serviço Militar Obrigatório (art. 127.º).']
  } else {
    if (p.vinculo === 'domiciliar' && !p.militarAlocadoId) return ['militarAlocadoId', 'Indique o oficial a quem a empregada(o) domiciliar está afecta(o).']
    if (p.carreiraCivil && !CARREIRAS_CIVIS[p.carreiraCivil]) return ['carreiraCivil', 'Carreira desconhecida.']
    if (p.carreiraCivil && p.categoriaCivil && !CARREIRAS_CIVIS[p.carreiraCivil].categorias.includes(p.categoriaCivil)) return ['categoriaCivil', 'A categoria não é dessa carreira.']
  }
  const d = (k) => (p[k] ? new Date(p[k]) : null)
  if (d('dataNascimento') && d('dataIngresso') && d('dataIngresso') < d('dataNascimento')) return ['dataIngresso', 'A data de ingresso é anterior ao nascimento.']
  if (d('dataNascimento') && d('dataNascimento') > new Date()) return ['dataNascimento', 'A data de nascimento está no futuro.']
  return null
}

/*
  Verificação do BI (como no SIGP): compara a ficha com os dados da base de dados do Estado, sem ligar a
  acentos, maiúsculas nem espaços. Devolve as diferenças: [{ campo, rotulo, ficha, bi }].
*/
const CAMPOS_BI = [['nome', 'Nome'], ['pai', 'Pai'], ['mae', 'Mãe'], ['dataNascimento', 'Data de nascimento'], ['genero', 'Género']]
const simples = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
export function diferencasDoBi(ficha, bi) {
  return CAMPOS_BI.filter(([k]) => bi[k] && ficha[k] && simples(String(ficha[k]).slice(0, k === 'dataNascimento' ? 10 : undefined)) !== simples(bi[k]))
    .map(([campo, rotulo]) => ({ campo, rotulo, ficha: String(ficha[campo]).slice(0, campo === 'dataNascimento' ? 10 : undefined), bi: bi[campo] }))
}
