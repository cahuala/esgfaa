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
  { id: 'comentarios', acoes: ['ver', 'apagar'] },
  { id: 'contactos', acoes: ['ver', 'gerir'] },
  // conselho: Director de Ensino (juízo ampliativo, proposta, Conselho de Curso); homologar: Comandante
  { id: 'academico', acoes: ['ver', 'gerir', 'notas', 'conselho', 'homologar'] },
  { id: 'pessoal', acoes: ['ver', 'registar'] },
  { id: 'biblioteca', acoes: ['ver', 'gerir'] },
  { id: 'integridade', acoes: ['ver', 'gerir'] },
  { id: 'estatisticas', acoes: ['ver'] },
  { id: 'utilizadores', acoes: ['ver', 'criar', 'editar'] },
  { id: 'papeis', acoes: ['ver', 'gerir'] },
  { id: 'atividades', acoes: ['ver'] },
  { id: 'seguranca', acoes: ['ver', 'gerir'] },
]

export const TODAS = RECURSOS.flatMap((r) => r.acoes.map((a) => `${r.id}.${a}`))

const conteudo = (recursos, acoes) => recursos.flatMap((r) => acoes.map((a) => `${r}.${a}`))

export const PAPEIS_PADRAO = [
  {
    id: 'administrador',
    nome: 'Administrador',
    descricao: 'Acesso total, incluindo utilizadores, papéis e registo de atividades.',
    sistema: 1,
    permissoes: TODAS,
  },
  {
    id: 'editor_chefe',
    nome: 'Editor-chefe',
    descricao: 'Gere e publica todos os conteúdos, páginas, publicidade e comentários.',
    sistema: 0,
    permissoes: [
      ...conteudo(CONTEUDOS, ['ver', 'criar', 'editar', 'apagar', 'publicar']),
      'paginas.ver', 'paginas.editar', 'comentarios.ver', 'comentarios.apagar', 'contactos.ver', 'contactos.gerir', 'estatisticas.ver',
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
    descricao: 'Acompanha e remove comentários dos visitantes.',
    sistema: 0,
    permissoes: ['noticias.ver', 'artigos.ver', 'eventos.ver', 'comentarios.ver', 'comentarios.apagar'],
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
    descricao: 'Juízo ampliativo dos auditores, proposta das classificações finais e confirmação em Conselho de Curso.',
    sistema: 0,
    permissoes: ['academico.ver', 'academico.conselho'],
  },
  {
    id: 'comandante',
    nome: 'Comandante da ESG',
    descricao: 'Homologa as classificações finais dos cursos, atribui o Distinto e o ajuste previsto no plano.',
    sistema: 0,
    permissoes: ['academico.ver', 'academico.homologar'],
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
