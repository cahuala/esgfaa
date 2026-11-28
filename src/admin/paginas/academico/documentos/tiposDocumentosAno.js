// os documentos do ano lectivo (Administração Escolar): o tipo e o título
export const DOCUMENTOS_ANO = {
  relacao: 'Relação nominal dos discentes',
  estatistica: 'Dados estatísticos',
  ramos: 'Dados por ramos',
  resumo: 'Resumo dos dados estatísticos',
  finais: 'Dados estatísticos finais dos cursos',
  entrega: 'Relação para a entrega dos diplomas e certificados',
  diplomas: 'Lista final de dados para os diplomas',
}

// os documentos de uma turma (na escolha do ano lectivo e da turma; também para a 2.ª via)
export const DOCUMENTOS_TURMA = {
  diplomas: { nome: 'Diplomas e certificados (emitir e 2.ª via)', ligacao: (t) => `/academico/documentos/turma/${t}/diplomas`, gerir: true },
  lista: { nome: 'Listas da turma (relação nominal, contactos, constituição, formação…)', ligacao: (t) => `/academico/documentos/turma/${t}/lista` },
  pauta: { nome: 'Pauta da turma', ligacao: (t) => `/academico/documentos/turma/${t}/pauta` },
  pautaFinal: { nome: 'Pauta final do curso (médias e classificação)', ligacao: (t) => `/academico/turmas/${t}/pauta-final` },
  oficios: { nome: 'Ofícios (credenciais, comunicações, nota de envio)', ligacao: (t) => `/academico/turmas/${t}/oficios` },
  horario: { nome: 'Horário mensal', ligacao: (t) => `/academico/turmas/${t}/horario-mensal` },
  turma: { nome: 'A turma (estudantes, histórico de cada um, cadeiras e pautas das cadeiras)', ligacao: (t) => `/academico/turmas/${t}` },
}

