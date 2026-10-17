/*
  Pessoal civil da Escola: carreiras e categorias do regime geral da função pública (da mais baixa para a
  mais alta). A Lei n.º 13/18 só trata dos militares; estas listas e o tempo mínimo de progressão seguem o
  regime geral e devem ser confirmados com a legislação que a Escola aplica.
*/
/*
  Categorias do pessoal civil — as mesmas do SIGP (faa_categorias_civis), com o nível, o vencimento base,
  os subsídios e os descontos. A Escola tem também docentes civis (categoria que o SIGP não tem).
  Dentro de cada categoria, as classes (da mais baixa para a mais alta) servem à progressão.
  No sistema, a categoria fica em carreiraCivil e a classe em categoriaCivil.
*/
const C = (nome, nivel, vencimentoBase, subsidioAlimentacao, subsidioTransporte, descricao, classes, extra = {}) => ({ nome, nivel, vencimentoBase, subsidioAlimentacao, subsidioTransporte, percSegSocial: 3, percIrt: 7, descricao, categorias: classes, ...extra })
export const CARREIRAS_CIVIS = {
  tecnico_superior: C('Técnico Superior', 1, 450000, 18000, 12000, 'Nível superior — licenciatura ou equivalente', ['Técnico Superior de 2.ª Classe', 'Técnico Superior de 1.ª Classe', 'Técnico Superior Principal', 'Assessor', 'Primeiro Assessor', 'Assessor Principal']),
  tecnico_medio: C('Técnico Médio', 2, 320000, 15000, 10000, 'Nível médio — 12.ª classe ou equivalente', ['Técnico Médio de 3.ª Classe', 'Técnico Médio de 2.ª Classe', 'Técnico Médio de 1.ª Classe', 'Técnico Médio Principal de 3.ª Classe', 'Técnico Médio Principal de 2.ª Classe', 'Técnico Médio Principal de 1.ª Classe']),
  administrativo: C('Administrativo', 3, 250000, 12000, 8000, 'Pessoal de apoio administrativo', ['Aspirante', 'Terceiro Oficial', 'Segundo Oficial', 'Primeiro Oficial', 'Oficial Administrativo Principal']),
  auxiliar_escritorio: C('Auxiliar de Escritório', 4, 190000, 10000, 7000, 'Apoio geral de escritório', ['Auxiliar de Escritório de 2.ª Classe', 'Auxiliar de Escritório de 1.ª Classe', 'Auxiliar de Escritório Principal']),
  auxiliar_servicos_gerais: C('Auxiliar de Serviços Gerais', 5, 150000, 9000, 6000, 'Limpeza, vigilância, condução, manutenção, etc.', ['Auxiliar de Serviços Gerais de 2.ª Classe', 'Auxiliar de Serviços Gerais de 1.ª Classe', 'Auxiliar de Serviços Gerais Principal']),
  trabalhador_domiciliar: C('Trabalhador Domiciliar', 6, 130000, 8000, 5000, 'Afecto a oficial superior ou general', ['Trabalhador Domiciliar'], { domiciliar: true }),
  docente: C('Docente (ensino superior)', 1, null, 0, 0, 'Docentes civis da Escola (não existe no SIGP)', ['Assistente Estagiário', 'Assistente', 'Professor Auxiliar', 'Professor Associado', 'Professor Catedrático'], { esg: true }),
}
// nomes antigos (antes de seguir o SIGP) → categoria actual
export const CATEGORIA_ANTIGA = { tecnica_superior: 'tecnico_superior', tecnica: 'tecnico_medio', tecnica_media: 'tecnico_medio', administrativa: 'administrativo', auxiliar: 'auxiliar_escritorio', operaria: 'auxiliar_servicos_gerais' }

// remuneração de referência da categoria (como no SIGP): base + subsídios, e os descontos
export function remuneracaoDaCategoria(chave) {
  const c = CARREIRAS_CIVIS[chave]
  if (!c?.vencimentoBase) return null
  const bruto = c.vencimentoBase + c.subsidioAlimentacao + c.subsidioTransporte
  const segSocial = Math.round(c.vencimentoBase * c.percSegSocial) / 100
  const irt = Math.round(c.vencimentoBase * c.percIrt) / 100
  return { vencimentoBase: c.vencimentoBase, subsidioAlimentacao: c.subsidioAlimentacao, subsidioTransporte: c.subsidioTransporte, bruto, segSocial, irt, liquido: bruto - segSocial - irt, percSegSocial: c.percSegSocial, percIrt: c.percIrt }
}

export const VINCULOS_CIVIS = { nomeacao_definitiva: 'Nomeação definitiva', nomeacao_provisoria: 'Nomeação provisória', contrato: 'Contrato' }
// anos mínimos numa categoria para progredir à seguinte (regime geral — a confirmar)
export const TEMPO_PROGRESSAO_CIVIL = 3

const ANO = 365.2425 * 86_400_000
const c = (id, texto, artigo, estado, detalhe = '') => ({ id, texto, artigo, estado, detalhe })

export function proximaCategoria(carreira, categoria) {
  const l = CARREIRAS_CIVIS[carreira]?.categorias
  const i = l ? l.indexOf(categoria) : -1
  return i >= 0 && i < l.length - 1 ? l[i + 1] : null
}

// progressão de um civil à categoria seguinte da sua carreira
export function verificarProgressaoCivil(p, { hoje = new Date() } = {}) {
  const proxima = proximaCategoria(p.carreiraCivil, p.categoriaCivil)
  if (!proxima) return { elegivel: false, categoriaProposta: null, condicoes: [c('topo', 'Há categoria acima na carreira', 'regime geral', 'falta', 'Está na categoria mais alta da carreira, ou a carreira não está definida.')] }
  const condicoes = []
  const anos = p.dataCategoria ? (new Date(hoje) - new Date(p.dataCategoria)) / ANO : null
  if (anos === null) condicoes.push(c('tempo', `${TEMPO_PROGRESSAO_CIVIL} anos na categoria`, 'regime geral (a confirmar)', 'confirmar', 'Falta a data de entrada na categoria.'))
  else condicoes.push(c('tempo', `${TEMPO_PROGRESSAO_CIVIL} anos na categoria`, 'regime geral (a confirmar)', anos >= TEMPO_PROGRESSAO_CIVIL ? 'ok' : 'falta', `Tem ${anos.toFixed(1)} anos.`))
  condicoes.push(c('avaliacao', 'Avaliação de desempenho favorável', 'regime geral (a confirmar)', p.avaliacaoFavoravel === false ? 'falta' : 'ok'))
  condicoes.push(c('processo', 'Sem processo disciplinar em curso', 'regime geral (a confirmar)', p.processoPendente ? 'falta' : 'ok'))
  if (p.vinculoCivil === 'contrato') condicoes.push(c('vinculo', 'Vínculo que permite progressão na carreira', 'regime geral (a confirmar)', 'confirmar', 'O pessoal contratado progride conforme o contrato.'))
  condicoes.push(c('vaga', 'Existe lugar no quadro', 'regime geral (a confirmar)', 'confirmar'))
  return { elegivel: condicoes.every((x) => x.estado !== 'falta'), categoriaProposta: proxima, condicoes }
}
