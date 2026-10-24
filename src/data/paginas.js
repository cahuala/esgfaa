import Auditorio from '../assets/Auditorio.webp'
import Escola2 from '../assets/Escola2.jpeg'
import EscolaDeGuerra from '../assets/Escola De Guerra.webp'
import contactos from './contactos'
import privacidade from './privacidade'
import { calendarioAdmissao, processoAdmissao } from './cursos'

/*
  Conteúdos fixos de cada página. São os valores de origem: a API carrega-os
  na base de dados no primeiro arranque e, a partir daí, editam-se no painel.
  ATENÇÃO: textos da História, cronologia e valores são provisórios.
*/

const home = {
  hero: {
    titulo: 'Formar quem defende Angola, desde o primeiro dia.',
    texto: 'Conheça os cursos e programas da Escola Superior de Guerra e as publicações do seu corpo docente.',
    imagem: Auditorio,
    metricas: [
      { valor: '32.º', legenda: 'Curso Superior de Comando e Direcção' },
      { valor: '04', legenda: 'Cursos de formação superior' },
    ],
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
      { tipo: 'Comunicado', data: '2026-09-18', titulo: 'Novo número da Revista da Escola Superior de Guerra', resumo: 'Já está disponível no site, para leitura livre, o novo número da revista da Escola.', importante: false },
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
      { pergunta: 'Como se ingressa num curso da Escola?', resposta: 'O ingresso é feito por proposta do ramo de origem: a Repartição de Pessoal e Quadros regista os oficiais admitidos e a Secretaria Académica informa as datas das provas e o início do curso. O processo de admissão está descrito na página de Cursos.' },
      { pergunta: 'Quais são os requisitos de admissão?', resposta: 'Os requisitos variam consoante o curso pretendido — normalmente incluem posto militar mínimo, habilitações académicas e tempo de serviço. Consulte a página de cada curso, na secção "Requisitos de admissão", para os critérios específicos.' },
      { pergunta: 'Como aceder a documentos públicos da Escola?', resposta: 'Todos os documentos de acesso público — regulamentos, editais, relatórios e publicações — estão disponíveis na secção "Publicações e Documentos", com pesquisa por categoria, ano e tipo de documento.' },
      { pergunta: 'Como contactar um departamento específico?', resposta: 'Na página de Contactos encontra os meios de contacto gerais da Escola. Para departamentos específicos, consulte a secção "Organização e Estrutura" em Institucional, onde estão listados os responsáveis de cada área.' },
      { pergunta: 'A Escola oferece programas de cooperação internacional?', resposta: 'Sim. A Escola mantém acordos de cooperação com instituições militares parceiras, incluindo intercâmbio de docentes, alunos e projetos conjuntos de investigação. Mais informação na secção de Cooperação Internacional.' },
      { pergunta: 'Onde posso consultar o calendário académico?', resposta: 'O calendário com o início e fim dos cursos, períodos letivos, exames e outros eventos institucionais está disponível na Agenda Académica, acessível a partir do menu principal.' },
    ],
  },
  cta: {
    titulo: 'Pronto para dar o próximo passo na sua carreira militar?',
    texto: 'Conheça os cursos da Escola Superior de Guerra, que preparam oficiais para funções de comando e liderança.',
    botao: 'Conhecer o processo de admissão',
  },
}

const institucional = {
  entrada: 'A Escola Superior de Guerra forma os oficiais que planeiam, comandam e dirigem as Forças Armadas Angolanas — e produz o pensamento estratégico que os acompanha.',
  imagemSede: EscolaDeGuerra,
  legendaSede: 'Escola Superior de Guerra das Forças Armadas Angolanas, Luanda.',
  numeros: [
    // tirados dos planos de curso de 2026/2027 (a edição em curso de cada curso)
    { valor: '+30', legenda: 'Edições do Curso Superior de Comando e Direcção' },
    { valor: '+60', legenda: 'Edições de cursos concluídas' },
    { valor: '04', legenda: 'Cursos de formação superior' },
    { valor: '03', legenda: 'Ramos das FAA, com a Polícia Nacional' },
  ],
  historia: {
    titulo: 'Gerações de oficiais formados para comandar.',
    imagem: Escola2,
    legenda: 'Sessão solene no auditório principal.',
    paragrafos: [
      'A Escola Superior de Guerra das Forças Armadas Angolanas nasceu da necessidade de formar, em Angola, os oficiais destinados às mais altas funções de comando, direção e estado-maior, reduzindo a dependência da formação no estrangeiro e adaptando o ensino à realidade nacional.',
      'Desde então, a Escola consolidou-se como o principal estabelecimento de ensino superior militar do país. O seu modelo combina a formação doutrinária com a investigação científica e a cooperação com instituições congéneres, num ambiente em que oficiais dos três ramos aprendem a planear e a decidir em conjunto.',
      'Ao longo dos anos, os cursos foram sendo revistos para acompanhar a evolução das ameaças, da tecnologia e das missões das Forças Armadas, mantendo como referência os valores que definem a condição militar.',
    ],
    marcos: [
      // só o que vem dos planos de curso (directivas e edições); as datas de criação confirma-as a Escola
      { ano: '2014', titulo: 'Curso de Estratégia e Arte Operativa', texto: 'Aprovado pela Directiva n.º 10/22/07/CEMGFAA/2014, para a formação de oficiais generais e superiores em estratégia e arte operativa.' },
      { ano: '2025', titulo: 'Curso de Estado-Maior Conjunto', texto: 'Primeira edição do curso que habilita os oficiais superiores das FAA e da Polícia Nacional para funções de estado-maior ao nível operacional.' },
      { ano: '2026', titulo: '32.º Curso Superior de Comando e Direcção', texto: 'O curso mais antigo da Escola chega à 32.ª edição, a par do 18.º Curso de Estratégia e Arte Operativa.' },
      { ano: '2026', titulo: '12.º Curso de Organização do Asseguramento Moral e Psicológico', texto: 'Formação dos oficiais para a educação patriótica e o asseguramento moral e psicológico das tropas.' },
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
    // o organograma: cada órgão diz de quem depende (vazio = topo) e se é de linha ou de apoio
    orgaos: [
      { nome: 'Comando da Escola', sigla: '', responsavel: 'carlos-vieira', dependeDe: '', tipo: 'linha', texto: 'Dirige a Escola e define as orientações estratégicas.', ligacao: '' },
      { nome: 'Gabinete do Comandante', sigla: '', responsavel: '', dependeDe: 'Comando da Escola', tipo: 'apoio', texto: 'Apoio directo ao Comando e expediente.', ligacao: '' },
      { nome: 'Gabinete de Comunicação', sigla: '', responsavel: '', dependeDe: 'Comando da Escola', tipo: 'apoio', texto: 'Imprensa, eventos, publicações e redes sociais.', ligacao: '/Noticias' },
      { nome: 'Direção de Ensino', sigla: '', responsavel: 'ana-baptista', dependeDe: 'Comando da Escola', tipo: 'linha', texto: 'Planeia os cursos, os planos curriculares e a avaliação.', ligacao: '/Cursos' },
      { nome: 'Corpo Docente', sigla: '', responsavel: 'isabel-fortunato', dependeDe: 'Direção de Ensino', tipo: 'linha', texto: 'Docentes militares e civis.', ligacao: '' },
      { nome: 'Secretaria Académica', sigla: '', responsavel: '', dependeDe: 'Direção de Ensino', tipo: 'linha', texto: 'Matrículas, certificados e calendário.', ligacao: '' },
      { nome: 'Departamento de Investigação', sigla: '', responsavel: 'miguel-santos', dependeDe: 'Comando da Escola', tipo: 'linha', texto: 'Estratégia, segurança e defesa.', ligacao: '/Artigos' },
      { nome: 'Cooperação Internacional', sigla: '', responsavel: 'jose-manuel', dependeDe: 'Comando da Escola', tipo: 'linha', texto: 'Protocolos e intercâmbio com instituições parceiras.', ligacao: '' },
      { nome: 'Serviços de Apoio', sigla: '', responsavel: '', dependeDe: 'Comando da Escola', tipo: 'linha', texto: 'Logística, instalações e recursos administrativos.', ligacao: '' },
    ],
    ramos: [
      { titulo: 'Ensino', orgaos: [
        { nome: 'Direção de Ensino', texto: 'Planeia os cursos, os planos curriculares e a avaliação.' },
        { nome: 'Corpo Docente', texto: 'Docentes militares e civis responsáveis pela formação.' },
        { nome: 'Secretaria Académica', texto: 'Matrículas, certificados e calendário.' },
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
  entrada: 'Quatro cursos de formação superior para cada etapa da carreira de oficial — do estado-maior conjunto à estratégia, ao comando e direcção e ao asseguramento moral e psicológico.',
  anoAcademico: '2027',
  processo: processoAdmissao,
  calendario: calendarioAdmissao,
}

// fotografias do topo das secções: vazio = as que vêm com o site (components/CabecalhoEditorial/imagensTopo.js)
const cabecalhos = {}

const paginas = { home, institucional, contactos, cursos, privacidade, cabecalhos }

export default paginas
