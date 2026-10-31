/*
  Controlo de acesso por papéis (RBAC).
  Cada permissão é "recurso.acao". Os papéis guardam a lista de permissões na base de dados
  e editam-se no painel; o papel "administrador" é de sistema e tem sempre tudo.
*/

const CONTEUDOS = ['noticias', 'artigos', 'eventos', 'cursos', 'pessoas', 'revistas', 'publicidade']

// catálogo usado pelo painel para desenhar a grelha de permissões
export const RECURSOS = [
  ...CONTEUDOS.map((r) => ({ id: r, acoes: ['ver', 'criar', 'editar', 'apagar', 'publicar'] })),
  { id: 'paginas', acoes: ['ver', 'editar'] },
  // aprovar: a equipa de comunicação revê os comentários dos visitantes antes de irem ao Comandante
  { id: 'comentarios', acoes: ['ver', 'apagar', 'aprovar'] },
  { id: 'contactos', acoes: ['ver', 'gerir'] },
  // conselho: Director de Ensino (juízo ampliativo, proposta, Conselho de Curso); homologar: Comandante
  { id: 'academico', acoes: ['ver', 'gerir', 'notas', 'conselho', 'homologar'] },
  { id: 'pessoal', acoes: ['ver', 'registar'] },
  { id: 'biblioteca', acoes: ['ver', 'gerir'] },
  { id: 'integridade', acoes: ['ver', 'gerir'] },
  { id: 'estatisticas', acoes: ['ver'] },
  // aprovar: contas novas e mudanças de papel só valem com o Comandante
  { id: 'utilizadores', acoes: ['ver', 'criar', 'editar', 'aprovar'] },
  { id: 'papeis', acoes: ['ver', 'gerir'] },
  { id: 'atividades', acoes: ['ver'] },
  { id: 'seguranca', acoes: ['ver', 'gerir'] },
  // aprovar: só com isto um conteúdo do site (notícia, artigo, evento, página…) chega ao público — o Comandante
  { id: 'publicacoes', acoes: ['aprovar'] },
]

export const TODAS = RECURSOS.flatMap((r) => r.acoes.map((a) => `${r.id}.${a}`))

// permissões que nem o Administrador tem (a decisão é do Comandante, ou de quem ele indicar num papel)
export const SO_DO_COMANDANTE = ['publicacoes.aprovar', 'utilizadores.aprovar']
export const DO_ADMINISTRADOR = TODAS.filter((p) => !SO_DO_COMANDANTE.includes(p))

const conteudo = (recursos, acoes) => recursos.flatMap((r) => acoes.map((a) => `${r}.${a}`))

// o Comandante vê tudo (todas as permissões «ver») e decide o que é dele; o Director de Ensino vê tudo do Ensino
const TODAS_VER = RECURSOS.filter((r) => r.acoes.includes('ver')).map((r) => `${r.id}.ver`)
export const VER_TUDO_COMANDANTE = [...TODAS_VER, 'academico.homologar', 'publicacoes.aprovar', 'utilizadores.aprovar']
export const VER_ENSINO = ['academico.ver', 'academico.conselho', 'cursos.ver', 'integridade.ver', 'biblioteca.ver', 'pessoal.ver']
// o que estes papéis têm sempre (os já criados recebem o que falta ao arrancar)
export const MINIMOS = { comandante: VER_TUDO_COMANDANTE, director_ensino: VER_ENSINO }

export const PAPEIS_PADRAO = [
  {
    id: 'administrador',
    nome: 'Administrador',
    descricao: 'Acesso total, incluindo utilizadores, papéis e registo de atividades (a aprovação das publicações é do Comandante).',
    sistema: 1,
    permissoes: DO_ADMINISTRADOR,
  },
  {
    id: 'editor_chefe',
    nome: 'Editor-chefe',
    descricao: 'Gere e publica todos os conteúdos, páginas, publicidade e comentários.',
    sistema: 0,
    permissoes: [
      ...conteudo(CONTEUDOS, ['ver', 'criar', 'editar', 'apagar', 'publicar']),
      'paginas.ver', 'paginas.editar', 'comentarios.ver', 'comentarios.apagar', 'comentarios.aprovar', 'contactos.ver', 'contactos.gerir', 'estatisticas.ver',
    ],
  },
  {
    id: 'redator',
    nome: 'Redator',
    descricao: 'Escreve notícias, artigos e eventos como rascunho; um editor-chefe revê e publica.',
    sistema: 0,
    permissoes: [
      ...conteudo(['noticias', 'artigos', 'eventos'], ['ver', 'criar', 'editar']),
      'pessoas.ver', 'comentarios.ver',
    ],
  },
  {
    id: 'moderador',
    nome: 'Moderador',
    descricao: 'Revê os comentários dos visitantes (antes de irem ao Comandante) e remove os que não servem.',
    sistema: 0,
    permissoes: ['noticias.ver', 'artigos.ver', 'eventos.ver', 'comentarios.ver', 'comentarios.apagar', 'comentarios.aprovar'],
  },
  {
    id: 'secretaria',
    nome: 'Repartição de Administração Escolar',
    descricao: 'Turmas, matrículas e inscrições (de quem o Pessoal e Quadros registou), cadeiras, alocação de docentes, programas, pautas, horários, documentos e pedidos.',
    sistema: 0,
    permissoes: ['cursos.ver', 'academico.ver', 'academico.gerir', 'academico.notas', 'integridade.ver', 'integridade.gerir'],
  },
  {
    id: 'director_ensino',
    nome: 'Director de Ensino',
    descricao: 'Vê tudo o que é do Ensino; juízo ampliativo dos auditores, proposta das classificações finais e confirmação em Conselho de Curso.',
    sistema: 0,
    permissoes: VER_ENSINO,
  },
  {
    id: 'comandante',
    nome: 'Comandante da ESG',
    descricao: 'Vê tudo; homologa as classificações finais, autoriza alterações de notas, verifica os docentes, aprova o que se publica no site (também os comentários já revistos pela equipa de comunicação) e as contas novas e mudanças de papel do painel.',
    sistema: 0,
    permissoes: VER_TUDO_COMANDANTE,
  },
  {
    id: 'pessoal_quadros',
    nome: 'Repartição de Pessoal e Quadros',
    descricao: 'Regista estudantes e docentes (dados pessoais, posto, NIP e conta do portal); não trata da vida académica.',
    sistema: 0,
    permissoes: ['pessoal.ver', 'pessoal.registar'],
  },
  {
    id: 'bibliotecario',
    nome: 'Bibliotecário',
    descricao: 'Catálogo da biblioteca (obras, exemplares, versões digitais), empréstimos, devoluções e atrasos.',
    sistema: 0,
    permissoes: ['biblioteca.ver', 'biblioteca.gerir'],
  },
  {
    id: 'ciberseguranca',
    nome: 'Responsável de Cibersegurança',
    descricao: 'Centro de segurança: tentativas de entrada, ataques e IP suspeitos, bloquear e desbloquear endereços; consulta o registo de atividades. Não edita conteúdos nem utilizadores.',
    sistema: 0,
    permissoes: ['seguranca.ver', 'seguranca.gerir', 'atividades.ver'],
  },
  {
    id: 'analista',
    nome: 'Analista',
    descricao: 'Consulta estatísticas de visitas e de publicidade, sem editar.',
    sistema: 0,
    permissoes: ['estatisticas.ver', 'publicidade.ver', 'noticias.ver', 'eventos.ver', 'artigos.ver'],
  },
]

export const ADMINISTRADOR = 'administrador'

// guarda só permissões que existem (evita lixo enviado pelo painel) e garante que
// qualquer ação sobre um recurso inclui "ver" esse recurso
export function limparPermissoes(lista) {
  const validas = new Set((Array.isArray(lista) ? lista : []).filter((p) => TODAS.includes(p)))
  for (const p of [...validas]) {
    const ver = `${p.split('.')[0]}.ver`
    if (TODAS.includes(ver)) validas.add(ver)
  }
  return TODAS.filter((p) => validas.has(p))
}
