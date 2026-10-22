import Curso1 from '../assets/Curso1.png'
import Curso2 from '../assets/Curso2.png'
import Curso3 from '../assets/Curso3.png'

import { MODELOS_PLANO } from '../../api/src/dominio/academico/avaliacao/planoCurso.js'

/*
  Os cursos vêm dos planos de curso 2026/2027. O calendário de admissão continua a confirmar com a Direcção
  de Ensino. `coordenador` (opcional) refere o id em data/pessoas.js.
*/

// Processo e calendário de admissão comuns a todos os cursos
export const processoAdmissao = [
  { titulo: 'Proposta do ramo', texto: 'O ramo de origem propõe os oficiais e envia a documentação à Repartição de Pessoal e Quadros.' },
  { titulo: 'Análise documental', texto: 'Verificação dos requisitos de posto, tempo de serviço e habilitações.' },
  { titulo: 'Provas e entrevista', texto: 'Prova escrita de conhecimentos gerais e entrevista perante um júri.' },
  { titulo: 'Registo e matrícula', texto: 'A Repartição de Pessoal e Quadros regista os admitidos e a Secretaria Académica convoca-os para a matrícula.' },
]

export const calendarioAdmissao = [
  { fase: 'Provas escritas e entrevistas', periodo: '11 a 22 de janeiro de 2027' },
  { fase: 'Publicação dos resultados', periodo: '5 de fevereiro de 2027' },
  { fase: 'Matrículas', periodo: '15 a 26 de fevereiro de 2027' },
  { fase: 'Início das aulas', periodo: '8 de março de 2027' },
]

/*
  Os quatro cursos da ESG em 2026/2027, pelos planos de curso da Direcção de Ensino (docs/PLANOS E AGENDAS
  DE CURSOS 2026-2027). As unidades curriculares, as horas e os créditos vêm do mesmo modelo que o Portal
  Académico usa (MODELOS_PLANO), agrupadas por bloco como nos planos (os planos não indicam o semestre).
*/
const ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI']
function planoDe(chave) {
  const m = MODELOS_PLANO[chave]
  return m.plano.blocos.map((b, i) => ({
    periodo: `Bloco ${ROMANOS[i]} — ${b.nome}`,
    unidades: m.cadeiras.filter((c) => c.bloco === b.sigla).map((c) => ({ nome: c.nome, horas: c.horasContacto + c.horasNaoContacto, creditos: c.creditos })),
  }))
}

const cursos = [
  {
    id: 'curso-superior-de-comando-e-direccao',
    sigla: 'CSCD',
    nome: 'Curso Superior de Comando e Direcção',
    resumo: 'Complementa a formação de Oficiais Generais e Coronéis para os altos cargos de Comando, Direcção e Estado-Maior das FAA e da Polícia Nacional.',
    imagem: Curso1,
    duracao: '10 meses',
    regime: 'Presencial',
    vagas: '35',
    destinatarios: 'Oficiais Generais e Coronéis ou Capitães-de-Mar-e-Guerra das FAA; Comissários ou Superintendentes-Chefes da PNA; oficiais de países amigos e aliados',
    apresentacao: [
      'O CSCD tem por finalidade complementar a formação para o exercício das funções inerentes aos altos cargos de Comando, Direcção e Estado-Maior, com foco particular na investigação científica e no estudo, debate e análise de temas nacionais e internacionais com interesse para as FAA e para a PNA.',
      'O curso organiza-se em cinco blocos de unidades curriculares — Administração, Táctica, Operações Conjuntas e Combinadas, Estratégia e Trabalho de Investigação Individual — num total de 20 unidades curriculares, 1215 horas de trabalho e 81 unidades de crédito, a que se juntam o ciclo de conferências e as actividades diversas.',
      'A classificação final é a média ponderada dos cinco blocos: (2 × Administração + 3 × Táctica + 1 × Operações Conjuntas e Combinadas + 2 × Estratégia + 2 × TII) / 10.',
    ],
    objetivos: [
      'Promover o conhecimento mútuo e o entendimento comum dos problemas de segurança, em especial os da Defesa Nacional, numa perspectiva político-estratégica.',
      'Dispor da informação necessária, como complemento da adquirida ao longo da carreira, para gerir cargos de topo, com perspectivas sistémicas, conceptuais e doutrinárias.',
      'Gerir os recursos afectos à segurança e defesa nacional, num contexto de escassez cíclica ou permanente.',
      'Planear e conduzir operações terrestres e operações conjuntas e combinadas.',
      'Apoiar a decisão do planeamento estratégico e político-estratégico nacional.',
    ],
    plano: planoDe('cscd-2026'),
    requisitos: [
      'Oficiais do Quadro Permanente das FAA e da PNA nomeados para o efeito (Circular n.º 003/CDPPQ/EMGFAA/09/2024).',
      'Oficiais Generais/Almirantes: por decisão do CEMGFAA.',
      'Coronéis/Capitães-de-Mar-e-Guerra: cargo orgânico compatível com o posto, idade até 55 anos (excepto Saúde Militar), perspectiva de progressão, licenciatura e Avaliação Individual favorável.',
      'Curso de Comando e Estado-Maior (CCEM) e Curso de Promoção a Oficial Superior (CPOS), ou equivalentes.',
    ],
    saidas: [
      'Gestão de recursos afectos à Segurança e Defesa Nacional.',
      'Planeamento e condução do emprego de forças em operações terrestres.',
      'Planeamento e gestão de operações militares de nível conjunto e combinado.',
      'Apoio à decisão do planeamento estratégico e político-estratégico nacional.',
    ],
  },
  {
    id: 'curso-de-estado-maior-conjunto',
    sigla: 'CEMC',
    nome: 'Curso de Estado-Maior Conjunto',
    resumo: 'Habilita Oficiais Superiores das FAA e da PNA para funções de nível operacional e estratégico em estados-maiores conjuntos.',
    imagem: Curso2,
    duracao: '10 meses',
    regime: 'Presencial',
    vagas: '35',
    destinatarios: 'Oficiais Superiores das FAA e da PNA com elevado potencial; oficiais de países amigos de postos similares',
    apresentacao: [
      'O CEMC é uma formação que habilita os Oficiais Superiores das Forças Armadas Angolanas e da Polícia Nacional de Angola para o desempenho de funções ao nível Operacional e Estratégico, dirigida primariamente a quem demonstra elevado potencial no desempenho de funções ou cargos ao longo da carreira.',
      'O curso organiza-se em quatro blocos — Administração, Operações Conjuntas e Combinadas, Estratégia e Trabalho de Investigação Individual — num total de 21 unidades curriculares, 1215 horas de trabalho e 81 unidades de crédito.',
      'A classificação final é a média ponderada dos blocos: (2,5 × Administração + 1 × Operações Conjuntas e Combinadas + 2 × Estratégia + 1,5 × TII) / 7.',
    ],
    objetivos: [
      'Compreender e analisar o Direito Castrense e a Justiça e Disciplina nas Forças Armadas.',
      'Compreender e aplicar competências de comunicação, relações públicas e protocolo.',
      'Compreender os modelos, processos e técnicas de gestão pública, de pessoas e de recursos financeiros.',
      'Compreender os processos logísticos conjuntos e a economia e indústria de defesa.',
      'Compreender, aplicar e avaliar as competências de comando e de liderança.',
      'Aplicar métodos quantitativos de apoio à decisão e planear operações conjuntas e combinadas.',
    ],
    plano: planoDe('cemc-2026'),
    requisitos: [
      'Oficiais do Quadro Permanente das FAA e da PNA nomeados para o efeito (Circular n.º 003/CDPPQ/EMGFAA/09/2024).',
      'Cargo orgânico compatível com o posto, idade até 50 anos, perspectiva de progressão na carreira, licenciatura e Avaliação Individual favorável.',
      'Curso de Comando e Estado-Maior (CCEM) do respectivo Ramo, ou equivalente.',
    ],
    saidas: [
      'Gestão de recursos afectos à Segurança e Defesa Nacional.',
      'Planeamento, organização e comando de forças em operações terrestres.',
      'Planeamento de operações militares de nível conjunto e combinado.',
      'Apoio à decisão do planeamento estratégico nacional.',
    ],
  },
  {
    id: 'curso-de-estrategia-e-arte-operativa',
    sigla: 'CEAO',
    nome: 'Curso de Estratégia e Arte Operativa',
    resumo: 'Enriquece as competências de Oficiais Generais, Almirantes, Comissários e Entidades Públicas para o Comando, Direcção e Estado-Maior ao mais alto nível.',
    imagem: Curso3,
    duracao: '10 meses',
    regime: 'Presencial',
    vagas: '30',
    destinatarios: 'Oficiais Generais e Almirantes das FAA, Comissários da Polícia Nacional e Entidades Públicas designadas',
    apresentacao: [
      'O CEAO, aprovado pela Directiva n.º 10/22/07/CEMGFAA/2014, enriquece as competências científicas e técnico-profissionais necessárias ao desempenho de funções de Comando, Direcção, Chefia e Estado-Maior ao mais alto nível das respectivas estruturas, através de estudos aprofundados e debates sobre Segurança e Defesa Nacional.',
      'O curso organiza-se em disciplinas nucleares, disciplinas complementares e o Trabalho de Investigação Individual, incluindo a Arte Operativa e Táctica e o Jogo de Comando e Estado-Maior.',
      'A média final é (Nucleares × 0,60) + (Complementares × 0,15) + (TII × 0,25).',
    ],
    objetivos: [
      'Promover o entendimento comum dos problemas de segurança e de Defesa Nacional numa perspectiva político-estratégica e operacional.',
      'Preparar os auditores como gestores de topo, aos níveis sistémico, conceptual e doutrinário.',
      'Dominar a interacção entre os níveis político, estratégico e operacional.',
      'Analisar e resolver problemas complexos com visão sistémica.',
    ],
    plano: planoDe('ceao-2026'),
    requisitos: [
      'Oficiais Generais das FAA, Comissários da Polícia Nacional com o Curso Superior de Comando e Direcção ou equivalente, e Entidades Públicas designadas.',
      'De preferência, o grau académico de licenciatura.',
      'A título excepcional, auditores sem licenciatura e Coronéis com perspectiva de virem a ocupar altos cargos nas FAA.',
    ],
    saidas: [
      'Funções de Comando, Direcção, Chefia e Estado-Maior ao mais alto nível das FAA, da Polícia Nacional e de entidades públicas ligadas à Defesa Nacional.',
      'Domínio dos conhecimentos estratégicos e operacionais da segurança e defesa nacional.',
    ],
  },
  {
    id: 'curso-de-organizacao-do-asseguramento-moral-e-psicologico',
    sigla: 'COAMP',
    nome: 'Curso de Organização do Asseguramento Moral e Psicológico',
    resumo: 'Curso de qualificação para Oficiais Generais e Superiores dos órgãos de Educação Patriótica das FAA nas técnicas do Asseguramento Moral e Psicológico.',
    imagem: Curso1,
    duracao: '10 meses',
    regime: 'Presencial',
    vagas: '—',
    destinatarios: 'Oficiais Generais e Superiores (Coronéis/CMG) dos órgãos de Educação Patriótica das FAA',
    apresentacao: [
      'O COAMP, institucionalizado por Despacho do CEMGFAA de 25 de Junho de 2016, é um curso de qualificação que habilita os Oficiais Generais e Superiores dos órgãos de Educação Patriótica das Forças Armadas Angolanas.',
      'Prepara Comandantes Adjuntos para a Educação Patriótica, chefes de repartição e oficiais dos órgãos de direcção, em quatro blocos de matérias — Nucleares, Complementares, de Táctica e Gerais — e no Trabalho de Fim do Curso.',
      'A aprovação exige média final global igual ou superior a 10 valores; ouvido o Conselho de Curso, o Comandante da ESG pode ajustar a média final até ±0,25.',
    ],
    objetivos: [
      'Conhecer em profundidade o Sistema de Asseguramento Moral e Psicológico nas FAA, aos níveis estratégico, operacional e táctico.',
      'Aplicar a Psicologia Militar e dirigir a preparação psicológica das tropas para o combate.',
      'Aplicar a tecnologia do fortalecimento da disciplina militar e da prevenção da criminalidade e do alcoolismo.',
      'Planear o emprego de forças e meios do Asseguramento Moral e Psicológico no escalão Divisão/Brigada.',
      'Aplicar o Processo de Decisão Militar e a doutrina das operações.',
    ],
    plano: planoDe('coamp-2026'),
    requisitos: [
      'Oficiais Generais e Superiores (Coronéis/CMG) dos órgãos de Educação Patriótica das FAA, nomeados para o efeito.',
    ],
    saidas: [
      'Comandante Adjunto para a Educação Patriótica.',
      'Chefe de repartição e oficial dos órgãos de direcção da Educação Patriótica.',
    ],
  },
]

export const totalHoras = (curso) =>
  curso.plano.reduce((t, p) => t + p.unidades.reduce((s, u) => s + u.horas, 0), 0)

export default cursos
