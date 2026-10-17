/*
  Pessoal civil da Escola: carreiras e categorias do regime geral da função pública (da mais baixa para a
  mais alta). A Lei n.º 13/18 só trata dos militares; estas listas e o tempo mínimo de progressão seguem o
  regime geral e devem ser confirmados com a legislação que a Escola aplica.
*/
export const CARREIRAS_CIVIS = {
  tecnica_superior: {
    nome: 'Técnica Superior',
    categorias: ['Técnico Superior de 2.ª Classe', 'Técnico Superior de 1.ª Classe', 'Técnico Superior Principal', 'Assessor', 'Primeiro Assessor', 'Assessor Principal'],
  },
  tecnica: {
    nome: 'Técnica',
    categorias: ['Técnico de 3.ª Classe', 'Técnico de 2.ª Classe', 'Técnico de 1.ª Classe', 'Especialista de 2.ª Classe', 'Especialista de 1.ª Classe', 'Especialista Principal'],
  },
  tecnica_media: {
    nome: 'Técnica Média',
    categorias: ['Técnico Médio de 3.ª Classe', 'Técnico Médio de 2.ª Classe', 'Técnico Médio de 1.ª Classe', 'Técnico Médio Principal de 3.ª Classe', 'Técnico Médio Principal de 2.ª Classe', 'Técnico Médio Principal de 1.ª Classe'],
  },
  administrativa: {
    nome: 'Administrativa',
    categorias: ['Aspirante', 'Terceiro Oficial', 'Segundo Oficial', 'Primeiro Oficial', 'Oficial Administrativo Principal'],
  },
  auxiliar: {
    nome: 'Auxiliar',
    categorias: ['Auxiliar Administrativo de 2.ª Classe', 'Auxiliar Administrativo de 1.ª Classe', 'Auxiliar Administrativo Principal'],
  },
  operaria: {
    nome: 'Operária',
    categorias: ['Operário Qualificado de 2.ª Classe', 'Operário Qualificado de 1.ª Classe', 'Operário Qualificado Principal', 'Encarregado'],
  },
  docente: {
    nome: 'Docente (ensino superior)',
    categorias: ['Assistente Estagiário', 'Assistente', 'Professor Auxiliar', 'Professor Associado', 'Professor Catedrático'],
  },
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
