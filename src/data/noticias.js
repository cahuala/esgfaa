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
    imagem     { src, legenda, posicao? }
               posicao: 'esquerda' | 'direita' — o texto contorna a imagem (como no Word)
                        'centro' (predefinição) — ocupa a largura do texto
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
      { tipo: 'imagem', src: Curso2, legenda: 'Oficiais alunos na primeira sessão do ano académico.', posicao: 'direita' },
      { tipo: 'paragrafo', texto: 'A sessão foi presidida pelo Comandante da Escola, que deu as boas-vindas aos oficiais que agora iniciam os cursos de Estado-Maior, de Promoção a Oficial General e de Altos Estudos Militares. Na plateia estiveram também os oficiais que concluíram a formação no ano anterior e que foram convidados a partilhar a sua experiência com os novos alunos.' },
      { tipo: 'paragrafo', texto: 'O programa da cerimónia incluiu a apresentação do corpo docente, a leitura do regulamento académico e a assinatura simbólica do compromisso de honra pelos representantes de cada curso. No final, os alunos foram recebidos pelos coordenadores dos respetivos cursos para uma primeira reunião de enquadramento.' },
      { tipo: 'subtitulo', texto: 'Um ano centrado na liderança e na investigação' },
      { tipo: 'imagem', src: Auditorio, legenda: 'O auditório principal recebeu alunos, docentes e convidados.', posicao: 'esquerda' },
      { tipo: 'paragrafo', texto: 'No discurso de abertura, o Comandante sublinhou que o novo ano letivo reforça a componente de investigação aplicada e a ligação entre a formação académica e as necessidades operacionais das Forças Armadas. Cada curso passa a incluir um seminário de investigação obrigatório, orientado por docentes do Departamento de Investigação.' },
      { tipo: 'paragrafo', texto: 'Foi também anunciado o alargamento do programa de exercícios de planeamento, que coloca os alunos perante cenários realistas de crise e os obriga a trabalhar em estados-maiores, a decidir sob pressão e a apresentar as suas conclusões perante oficiais generais.' },
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
      { tipo: 'imagem', src: EscolaDeGuerra, legenda: 'Instalações da Escola Superior de Guerra, em Luanda.', posicao: 'esquerda' },
      { tipo: 'paragrafo', texto: 'O acordo, com a duração inicial de três anos, define as áreas em que as duas instituições vão trabalhar em conjunto e as condições de mobilidade de docentes e alunos. Prevê ainda a criação de uma comissão mista que se reunirá uma vez por ano para avaliar a execução do protocolo e propor novas ações.' },
      { tipo: 'paragrafo', texto: 'Para a Escola, este acordo representa mais um passo na estratégia de abertura internacional, que procura expor os oficiais alunos a outras doutrinas, outras formas de planeamento e outras realidades operacionais.' },
      { tipo: 'destaque', titulo: 'O que prevê o protocolo', texto: 'Intercâmbio de docentes e oficiais alunos, projetos conjuntos de investigação, partilha de doutrina e participação recíproca em seminários e exercícios académicos.' },
      { tipo: 'subtitulo', texto: 'Eixos de cooperação' },
      { tipo: 'lista', ordenada: true, itens: [
        'Mobilidade de docentes para módulos de curta duração.',
        'Vagas reservadas para oficiais alunos nos cursos de cada instituição.',
        'Investigação conjunta em estratégia, segurança e defesa.',
        'Publicações e conferências organizadas em parceria.',
      ] },
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
      { tipo: 'imagem', src: Curso2, legenda: 'Formandos durante a cerimónia de encerramento do curso.', posicao: 'direita' },
      { tipo: 'paragrafo', texto: 'Durante a cerimónia foram distinguidos os oficiais com melhor classificação final e os autores dos trabalhos de investigação de maior mérito. Os trabalhos premiados serão publicados ao longo do próximo semestre na secção de Artigos.' },
      { tipo: 'paragrafo', texto: 'O Comandante felicitou os formandos e as suas famílias, lembrando que o diploma agora entregue é o reconhecimento de um percurso exigente, feito de estudo, exercícios e avaliação permanente.' },
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
      { tipo: 'imagem', src: Curso3, legenda: 'Participantes durante um dos painéis da conferência.', posicao: 'esquerda' },
      { tipo: 'paragrafo', texto: 'Ao longo do dia, oradores nacionais e estrangeiros apresentaram análises sobre as principais ameaças à estabilidade regional e discutiram mecanismos de resposta conjunta. O debate com a plateia, composta por oficiais alunos, docentes e convidados, prolongou-se para além do horário previsto.' },
      { tipo: 'subtitulo', texto: 'Três painéis, um objetivo comum' },
      { tipo: 'lista', itens: [
        'Segurança marítima e proteção de rotas comerciais.',
        'Cooperação regional em operações de paz.',
        'Ameaças transnacionais e partilha de informação.',
      ] },
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
      { tipo: 'imagem', src: Escola2, legenda: 'A delegação durante a visita às instalações.', posicao: 'direita' },
      { tipo: 'paragrafo', texto: 'A visita serviu para preparar futuras ações de intercâmbio e conhecer os programas de formação de cada instituição. Os dois lados identificaram áreas de interesse comum, nomeadamente o planeamento operacional e o direito internacional humanitário.' },
      { tipo: 'paragrafo', texto: 'No final, a delegação foi recebida pelo Comandante da Escola, com quem trocou lembranças institucionais.' },
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
      { tipo: 'imagem', src: Curso1, legenda: 'Apresentação de um trabalho final perante o júri.', posicao: 'esquerda' },
      { tipo: 'paragrafo', texto: 'Os temas abrangeram estratégia militar, logística, direito internacional humanitário e cooperação regional. Cada apresentação foi seguida de um período de perguntas do júri e da plateia, num formato próximo das provas académicas universitárias.' },
      { tipo: 'destaque', texto: 'Os melhores trabalhos serão publicados na secção de Artigos ao longo do próximo semestre.' },
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
      { tipo: 'imagem', src: Curso1, legenda: 'Oficiais alunos durante a fase de planeamento.', posicao: 'direita' },
      { tipo: 'paragrafo', texto: 'Organizados em estados-maiores, os alunos elaboraram planos de resposta que foram depois avaliados por um painel de oficiais generais. O exercício decorreu ao longo de uma semana, com informações novas a chegar a cada dia para obrigar as equipas a rever as suas decisões.' },
    ],
  },
  {
    slug: 'portas-abertas-estudantes',
    categoria: 'Institucional',
    titulo: 'Jornada de portas abertas recebe estudantes universitários',
    resumo: 'Estudantes de relações internacionais conheceram a Escola e assistiram a uma aula aberta.',
    data: '2026-05-15',
    autor: 'Gabinete de Comunicação',
    capa: Escola2,
    conteudo: [
      { tipo: 'paragrafo', texto: 'A Escola abriu as portas a estudantes universitários de cursos de relações internacionais e ciência política, numa jornada que incluiu uma visita às instalações e uma aula aberta sobre estratégia.' },
      { tipo: 'imagem', src: EscolaDeGuerra, legenda: 'Entrada principal da Escola.', posicao: 'esquerda' },
      { tipo: 'paragrafo', texto: 'A iniciativa pretende aproximar a Escola da comunidade académica civil e dar a conhecer o trabalho de investigação que aqui se desenvolve em matérias de segurança e defesa.' },
    ],
  },
  {
    slug: 'curso-lideranca-estrategica',
    categoria: 'Formação',
    titulo: 'Arranca curso intensivo de liderança estratégica',
    resumo: 'Formação de curta duração destina-se a oficiais superiores em funções de comando.',
    data: '2026-04-28',
    autor: 'Direção de Ensino',
    capa: Curso2,
    conteudo: [
      { tipo: 'paragrafo', texto: 'Teve início o curso intensivo de liderança estratégica, uma formação de curta duração dirigida a oficiais superiores que exercem funções de comando.' },
      { tipo: 'imagem', src: Curso3, legenda: 'Sessão de trabalho do curso intensivo.', posicao: 'direita' },
      { tipo: 'paragrafo', texto: 'O programa combina sessões teóricas sobre tomada de decisão e gestão de crises com estudos de caso e exercícios em grupo, orientados por docentes da Escola e por convidados com experiência de comando.' },
    ],
  },
  {
    slug: 'ciclo-conferencias-atlantico-sul',
    categoria: 'Conferências',
    titulo: 'Ciclo de conferências debate a geopolítica do Atlântico Sul',
    resumo: 'Primeira sessão do ciclo analisou a importância estratégica das rotas marítimas.',
    data: '2026-03-30',
    autor: 'Departamento de Investigação',
    capa: Auditorio,
    conteudo: [
      { tipo: 'paragrafo', texto: 'A Escola inaugurou um ciclo de conferências dedicado à geopolítica do Atlântico Sul, com uma primeira sessão sobre a importância estratégica das rotas marítimas para os Estados costeiros africanos.' },
      { tipo: 'imagem', src: Curso2, legenda: 'Plateia da primeira sessão do ciclo.', posicao: 'esquerda' },
      { tipo: 'paragrafo', texto: 'O ciclo prolonga-se até ao final do ano, com uma sessão mensal aberta a oficiais, docentes, investigadores e convidados institucionais.' },
    ],
  },
  {
    slug: 'nova-revista-cientifica',
    categoria: 'Investigação',
    titulo: 'Departamento de Investigação prepara nova revista científica',
    resumo: 'Publicação semestral vai divulgar estudos em estratégia, segurança e defesa.',
    data: '2026-02-12',
    autor: 'Departamento de Investigação',
    capa: Curso3,
    conteudo: [
      { tipo: 'paragrafo', texto: 'O Departamento de Investigação está a preparar o lançamento de uma revista científica semestral, dedicada a estudos em estratégia, segurança e defesa.' },
      { tipo: 'paragrafo', texto: 'A revista terá revisão por pares e estará aberta a contributos de docentes, investigadores, oficiais alunos e autores externos.' },
    ],
  },
  {
    slug: 'encerramento-ano-academico-2025',
    categoria: 'Cerimónias',
    titulo: 'Cerimónia encerra o ano académico 2025',
    resumo: 'Balanço do ano destacou o crescimento da investigação e da cooperação internacional.',
    data: '2025-12-11',
    autor: 'Gabinete de Comunicação',
    capa: Curso1,
    conteudo: [
      { tipo: 'paragrafo', texto: 'A Escola encerrou oficialmente o ano académico 2025 numa cerimónia em que foi apresentado o balanço das atividades de formação, investigação e cooperação.' },
      { tipo: 'imagem', src: Auditorio, legenda: 'Cerimónia de encerramento do ano académico.', posicao: 'direita' },
      { tipo: 'paragrafo', texto: 'Foram também homenageados os docentes e funcionários que se destacaram ao longo do ano, num momento que encerrou um ciclo de trabalho e abriu caminho à preparação do ano seguinte.' },
    ],
  },
  {
    slug: 'protocolo-investigacao-universidade',
    categoria: 'Cooperação',
    titulo: 'Escola assina protocolo de investigação com universidade nacional',
    resumo: 'Acordo permite projetos conjuntos e a coorientação de trabalhos finais.',
    data: '2025-11-06',
    autor: 'Gabinete de Comunicação',
    capa: EscolaDeGuerra,
    conteudo: [
      { tipo: 'paragrafo', texto: 'A Escola assinou um protocolo de investigação com uma universidade nacional que permite o desenvolvimento de projetos conjuntos e a coorientação de trabalhos finais de curso.' },
      { tipo: 'paragrafo', texto: 'O acordo reforça a ligação entre o ensino superior militar e o ensino superior civil em áreas de interesse comum, como as relações internacionais e o direito.' },
    ],
  },
]

// mais recentes primeiro
noticias.sort((a, b) => b.data.localeCompare(a.data))

export function noticiaPorSlug(slug) {
  return noticias.find((n) => n.slug === slug)
}

export const temVideo = (n) => n.conteudo.some((b) => b.tipo === 'video')
export const temGaleria = (n) => n.conteudo.some((b) => b.tipo === 'galeria')

export default noticias
