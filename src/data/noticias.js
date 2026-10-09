import Auditorio from '../assets/Auditorio.png'
import CarlosVieira from '../assets/CarlosVieira.png'
import Curso1 from '../assets/Curso1.png'
import Curso2 from '../assets/Curso2.png'
import Curso3 from '../assets/Curso3.png'
import Escola2 from '../assets/Escola2.jpeg'
import EscolaDeGuerra from '../assets/Escola De Guerra.png'
import Foto2 from '../assets/Foto2.jpg'
import Foto5 from '../assets/Foto5.jpg'
import ZeGrande from '../assets/Zé Grande.jpg'

/*
  Cada notícia tem uma imagem de capa e um `conteudo` feito de blocos.
  Tipos de bloco disponíveis (ver components/ConteudoRico):
    paragrafo  { texto }
    subtitulo  { texto }
    imagem     { src, legenda, larga? }
    galeria    { imagens: [{ src, legenda }], legenda? }
    video      { youtube: 'ID' }  ou  { src: 'ficheiro.mp4', poster? }  + legenda?
    citacao    { texto, autor? }
    lista      { itens: [], ordenada? }
    destaque   { titulo?, texto }
*/
const noticias = [
  {
    slug: 'abertura-ano-academico-2026',
    categoria: 'Institucional',
    titulo: 'Cerimónia de abertura do ano académico 2026',
    resumo: 'A Escola recebeu mais de 200 novos alunos na cerimónia oficial de abertura do ano letivo.',
    data: '2026-09-12',
    autor: 'Gabinete de Comunicação',
    capa: CarlosVieira,
    destaque: true,
    conteudo: [
      { tipo: 'paragrafo', texto: 'A Escola Superior de Guerra das Forças Armadas Angolanas deu início ao ano académico 2026 numa cerimónia que reuniu, no auditório principal, mais de 200 novos alunos, o corpo docente, entidades convidadas e representantes de escolas militares parceiras.' },
      { tipo: 'paragrafo', texto: 'A sessão foi presidida pelo Comandante da Escola, que deu as boas-vindas aos oficiais que agora iniciam os cursos de Estado-Maior, de Promoção a Oficial General e de Altos Estudos Militares.' },
      { tipo: 'imagem', src: Auditorio, legenda: 'O auditório principal recebeu alunos, docentes e convidados.', larga: true },
      { tipo: 'subtitulo', texto: 'Um ano centrado na liderança e na investigação' },
      { tipo: 'paragrafo', texto: 'No discurso de abertura, o Comandante sublinhou que o novo ano letivo reforça a componente de investigação aplicada e a ligação entre a formação académica e as necessidades operacionais das Forças Armadas.' },
      { tipo: 'citacao', texto: 'Formar quem comanda é formar quem decide. Cada oficial que passa por esta Escola leva consigo a responsabilidade de servir Angola com competência e integridade.', autor: 'Gen. Carlos Vieira, Comandante da Escola' },
      { tipo: 'video', src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', poster: Auditorio, legenda: 'Vídeo de demonstração — substituir pelo vídeo oficial da cerimónia.' },
      { tipo: 'subtitulo', texto: 'Novidades do ano académico' },
      { tipo: 'lista', itens: [
        'Reforço do programa de seminários de investigação científica.',
        'Novas unidades curriculares de cooperação e diplomacia de defesa.',
        'Alargamento do intercâmbio de docentes com escolas parceiras.',
      ] },
      { tipo: 'galeria', legenda: 'Momentos da cerimónia de abertura.', imagens: [
        { src: Curso1, legenda: 'Oficiais alunos na sessão solene.' },
        { src: Curso2, legenda: 'Entidades convidadas na primeira fila.' },
        { src: Curso3, legenda: 'Momento protocolar da cerimónia.' },
      ] },
      { tipo: 'paragrafo', texto: 'As aulas dos três cursos começam na semana seguinte à cerimónia. O calendário académico completo está disponível na Secretaria Académica.' },
    ],
  },
  {
    slug: 'acordo-cooperacao-escola-parceira',
    categoria: 'Cooperação',
    titulo: 'Novo acordo de cooperação assinado com escola parceira',
    resumo: 'Protocolo prevê intercâmbio de docentes e alunos a partir do próximo ano letivo.',
    data: '2026-08-28',
    autor: 'Gabinete de Comunicação',
    capa: Foto2,
    conteudo: [
      { tipo: 'paragrafo', texto: 'A Escola Superior de Guerra assinou um novo protocolo de cooperação com uma escola militar parceira, alargando a rede de instituições com as quais mantém programas de intercâmbio.' },
      { tipo: 'paragrafo', texto: 'O acordo, com a duração inicial de três anos, define as áreas em que as duas instituições vão trabalhar em conjunto e as condições de mobilidade de docentes e alunos.' },
      { tipo: 'destaque', titulo: 'O que prevê o protocolo', texto: 'Intercâmbio de docentes e oficiais alunos, projetos conjuntos de investigação, partilha de doutrina e participação recíproca em seminários e exercícios académicos.' },
      { tipo: 'subtitulo', texto: 'Eixos de cooperação' },
      { tipo: 'lista', ordenada: true, itens: [
        'Mobilidade de docentes para módulos de curta duração.',
        'Vagas reservadas para oficiais alunos nos cursos de cada instituição.',
        'Investigação conjunta em estratégia, segurança e defesa.',
        'Publicações e conferências organizadas em parceria.',
      ] },
      { tipo: 'imagem', src: EscolaDeGuerra, legenda: 'Instalações da Escola Superior de Guerra, em Luanda.' },
      { tipo: 'paragrafo', texto: 'Com este acordo, a Escola passa a contar com mais de 20 protocolos ativos com instituições de ensino militar.' },
    ],
  },
  {
    slug: 'formatura-estado-maior-2026',
    categoria: 'Cerimónias',
    titulo: 'Formatura da turma de Estado-Maior 2026',
    resumo: 'Mais de 60 oficiais concluíram o curso numa cerimónia presidida pelo Comandante.',
    data: '2026-08-15',
    autor: 'Gabinete de Comunicação',
    capa: Foto5,
    conteudo: [
      { tipo: 'paragrafo', texto: 'Mais de 60 oficiais concluíram o Curso de Estado-Maior numa cerimónia que marcou o fim de dois anos de formação em planeamento, comando e assessoria.' },
      { tipo: 'paragrafo', texto: 'Durante a cerimónia foram distinguidos os oficiais com melhor classificação final e os autores dos trabalhos de investigação de maior mérito.' },
      { tipo: 'citacao', texto: 'Hoje não termina uma formação — começa uma nova responsabilidade.', autor: 'Mensagem do Comandante aos formandos' },
      { tipo: 'galeria', imagens: [
        { src: Curso2, legenda: 'Formandos durante a cerimónia.' },
        { src: Auditorio, legenda: 'O auditório completo para a formatura.' },
      ] },
      { tipo: 'paragrafo', texto: 'Os novos oficiais de Estado-Maior vão agora assumir funções em comandos e estados-maiores das Forças Armadas Angolanas.' },
    ],
  },
  {
    slug: 'conferencia-seguranca-regional',
    categoria: 'Conferências',
    titulo: 'Conferência sobre segurança regional reúne especialistas',
    resumo: 'Evento contou com a participação de convidados de escolas militares de vários países.',
    data: '2026-08-02',
    autor: 'Gabinete de Comunicação',
    capa: ZeGrande,
    conteudo: [
      { tipo: 'paragrafo', texto: 'A Escola acolheu uma conferência dedicada aos desafios de segurança na região, com painéis sobre segurança marítima, cooperação entre forças armadas e gestão de crises.' },
      { tipo: 'subtitulo', texto: 'Três painéis, um objetivo comum' },
      { tipo: 'lista', itens: [
        'Segurança marítima e proteção de rotas comerciais.',
        'Cooperação regional em operações de paz.',
        'Ameaças transnacionais e partilha de informação.',
      ] },
      { tipo: 'imagem', src: Curso3, legenda: 'Participantes durante um dos painéis da conferência.', larga: true },
      { tipo: 'paragrafo', texto: 'As conclusões da conferência serão publicadas na secção de Artigos e servirão de base a novos trabalhos do Departamento de Investigação.' },
    ],
  },
  {
    slug: 'visita-delegacao-estrangeira',
    categoria: 'Cooperação',
    titulo: 'Delegação estrangeira visita as instalações da Escola',
    resumo: 'Visita incluiu reuniões de trabalho com a direção e uma apresentação dos cursos.',
    data: '2026-07-20',
    autor: 'Gabinete de Comunicação',
    capa: EscolaDeGuerra,
    conteudo: [
      { tipo: 'paragrafo', texto: 'Uma delegação de uma escola militar estrangeira esteve de visita à Escola Superior de Guerra, num programa que incluiu reuniões com a direção e uma visita às salas de aula e à biblioteca.' },
      { tipo: 'paragrafo', texto: 'A visita serviu para preparar futuras ações de intercâmbio e conhecer os programas de formação de cada instituição.' },
      { tipo: 'imagem', src: Escola2, legenda: 'A delegação durante a visita às instalações.' },
    ],
  },
  {
    slug: 'seminario-investigacao-cientifica',
    categoria: 'Investigação',
    titulo: 'Seminário apresenta os trabalhos de investigação dos alunos',
    resumo: 'Oficiais alunos apresentaram os resultados dos seus trabalhos finais perante um júri.',
    data: '2026-07-05',
    autor: 'Departamento de Investigação',
    capa: Curso3,
    conteudo: [
      { tipo: 'paragrafo', texto: 'O seminário anual de investigação reuniu os oficiais alunos dos três cursos para a apresentação pública dos trabalhos finais.' },
      { tipo: 'destaque', texto: 'Os melhores trabalhos serão publicados na secção de Artigos ao longo do próximo semestre.' },
      { tipo: 'paragrafo', texto: 'Os temas abrangeram estratégia militar, logística, direito internacional humanitário e cooperação regional.' },
    ],
  },
  {
    slug: 'biblioteca-renovada',
    categoria: 'Institucional',
    titulo: 'Biblioteca da Escola reabre com novo espaço de estudo',
    resumo: 'Obras de requalificação criaram salas de estudo em grupo e um arquivo digital.',
    data: '2026-06-18',
    autor: 'Gabinete de Comunicação',
    capa: Escola2,
    conteudo: [
      { tipo: 'paragrafo', texto: 'A biblioteca da Escola reabriu após obras de requalificação que criaram novas salas de estudo em grupo e um arquivo digital de teses e publicações.' },
      { tipo: 'lista', itens: [
        'Salas de estudo em grupo com reserva prévia.',
        'Arquivo digital de trabalhos finais de curso.',
        'Horário alargado durante os períodos de avaliação.',
      ] },
    ],
  },
  {
    slug: 'exercicio-planeamento-estrategico',
    categoria: 'Formação',
    titulo: 'Exercício de planeamento estratégico encerra o semestre',
    resumo: 'Durante uma semana, os alunos simularam a resposta a uma crise regional.',
    data: '2026-06-02',
    autor: 'Gabinete de Comunicação',
    capa: Curso1,
    conteudo: [
      { tipo: 'paragrafo', texto: 'O exercício de planeamento estratégico, que encerra o semestre do Curso de Estado-Maior, colocou os alunos perante um cenário de crise regional simulada.' },
      { tipo: 'paragrafo', texto: 'Organizados em estados-maiores, os alunos elaboraram planos de resposta que foram depois avaliados por um painel de oficiais generais.' },
      { tipo: 'imagem', src: Curso1, legenda: 'Oficiais alunos durante a fase de planeamento.' },
    ],
  },
]

// mais recentes primeiro
noticias.sort((a, b) => b.data.localeCompare(a.data))

export function noticiaPorSlug(slug) {
  return noticias.find((n) => n.slug === slug)
}

export default noticias
