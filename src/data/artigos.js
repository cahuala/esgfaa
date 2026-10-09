import Auditorio from '../assets/Auditorio.png'
import Curso1 from '../assets/Curso1.png'
import Curso3 from '../assets/Curso3.png'
import EscolaDeGuerra from '../assets/Escola De Guerra.png'

/*
  `autor` refere o id em data/pessoas.js.
  `capa` é opcional. `pdf` (opcional) é o caminho para a versão em PDF
  — por exemplo um ficheiro colocado em public/pdf/.
  `conteudo` usa os mesmos blocos das notícias (ver data/noticias.js).
*/
const artigos = [
  {
    slug: 'defesa-cooperativa-africa-austral',
    tipo: 'Artigo científico',
    area: 'Estratégia',
    titulo: 'Defesa cooperativa na África Austral: o papel das escolas de guerra',
    resumo: 'Analisa a forma como as instituições de ensino militar superior contribuem para a confiança mútua e a interoperabilidade entre forças armadas da região.',
    palavrasChave: ['SADC', 'cooperação', 'ensino militar', 'interoperabilidade'],
    autor: 'miguel-santos',
    data: '2026-09-20',
    capa: EscolaDeGuerra,
    conteudo: [
      { tipo: 'subtitulo', texto: 'Introdução' },
      { tipo: 'paragrafo', texto: 'A cooperação em matéria de defesa na África Austral assenta num quadro institucional que valoriza a confiança mútua entre Estados. As escolas de guerra ocupam neste quadro um lugar particular: são o espaço onde futuros comandantes de diferentes países se conhecem, partilham doutrina e aprendem a trabalhar em conjunto.' },
      { tipo: 'paragrafo', texto: 'Este artigo examina três mecanismos através dos quais o ensino militar superior contribui para a defesa cooperativa: o intercâmbio de alunos, a investigação conjunta e a harmonização doutrinária.' },
      { tipo: 'subtitulo', texto: 'Intercâmbio de alunos e docentes' },
      { tipo: 'paragrafo', texto: 'A presença de oficiais estrangeiros nos cursos de Estado-Maior cria redes pessoais e profissionais que perduram ao longo das carreiras. Estas redes facilitam a coordenação em operações multinacionais e em situações de crise.' },
      { tipo: 'imagem', src: Auditorio, legenda: 'Figura 1 — Sessão de abertura com oficiais nacionais e estrangeiros.' },
      { tipo: 'citacao', texto: 'A interoperabilidade começa na sala de aula, muito antes de começar no terreno.' },
      { tipo: 'subtitulo', texto: 'Investigação conjunta' },
      { tipo: 'paragrafo', texto: 'Projetos de investigação partilhados permitem construir uma leitura comum dos riscos regionais e identificar áreas prioritárias de cooperação, da segurança marítima à resposta a catástrofes.' },
      { tipo: 'subtitulo', texto: 'Conclusão' },
      { tipo: 'paragrafo', texto: 'As escolas de guerra são um instrumento discreto mas eficaz da defesa cooperativa. Reforçar o seu papel passa por alargar o intercâmbio, financiar investigação conjunta e institucionalizar a partilha de doutrina.' },
      { tipo: 'referencias', itens: [
        'Constituição da República de Angola (2010).',
        'Carta das Nações Unidas (1945).',
        'Tratado da Comunidade de Desenvolvimento da África Austral — SADC (1992).',
        'Protocolo da SADC sobre Cooperação nas Áreas de Política, Defesa e Segurança (2001).',
      ] },
    ],
  },
  {
    slug: 'lideranca-militar-seculo-xxi',
    tipo: 'Ensaio',
    area: 'Liderança',
    titulo: 'Liderança militar no século XXI: comandar em ambientes de incerteza',
    resumo: 'Reflexão sobre as competências de liderança exigidas aos oficiais num contexto de mudança tecnológica acelerada e de ameaças difusas.',
    palavrasChave: ['liderança', 'comando', 'tomada de decisão'],
    autor: 'isabel-fortunato',
    data: '2026-08-30',
    capa: Curso1,
    conteudo: [
      { tipo: 'paragrafo', texto: 'Comandar sempre significou decidir com informação incompleta. O que mudou foi a velocidade a que a informação chega, a quantidade de fontes disponíveis e a diversidade de atores envolvidos em cada decisão.' },
      { tipo: 'subtitulo', texto: 'Três competências essenciais' },
      { tipo: 'lista', ordenada: true, itens: [
        'Capacidade de síntese perante grandes volumes de informação.',
        'Delegação baseada na confiança e na intenção do comandante.',
        'Integridade como fundamento da autoridade.',
      ] },
      { tipo: 'destaque', titulo: 'Implicações para a formação', texto: 'Os cursos de Estado-Maior devem treinar a decisão sob pressão através de exercícios de simulação realistas, e não apenas transmitir conhecimento doutrinário.' },
      { tipo: 'paragrafo', texto: 'A liderança militar do século XXI exige, por isso, tanto rigor técnico como capacidade humana — e é na combinação de ambos que as escolas de guerra têm de investir.' },
    ],
  },
  {
    slug: 'direito-internacional-humanitario-operacoes',
    tipo: 'Artigo científico',
    area: 'Direito',
    titulo: 'O direito internacional humanitário no planeamento das operações',
    resumo: 'Propõe uma metodologia para integrar as regras do direito internacional humanitário em cada fase do processo de planeamento operacional.',
    palavrasChave: ['DIH', 'planeamento operacional', 'regras de empenhamento'],
    autor: 'jose-manuel',
    data: '2026-07-14',
    conteudo: [
      { tipo: 'paragrafo', texto: 'O cumprimento do direito internacional humanitário não é apenas uma obrigação legal: é também um fator de legitimidade e de eficácia operacional.' },
      { tipo: 'subtitulo', texto: 'Integração no processo de planeamento' },
      { tipo: 'paragrafo', texto: 'A metodologia proposta associa a cada fase do planeamento um conjunto de verificações jurídicas, conduzidas pelo assessor jurídico em articulação com o estado-maior.' },
      { tipo: 'lista', itens: [
        'Análise da missão: identificação do quadro jurídico aplicável.',
        'Desenvolvimento de modalidades de ação: avaliação de proporcionalidade.',
        'Ordens: redação das regras de empenhamento.',
      ] },
      { tipo: 'referencias', itens: [
        'Convenções de Genebra de 12 de agosto de 1949.',
        'Protocolos Adicionais às Convenções de Genebra (1977).',
      ] },
    ],
  },
  {
    slug: 'seguranca-maritima-golfo-guine',
    tipo: 'Artigo científico',
    area: 'Segurança marítima',
    titulo: 'Segurança marítima no Golfo da Guiné: desafios e respostas regionais',
    resumo: 'Caracteriza as principais ameaças à segurança marítima no Golfo da Guiné e avalia os mecanismos de resposta regional existentes.',
    palavrasChave: ['segurança marítima', 'Golfo da Guiné', 'cooperação naval'],
    autor: 'miguel-santos',
    data: '2026-06-10',
    capa: Curso3,
    conteudo: [
      { tipo: 'paragrafo', texto: 'O Golfo da Guiné é uma das regiões marítimas com maior relevância económica para os Estados costeiros africanos, mas também uma das mais expostas a ameaças transnacionais.' },
      { tipo: 'subtitulo', texto: 'Principais ameaças' },
      { tipo: 'lista', itens: [
        'Pirataria e assalto armado a navios.',
        'Pesca ilegal, não declarada e não regulamentada.',
        'Tráfico ilícito por via marítima.',
      ] },
      { tipo: 'paragrafo', texto: 'A resposta a estas ameaças exige partilha de informação, patrulhamento coordenado e formação conjunta das marinhas e guardas costeiras da região.' },
    ],
  },
  {
    slug: 'formacao-estado-maior-desafios',
    tipo: 'Opinião',
    area: 'Formação',
    titulo: 'O que deve mudar na formação de oficiais de Estado-Maior',
    resumo: 'Uma visão a partir da sala de aula sobre como adaptar o curso às exigências de um novo ambiente operacional.',
    palavrasChave: ['Estado-Maior', 'ensino', 'currículo'],
    autor: 'teresa-lopes',
    data: '2026-05-22',
    conteudo: [
      { tipo: 'paragrafo', texto: 'Ao longo de vários anos a coordenar o Curso de Estado-Maior, tenho visto chegar oficiais cada vez mais bem preparados tecnicamente, mas que precisam de mais oportunidades para praticar a decisão em equipa.' },
      { tipo: 'citacao', texto: 'Um bom oficial de Estado-Maior não é o que sabe todas as respostas, mas o que sabe fazer as perguntas certas ao comandante.' },
      { tipo: 'paragrafo', texto: 'Proponho por isso mais tempo dedicado a exercícios, mais avaliação entre pares e uma ligação mais próxima às unidades operacionais.' },
    ],
  },
]

artigos.sort((a, b) => b.data.localeCompare(a.data))

export function artigoPorSlug(slug) {
  return artigos.find((a) => a.slug === slug)
}

export default artigos
