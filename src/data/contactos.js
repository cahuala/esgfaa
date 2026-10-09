// ATENÇÃO: morada, telefones e horários são provisórios — confirmar antes de publicar.
const contactos = {
  morada: ['Escola Superior de Guerra das FAA', 'Luanda, Angola'],
  telefones: ['+244 222 000 000', '+244 923 000 000'],
  email: 'geral@esgfaa.gov.ao',
  horario: [
    { dias: 'Segunda a sexta', horas: '08:00 – 16:00' },
    { dias: 'Sábado, domingo e feriados', horas: 'Encerrado' },
  ],
  // pesquisa usada no mapa incorporado (Google Maps, sem chave de API)
  mapa: 'Escola Superior de Guerra, Luanda, Angola',
  departamentos: [
    { nome: 'Secretaria Académica', descricao: 'Candidaturas, matrículas e certificados', email: 'secretaria@esgfaa.gov.ao' },
    { nome: 'Gabinete de Comunicação', descricao: 'Imprensa, eventos e redes sociais', email: 'comunicacao@esgfaa.gov.ao' },
    { nome: 'Cooperação Internacional', descricao: 'Parcerias e intercâmbio com escolas militares', email: 'cooperacao@esgfaa.gov.ao' },
    { nome: 'Departamento de Investigação', descricao: 'Publicações, revista e projetos científicos', email: 'investigacao@esgfaa.gov.ao' },
  ],
  assuntos: [
    'Candidaturas e admissões',
    'Informação sobre cursos',
    'Imprensa e comunicação',
    'Cooperação institucional',
    'Investigação e publicações',
    'Outro assunto',
  ],
}

export default contactos
