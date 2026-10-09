import Curso1 from '../assets/Curso1.png'
import Curso2 from '../assets/Curso2.png'
import Curso3 from '../assets/Curso3.png'

/*
  ATENÇÃO: planos curriculares, cargas horárias, vagas, requisitos e datas são
  provisórios — confirmar com a Direção de Ensino antes de publicar.
  `coordenador` refere o id em data/pessoas.js.
*/

// Processo e calendário de admissão comuns a todos os cursos
export const processoAdmissao = [
  { titulo: 'Candidatura', texto: 'Submissão do formulário e dos documentos através do ramo de origem ou da Secretaria Académica.' },
  { titulo: 'Análise documental', texto: 'Verificação dos requisitos de posto, tempo de serviço e habilitações.' },
  { titulo: 'Provas e entrevista', texto: 'Prova escrita de conhecimentos gerais e entrevista perante um júri.' },
  { titulo: 'Resultados', texto: 'Publicação da lista de admitidos e convocação para matrícula.' },
]

export const calendarioAdmissao = [
  { fase: 'Abertura das candidaturas', periodo: '1 de outubro de 2026' },
  { fase: 'Fim do prazo de candidatura', periodo: '30 de novembro de 2026' },
  { fase: 'Provas escritas e entrevistas', periodo: '11 a 22 de janeiro de 2027' },
  { fase: 'Publicação dos resultados', periodo: '5 de fevereiro de 2027' },
  { fase: 'Matrículas', periodo: '15 a 26 de fevereiro de 2027' },
  { fase: 'Início das aulas', periodo: '8 de março de 2027' },
]

const cursos = [
  {
    id: 'estado-maior',
    sigla: 'CEM',
    nome: 'Curso de Estado-Maior',
    resumo: 'Prepara oficiais para funções de planeamento, comando e assessoria em estados-maiores das Forças Armadas.',
    imagem: Curso1,
    duracao: '2 anos',
    regime: 'Presencial, tempo integral',
    vagas: '60',
    destinatarios: 'Majores e tenentes-coronéis dos três ramos',
    coordenador: 'teresa-lopes',
    apresentacao: [
      'O Curso de Estado-Maior é a formação de referência para os oficiais que vão integrar estados-maiores de comandos, regiões e órgãos centrais das Forças Armadas Angolanas.',
      'Ao longo de quatro semestres, os alunos estudam estratégia, planeamento operacional, logística, liderança e direito, e aplicam esses conhecimentos em exercícios de planeamento cada vez mais exigentes.',
    ],
    objetivos: [
      'Dominar o processo de planeamento operacional e a elaboração de ordens.',
      'Assessorar o comandante na tomada de decisão em ambientes complexos.',
      'Coordenar meios dos três ramos em operações conjuntas.',
      'Conduzir investigação aplicada em temas de segurança e defesa.',
    ],
    plano: [
      { periodo: '1.º semestre', unidades: [
        { nome: 'Estratégia e Planeamento Militar', horas: 90 },
        { nome: 'Liderança e Gestão de Recursos', horas: 60 },
        { nome: 'Geopolítica e Relações Internacionais', horas: 60 },
        { nome: 'Metodologia de Investigação', horas: 45 },
      ] },
      { periodo: '2.º semestre', unidades: [
        { nome: 'Processo de Planeamento Operacional', horas: 120 },
        { nome: 'Logística Militar', horas: 60 },
        { nome: 'Direito Internacional e Humanitário', horas: 60 },
      ] },
      { periodo: '3.º semestre', unidades: [
        { nome: 'Operações Conjuntas e Combinadas', horas: 120 },
        { nome: 'Informações e Segurança', horas: 60 },
        { nome: 'Comunicação e Liderança Estratégica', horas: 45 },
      ] },
      { periodo: '4.º semestre', unidades: [
        { nome: 'Exercício Final de Planeamento', horas: 90 },
        { nome: 'Estágio prático em unidade operacional', horas: 120 },
        { nome: 'Trabalho de Investigação Individual', horas: 90 },
      ] },
    ],
    requisitos: [
      'Posto de Major ou Tenente-Coronel.',
      'Mínimo de 10 anos de serviço efetivo.',
      'Licenciatura ou formação militar superior equivalente.',
      'Parecer favorável do ramo de origem.',
      'Aptidão física e médica comprovada.',
    ],
    saidas: [
      'Oficial de estado-maior em comandos de ramo e regiões militares.',
      'Chefe de repartição em órgãos centrais de defesa.',
      'Assessor em missões internacionais e organizações regionais.',
    ],
  },
  {
    id: 'oficial-general',
    sigla: 'CPOG',
    nome: 'Curso de Promoção a Oficial General',
    resumo: 'Forma oficiais superiores para o exercício de funções de comando e direção ao mais alto nível.',
    imagem: Curso2,
    duracao: '1 ano',
    regime: 'Presencial, tempo integral',
    vagas: '25',
    destinatarios: 'Coronéis e capitães-de-mar-e-guerra',
    coordenador: 'ana-baptista',
    apresentacao: [
      'O Curso de Promoção a Oficial General prepara os coronéis que vão assumir funções de comando e direção ao mais alto nível das Forças Armadas e do Estado.',
      'O programa privilegia a reflexão estratégica, a gestão de grandes organizações e a relação entre a defesa, a política externa e o desenvolvimento nacional.',
    ],
    objetivos: [
      'Formular e avaliar estratégias de segurança e defesa nacional.',
      'Dirigir organizações militares complexas e os seus recursos.',
      'Representar as Forças Armadas junto de instituições nacionais e internacionais.',
    ],
    plano: [
      { periodo: '1.º semestre', unidades: [
        { nome: 'Segurança e Defesa Nacional', horas: 90 },
        { nome: 'Geopolítica e Relações Internacionais', horas: 75 },
        { nome: 'Direção Estratégica de Organizações', horas: 75 },
      ] },
      { periodo: '2.º semestre', unidades: [
        { nome: 'Gestão Estratégica de Instituições Militares', horas: 75 },
        { nome: 'Diplomacia de Defesa', horas: 60 },
        { nome: 'Trabalho Final de Curso', horas: 90 },
      ] },
    ],
    requisitos: [
      'Posto de Coronel ou Capitão-de-Mar-e-Guerra.',
      'Conclusão do Curso de Estado-Maior ou equivalente.',
      'Nomeação pelo Estado-Maior General.',
    ],
    saidas: [
      'Comando de grandes unidades e regiões militares.',
      'Direção de órgãos centrais do Ministério da Defesa.',
      'Funções de adido de defesa e em organizações internacionais.',
    ],
  },
  {
    id: 'altos-estudos',
    sigla: 'CAEM',
    nome: 'Curso de Altos Estudos Militares',
    resumo: 'Aprofunda a formação doutrinária e científica de quadros destinados a funções de topo institucional.',
    imagem: Curso3,
    duracao: '18 meses',
    regime: 'Presencial, tempo integral',
    vagas: '30',
    destinatarios: 'Oficiais superiores e quadros civis da defesa',
    coordenador: 'miguel-santos',
    apresentacao: [
      'O Curso de Altos Estudos Militares é o programa de maior componente científica da Escola, dirigido a oficiais superiores e a quadros civis do setor da defesa.',
      'Combina seminários avançados com um trabalho de investigação original, orientado por docentes do Departamento de Investigação.',
    ],
    objetivos: [
      'Aprofundar o conhecimento doutrinário e científico em estratégia e defesa.',
      'Produzir investigação original com aplicação institucional.',
      'Desenvolver capacidade de análise prospetiva e de aconselhamento.',
    ],
    plano: [
      { periodo: '1.º semestre', unidades: [
        { nome: 'Doutrina Militar Avançada', horas: 90 },
        { nome: 'Teoria da Estratégia', horas: 60 },
        { nome: 'Métodos de Investigação Avançados', horas: 60 },
      ] },
      { periodo: '2.º semestre', unidades: [
        { nome: 'Investigação Científica Aplicada', horas: 90 },
        { nome: 'Cooperação e Diplomacia de Defesa', horas: 60 },
        { nome: 'Seminário de Estudos Prospetivos', horas: 45 },
      ] },
      { periodo: '3.º semestre', unidades: [
        { nome: 'Dissertação final', horas: 180 },
      ] },
    ],
    requisitos: [
      'Oficial superior ou quadro civil da defesa com licenciatura.',
      'Experiência mínima de 5 anos em funções de direção ou assessoria.',
      'Apresentação de uma proposta de tema de investigação.',
    ],
    saidas: [
      'Assessoria estratégica em órgãos de soberania e defesa.',
      'Docência e investigação em instituições de ensino superior militar.',
      'Direção de centros de estudos e análise.',
    ],
  },
]

export const totalHoras = (curso) =>
  curso.plano.reduce((t, p) => t + p.unidades.reduce((s, u) => s + u.horas, 0), 0)

export function cursoPorId(id) {
  return cursos.find((c) => c.id === id)
}

export default cursos
