import Auditorio from '../assets/Auditorio.png'
import Escola2 from '../assets/Escola2.jpeg'
import EscolaDeGuerra from '../assets/Escola De Guerra.png'
import contactos from './contactos'
import { calendarioAdmissao, processoAdmissao } from './cursos'

/*
  Conteúdos fixos de cada página. São os valores de origem: a API carrega-os
  na base de dados no primeiro arranque e, a partir daí, editam-se no painel.
  ATENÇÃO: textos da História, cronologia e valores são provisórios.
*/

const home = {
  hero: {
    titulo: 'Formar quem defende Angola, desde o primeiro dia.',
    texto: 'Conheça os cursos e programas da Escola Superior de Guerra e candidate-se ao próximo ano letivo.',
    imagem: Auditorio,
    metricas: [
      { valor: '+10 anos', legenda: 'De existência' },
      { valor: '+500', legenda: 'Oficiais formados' },
    ],
    formularioTitulo: 'Candidate-se a um curso',
    formularioTexto: 'Preencha os seus dados e entraremos em contacto.',
  },
  formacao: {
    etiqueta: 'Formação e Cursos',
    titulo: 'Da admissão à graduação, formamos quem vai comandar.',
    texto: 'Programas académicos estruturados para cada etapa da carreira militar — do planeamento estratégico à liderança institucional.',
  },
  noticias: { etiqueta: 'Notícias', titulo: 'O que está a acontecer na Escola.' },
  eventos: { etiqueta: 'Eventos', titulo: 'Próximos eventos' },
  avisos: {
    etiqueta: 'Informação oficial',
    titulo: 'Avisos e comunicados',
    lista: [
      { tipo: 'Alteração de calendário', data: '2026-09-25', titulo: 'Novas datas para os exames do 1.º semestre', resumo: 'O período de exames foi reajustado. Consulte o calendário académico atualizado.', importante: true },
      { tipo: 'Convocatória', data: '2026-09-22', titulo: 'Convocatória para reunião do corpo docente', resumo: 'Convocam-se todos os docentes para a reunião geral de preparação do novo semestre.', importante: false },
      { tipo: 'Comunicado', data: '2026-09-18', titulo: 'Abertura do período de candidaturas aos cursos', resumo: 'Estão abertas as candidaturas para o próximo ano letivo. Consulte os requisitos de admissão.', importante: false },
      { tipo: 'Aviso', data: '2026-09-10', titulo: 'Condicionamento de acesso às instalações', resumo: 'Durante as obras no bloco B, o acesso será feito exclusivamente pela entrada principal.', importante: false },
    ],
  },
  corpo: { etiqueta: 'Comando e Corpo Docente', titulo: 'Quem forma, também lidera.' },
  missao: {
    imagem: Escola2,
    missao: 'Formar oficiais com competência técnica, ética e capacidade de comando ao serviço da defesa de Angola.',
    visao: 'Ser reconhecida como referência regional na formação de quadros militares e na investigação em estratégia e defesa.',
    valores: 'Disciplina, integridade, lealdade e espírito de serviço orientam cada oficial formado nesta Escola.',
  },
  faq: {
    etiqueta: 'Dúvidas frequentes',
    titulo: 'Perguntas frequentes',
    perguntas: [
      { pergunta: 'Como posso candidatar-me a um curso?', resposta: 'As candidaturas são feitas através do formulário disponível na página inicial ou na secção de Cursos, durante o período de admissões anunciado no calendário académico. Após o envio, a nossa equipa entra em contacto com os próximos passos.' },
      { pergunta: 'Quais são os requisitos de admissão?', resposta: 'Os requisitos variam consoante o curso pretendido — normalmente incluem posto militar mínimo, habilitações académicas e tempo de serviço. Consulte a página de cada curso, na secção "Requisitos de admissão", para os critérios específicos.' },
      { pergunta: 'Como aceder a documentos públicos da Escola?', resposta: 'Todos os documentos de acesso público — regulamentos, editais, relatórios e publicações — estão disponíveis na secção "Publicações e Documentos", com pesquisa por categoria, ano e tipo de documento.' },
      { pergunta: 'Como contactar um departamento específico?', resposta: 'Na página de Contactos encontra os meios de contacto gerais da Escola. Para departamentos específicos, consulte a secção "Organização e Estrutura" em Institucional, onde estão listados os responsáveis de cada área.' },
      { pergunta: 'A Escola oferece programas de cooperação internacional?', resposta: 'Sim. A Escola mantém acordos de cooperação com instituições militares parceiras, incluindo intercâmbio de docentes, alunos e projetos conjuntos de investigação. Mais informação na secção de Cooperação Internacional.' },
      { pergunta: 'Onde posso consultar o calendário académico?', resposta: 'O calendário com o início e fim dos cursos, períodos letivos, exames e outros eventos institucionais está disponível na Agenda Académica, acessível a partir do menu principal.' },
    ],
  },
  cta: {
    titulo: 'Pronto para dar o próximo passo na sua carreira militar?',
    texto: 'Candidate-se aos cursos da Escola Superior de Guerra e prepare-se para funções de comando e liderança.',
    botao: 'Candidatar-me agora',
  },
}

const institucional = {
  entrada: 'A Escola Superior de Guerra forma os oficiais que planeiam, comandam e dirigem as Forças Armadas Angolanas — e produz o pensamento estratégico que os acompanha.',
  imagemSede: EscolaDeGuerra,
  legendaSede: 'Escola Superior de Guerra das Forças Armadas Angolanas, Luanda.',
  numeros: [
    { valor: '+10', legenda: 'Anos de existência' },
    { valor: '+500', legenda: 'Oficiais formados' },
    { valor: '03', legenda: 'Cursos de formação superior' },
    { valor: '+20', legenda: 'Acordos de cooperação' },
  ],
  historia: {
    titulo: 'Mais de uma década a formar quem comanda.',
    imagem: Escola2,
    legenda: 'Sessão solene no auditório principal.',
    paragrafos: [
      'A Escola Superior de Guerra das Forças Armadas Angolanas nasceu da necessidade de formar, em Angola, os oficiais destinados às mais altas funções de comando, direção e estado-maior, reduzindo a dependência da formação no estrangeiro e adaptando o ensino à realidade nacional.',
      'Desde então, a Escola consolidou-se como o principal estabelecimento de ensino superior militar do país. O seu modelo combina a formação doutrinária com a investigação científica e a cooperação com instituições congéneres, num ambiente em que oficiais dos três ramos aprendem a planear e a decidir em conjunto.',
      'Ao longo dos anos, os cursos foram sendo revistos para acompanhar a evolução das ameaças, da tecnologia e das missões das Forças Armadas, mantendo como referência os valores que definem a condição militar.',
    ],
    marcos: [
      { ano: '2014', titulo: 'Criação da Escola', texto: 'Instituída como estabelecimento de ensino superior militar das Forças Armadas Angolanas.' },
      { ano: '2015', titulo: 'Primeiro Curso de Estado-Maior', texto: 'Arranque da formação de oficiais para funções de estado-maior.' },
      { ano: '2018', titulo: 'Abertura internacional', texto: 'Assinatura dos primeiros protocolos de cooperação com escolas militares parceiras.' },
      { ano: '2021', titulo: 'Novo ciclo de comando', texto: 'Início de um programa de modernização curricular e pedagógica.' },
      { ano: '2026', titulo: 'Reforço da investigação', texto: 'Seminários de investigação obrigatórios em todos os cursos e nova revista científica.' },
    ],
  },
  missao: 'Formar oficiais com competência técnica, ética e capacidade de comando ao serviço da defesa de Angola.',
  visao: 'Ser referência regional na formação de quadros militares e na investigação em estratégia e defesa.',
  valores: [
    { nome: 'Disciplina', texto: 'Cumprimento rigoroso do dever, das normas e da palavra dada.' },
    { nome: 'Integridade', texto: 'Coerência entre o que se pensa, o que se diz e o que se faz.' },
    { nome: 'Lealdade', texto: 'Para com a Nação, as Forças Armadas, os superiores e os subordinados.' },
    { nome: 'Espírito de serviço', texto: 'Colocar o interesse nacional acima do interesse pessoal.' },
  ],
  estrutura: {
    introducao: 'Sob a direção do Comando, a Escola organiza-se em três áreas — ensino, investigação e cooperação, e apoio — cada uma com órgãos de missão própria.',
    comando: 'Dirige a Escola e define as orientações estratégicas de ensino, investigação e cooperação.',
    ramos: [
      { titulo: 'Ensino', orgaos: [
        { nome: 'Direção de Ensino', texto: 'Planeia os cursos, os planos curriculares e a avaliação.' },
        { nome: 'Corpo Docente', texto: 'Docentes militares e civis responsáveis pela formação.' },
        { nome: 'Secretaria Académica', texto: 'Candidaturas, matrículas, certificados e calendário.' },
      ] },
      { titulo: 'Investigação e Cooperação', orgaos: [
        { nome: 'Departamento de Investigação', texto: 'Investigação científica em estratégia, segurança e defesa.' },
        { nome: 'Cooperação Internacional', texto: 'Protocolos e intercâmbio com instituições parceiras.' },
      ] },
      { titulo: 'Apoio', orgaos: [
        { nome: 'Gabinete de Comunicação', texto: 'Imprensa, eventos, publicações e redes sociais.' },
        { nome: 'Serviços de Apoio', texto: 'Logística, instalações e recursos administrativos.' },
      ] },
    ],
  },
  mensagem: {
    citacao: 'Formar quem comanda é formar quem decide. Cada oficial que passa por esta Escola leva consigo a responsabilidade de servir Angola com competência e integridade.',
    texto: 'Na Escola Superior de Guerra, acreditamos que a qualidade das nossas Forças Armadas começa na qualidade dos seus quadros. É esse o compromisso que renovamos em cada ano académico: exigência no ensino, rigor na investigação e abertura ao mundo.',
  },
}

const cursos = {
  entrada: 'Três programas de formação superior para cada etapa da carreira de oficial — do estado-maior ao comando ao mais alto nível.',
  anoAcademico: '2027',
  candidaturasAbertas: true,
  prazo: '30 de novembro de 2026',
  processo: processoAdmissao,
  calendario: calendarioAdmissao,
}

const paginas = { home, institucional, contactos, cursos }

export default paginas
