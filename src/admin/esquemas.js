/*
  Definição dos formulários do painel.
  Cada campo: { nome, rotulo, tipo, obrigatorio?, ajuda?, largura?, opcoes?, campos?, ... }
  `nome` pode ser um caminho com pontos ("hero.titulo") para editar objetos dentro de objetos.

  Tipos: texto, textarea, data, hora, numero, booleano, selecao, sugestoes (texto com lista),
         imagem, ficheiro, video, youtube, listaTexto, objetos (lista de sub-formulários), blocos.
*/

import { TAMANHOS } from './imagens'
import { t as tx } from '../i18n/linguas'

// ---------- blocos do conteúdo (corpo das notícias, artigos e eventos) ----------

export const TIPOS_BLOCO = {
  texto: { rotulo: tx('Texto formatado'), icone: 'fa-file-alt', campos: [{ nome: 'html', rotulo: tx('Texto'), tipo: 'textoRico' }] },
  paragrafo: { rotulo: tx('Parágrafo simples'), icone: 'fa-align-left', campos: [{ nome: 'texto', rotulo: tx('Texto'), tipo: 'textarea', linhas: 5 }] },
  subtitulo: { rotulo: tx('Subtítulo'), icone: 'fa-heading', campos: [{ nome: 'texto', rotulo: tx('Subtítulo'), tipo: 'texto' }] },
  imagem: {
    rotulo: tx('Imagem'), icone: 'fa-image',
    campos: [
      { nome: 'src', rotulo: tx('Imagem'), tipo: 'imagem', recomendado: TAMANHOS.texto },
      { nome: 'legenda', rotulo: tx('Legenda'), tipo: 'texto', largura: 'metade' },
      {
        nome: 'posicao', rotulo: tx('Posição no texto'), tipo: 'selecao', largura: 'metade',
        opcoes: [
          { valor: 'centro', rotulo: tx('Centro — largura do texto') },
          { valor: 'esquerda', rotulo: tx('Esquerda — texto à volta') },
          { valor: 'direita', rotulo: tx('Direita — texto à volta') },
          { valor: 'larga', rotulo: tx('Larga — sai da coluna') },
        ],
      },
    ],
  },
  galeria: {
    rotulo: tx('Galeria'), icone: 'fa-images',
    campos: [
      { nome: 'imagens', rotulo: tx('Imagens'), tipo: 'objetos', rotuloItem: tx('Imagem'), campos: [
        { nome: 'src', rotulo: tx('Imagem'), tipo: 'imagem', recomendado: TAMANHOS.texto },
        { nome: 'legenda', rotulo: tx('Legenda'), tipo: 'texto' },
      ] },
      { nome: 'legenda', rotulo: tx('Legenda da galeria'), tipo: 'texto' },
    ],
  },
  video: {
    rotulo: tx('Vídeo'), icone: 'fa-video',
    campos: [
      { nome: 'youtube', rotulo: tx('Vídeo do YouTube'), tipo: 'youtube', ajuda: tx('Cole o endereço do vídeo do YouTube — ou deixe vazio e carregue um ficheiro abaixo.') },
      { nome: 'src', rotulo: tx('Ficheiro de vídeo (MP4)'), tipo: 'video', largura: 'metade' },
      { nome: 'poster', rotulo: tx('Imagem de capa do vídeo'), tipo: 'imagem', largura: 'metade', recomendado: TAMANHOS.poster },
      { nome: 'legenda', rotulo: tx('Legenda'), tipo: 'texto' },
    ],
  },
  citacao: {
    rotulo: tx('Citação'), icone: 'fa-quote-left',
    campos: [
      { nome: 'texto', rotulo: tx('Citação'), tipo: 'textarea', linhas: 3 },
      { nome: 'autor', rotulo: tx('Autor'), tipo: 'texto' },
    ],
  },
  lista: {
    rotulo: tx('Lista'), icone: 'fa-list-ul',
    campos: [
      { nome: 'itens', rotulo: tx('Itens'), tipo: 'listaTexto' },
      { nome: 'ordenada', rotulo: tx('Lista numerada'), tipo: 'booleano' },
    ],
  },
  destaque: {
    rotulo: tx('Caixa de destaque'), icone: 'fa-square',
    campos: [
      { nome: 'titulo', rotulo: tx('Título (opcional)'), tipo: 'texto' },
      { nome: 'texto', rotulo: tx('Texto'), tipo: 'textarea', linhas: 3 },
    ],
  },
  referencias: {
    rotulo: tx('Referências'), icone: 'fa-book',
    campos: [{ nome: 'itens', rotulo: tx('Referências bibliográficas'), tipo: 'listaTexto' }],
  },
}

// ---------- coleções ----------

export const COLECOES = {
  noticias: {
    titulo: tx('Notícias'), singular: tx('notícia'), botaoNovo: tx('Nova notícia'), feminino: true,
    // edição em modo documento: estes campos vão para a folha; os restantes para a coluna lateral
    documento: { etiqueta: 'categoria', titulo: 'titulo', entrada: 'resumo', capa: 'capa', corpo: 'conteudo', placeholderTitulo: tx('Título da notícia'), endereco: 'Noticias' }, icone: 'fa-newspaper', chave: 'slug', campoTitulo: 'titulo',
    rotaSite: (i) => `/Noticias/${i.slug}`,
    colunas: [
      { rotulo: '', tipo: 'imagem', valor: (i) => i.capa },
      { rotulo: tx('Título'), valor: (i) => i.titulo, principal: true },
      { rotulo: tx('Secção'), valor: (i) => i.categoria },
      { rotulo: tx('Data'), valor: (i) => i.data, data: true },
    ],
    novo: () => ({ titulo: '', categoria: '', data: new Date().toISOString().slice(0, 10), autor: 'Gabinete de Comunicação', resumo: '', capa: '', destaque: false, conteudo: [{ tipo: 'texto', html: '' }] }),
    campos: [
      { nome: 'titulo', rotulo: tx('Título'), tipo: 'texto', obrigatorio: true },
      { nome: 'categoria', rotulo: tx('Secção'), tipo: 'sugestoes', largura: 'terco', obrigatorio: true },
      { nome: 'data', rotulo: tx('Data'), tipo: 'data', largura: 'terco', obrigatorio: true },
      { nome: 'autor', rotulo: tx('Autoria'), tipo: 'texto', largura: 'terco' },
      { nome: 'resumo', rotulo: tx('Resumo'), tipo: 'textarea', linhas: 2, obrigatorio: true, ajuda: tx('Aparece nas listagens e no topo da notícia.') },
      { nome: 'capa', rotulo: tx('Imagem de capa'), tipo: 'imagem', obrigatorio: true, recomendado: TAMANHOS.capa },
      { nome: 'destaque', rotulo: tx('Manchete (aparece em grande no topo do boletim)'), tipo: 'booleano' },
      { nome: 'conteudo', rotulo: tx('Conteúdo da notícia'), tipo: 'blocos' },
    ],
  },
  artigos: {
    titulo: tx('Artigos'), singular: 'artigo', botaoNovo: tx('Novo artigo'),
    documento: { etiqueta: 'tipo', titulo: 'titulo', entrada: 'resumo', capa: 'capa', corpo: 'conteudo', placeholderTitulo: tx('Título do artigo'), endereco: 'Artigos' }, icone: 'fa-book-open', chave: 'slug', campoTitulo: 'titulo',
    rotaSite: (i) => `/Artigos/${i.slug}`,
    colunas: [
      { rotulo: tx('Título'), valor: (i) => i.titulo, principal: true },
      { rotulo: tx('Tipo'), valor: (i) => i.tipo },
      { rotulo: tx('Área'), valor: (i) => i.area },
      { rotulo: tx('Data'), valor: (i) => i.data, data: true },
    ],
    novo: () => ({ titulo: '', tipo: 'Artigo científico', area: '', autor: '', data: new Date().toISOString().slice(0, 10), resumo: '', palavrasChave: [], capa: '', pdf: '', conteudo: [{ tipo: 'texto', html: '' }] }),
    campos: [
      { nome: 'titulo', rotulo: tx('Título'), tipo: 'texto', obrigatorio: true },
      { nome: 'tipo', rotulo: tx('Tipo de publicação'), tipo: 'sugestoes', largura: 'terco', valores: ['Artigo científico', 'Ensaio', 'Opinião', 'Recensão'] },
      { nome: 'area', rotulo: tx('Área de investigação'), tipo: 'sugestoes', largura: 'terco' },
      { nome: 'data', rotulo: tx('Data de publicação'), tipo: 'data', largura: 'terco' },
      { nome: 'autor', rotulo: tx('Autor'), tipo: 'selecao', opcoes: 'pessoas', largura: 'metade' },
      { nome: 'palavrasChave', rotulo: tx('Palavras-chave'), tipo: 'listaTexto', largura: 'metade' },
      { nome: 'resumo', rotulo: tx('Resumo'), tipo: 'textarea', linhas: 4, obrigatorio: true },
      { nome: 'capa', rotulo: tx('Imagem de capa (opcional)'), tipo: 'imagem', largura: 'metade', recomendado: TAMANHOS.capa },
      { nome: 'pdf', rotulo: tx('Versão em PDF (opcional)'), tipo: 'ficheiro', largura: 'metade' },
      { nome: 'conteudo', rotulo: tx('Texto do artigo'), tipo: 'blocos' },
    ],
  },
  eventos: {
    titulo: tx('Eventos'), singular: 'evento', botaoNovo: tx('Novo evento'),
    documento: { etiqueta: 'categoria', titulo: 'titulo', entrada: 'resumo', capa: 'capa', corpo: 'conteudo', placeholderTitulo: tx('Nome do evento'), endereco: 'Eventos' }, icone: 'fa-calendar-alt', chave: 'id', campoTitulo: 'titulo',
    rotaSite: (i) => `/Eventos/${i.id}`,
    colunas: [
      { rotulo: '', tipo: 'imagem', valor: (i) => i.capa },
      { rotulo: tx('Evento'), valor: (i) => i.titulo, principal: true },
      { rotulo: tx('Tipo'), valor: (i) => i.categoria },
      { rotulo: tx('Data'), valor: (i) => i.data, data: true },
      { rotulo: tx('Hora'), valor: (i) => i.horaInicio },
    ],
    novo: () => ({ titulo: '', categoria: '', data: '', horaInicio: '09:00', horaFim: '', local: '', resumo: '', capa: '', inscricoes: false, programa: [], conteudo: [{ tipo: 'texto', html: '' }] }),
    campos: [
      { nome: 'titulo', rotulo: tx('Título do evento'), tipo: 'texto', obrigatorio: true },
      { nome: 'categoria', rotulo: tx('Tipo de evento'), tipo: 'sugestoes', largura: 'metade', obrigatorio: true },
      { nome: 'local', rotulo: tx('Local'), tipo: 'texto', largura: 'metade' },
      { nome: 'data', rotulo: tx('Data'), tipo: 'data', largura: 'terco', obrigatorio: true },
      { nome: 'horaInicio', rotulo: tx('Início'), tipo: 'hora', largura: 'terco', obrigatorio: true },
      { nome: 'horaFim', rotulo: tx('Fim'), tipo: 'hora', largura: 'terco' },
      { nome: 'resumo', rotulo: tx('Resumo'), tipo: 'textarea', linhas: 2 },
      { nome: 'capa', rotulo: tx('Imagem'), tipo: 'imagem', recomendado: TAMANHOS.capa },
      { nome: 'inscricoes', rotulo: tx('Inscrições abertas'), tipo: 'booleano' },
      { nome: 'programa', rotulo: tx('Programa do dia'), tipo: 'objetos', rotuloItem: tx('Momento'), campos: [
        { nome: 'hora', rotulo: tx('Hora'), tipo: 'hora', largura: 'terco' },
        { nome: 'atividade', rotulo: tx('Atividade'), tipo: 'texto', largura: 'doisTercos' },
      ] },
      { nome: 'conteudo', rotulo: tx('Descrição do evento'), tipo: 'blocos' },
    ],
  },
  cursos: {
    titulo: tx('Cursos'), singular: 'curso', botaoNovo: tx('Novo curso'), icone: 'fa-graduation-cap', chave: 'id', campoTitulo: 'nome', ordenavel: true,
    rotaSite: (i) => `/Cursos/${i.id}`,
    colunas: [
      { rotulo: '', tipo: 'imagem', valor: (i) => i.imagem },
      { rotulo: tx('Sigla'), valor: (i) => i.sigla },
      { rotulo: tx('Curso'), valor: (i) => i.nome, principal: true },
      { rotulo: tx('Duração'), valor: (i) => i.duracao },
      { rotulo: tx('Vagas'), valor: (i) => i.vagas },
    ],
    novo: () => ({ nome: '', sigla: '', resumo: '', imagem: '', duracao: '', regime: 'Presencial, tempo integral', vagas: '', destinatarios: '', coordenador: '', apresentacao: [''], objetivos: [], plano: [], requisitos: [], saidas: [] }),
    campos: [
      { nome: 'nome', rotulo: tx('Nome do curso'), tipo: 'texto', largura: 'doisTercos', obrigatorio: true },
      { nome: 'sigla', rotulo: tx('Sigla'), tipo: 'texto', largura: 'terco' },
      { nome: 'resumo', rotulo: tx('Resumo'), tipo: 'textarea', linhas: 2 },
      { nome: 'imagem', rotulo: tx('Imagem'), tipo: 'imagem', recomendado: TAMANHOS.curso },
      { nome: 'duracao', rotulo: tx('Duração'), tipo: 'texto', largura: 'terco' },
      { nome: 'regime', rotulo: tx('Regime'), tipo: 'texto', largura: 'terco' },
      { nome: 'vagas', rotulo: tx('Vagas'), tipo: 'texto', largura: 'terco' },
      { nome: 'destinatarios', rotulo: tx('Destinatários'), tipo: 'texto', largura: 'metade' },
      { nome: 'coordenador', rotulo: tx('Coordenação'), tipo: 'selecao', opcoes: 'pessoas', largura: 'metade' },
      { nome: 'apresentacao', rotulo: tx('Apresentação (um parágrafo por linha da lista)'), tipo: 'listaTexto', multilinha: true },
      { nome: 'objetivos', rotulo: tx('Objetivos'), tipo: 'listaTexto' },
      { nome: 'plano', rotulo: tx('Plano curricular'), tipo: 'objetos', rotuloItem: tx('Período'), campos: [
        { nome: 'periodo', rotulo: tx('Período ou bloco (ex.: 1.º semestre; Bloco I — Administração)'), tipo: 'texto' },
        { nome: 'unidades', rotulo: tx('Unidades curriculares'), tipo: 'objetos', rotuloItem: tx('Unidade'), campos: [
          { nome: 'nome', rotulo: tx('Unidade curricular'), tipo: 'texto', largura: 'doisTercos' },
          { nome: 'horas', rotulo: tx('Horas'), tipo: 'numero', largura: 'terco' },
          { nome: 'creditos', rotulo: tx('UCréd'), tipo: 'numero', largura: 'terco' },
        ] },
      ] },
      { nome: 'requisitos', rotulo: tx('Requisitos de admissão'), tipo: 'listaTexto' },
      { nome: 'saidas', rotulo: tx('Saídas profissionais'), tipo: 'listaTexto' },
    ],
  },
  pessoas: {
    titulo: tx('Corpo docente'), singular: 'pessoa', botaoNovo: tx('Nova pessoa'), feminino: true, icone: 'fa-user-tie', chave: 'id', campoTitulo: 'nome', ordenavel: true,
    ajudaLista: tx('A primeira pessoa da lista é apresentada como Comandante na página Institucional.'),
    colunas: [
      { rotulo: '', tipo: 'avatar', valor: (i) => i.foto },
      { rotulo: tx('Nome'), valor: (i) => i.nome, principal: true },
      { rotulo: tx('Cargo'), valor: (i) => i.cargo },
    ],
    novo: () => ({ nome: '', cargo: '', destaque: '', foto: '' }),
    campos: [
      { nome: 'nome', rotulo: tx('Nome (com posto, ex.: Cor. João Silva)'), tipo: 'texto', obrigatorio: true },
      { nome: 'cargo', rotulo: tx('Cargo'), tipo: 'texto' },
      { nome: 'destaque', rotulo: tx('Nota biográfica curta'), tipo: 'textarea', linhas: 2 },
      { nome: 'foto', rotulo: tx('Fotografia'), tipo: 'imagem', ajuda: tx('Sem fotografia, o site mostra as iniciais.'), recomendado: TAMANHOS.pessoa },
    ],
  },
  revistas: {
    titulo: tx('Revista'), singular: tx('número da revista'), botaoNovo: tx('Novo número'), icone: 'fa-book-reader', chave: 'slug', campoTitulo: 'titulo',
    ajudaLista: tx('Cada número é um PDF que qualquer visitante lê no site, em Revista. O número em destaque (ou o mais recente) aparece em grande.'),
    rotaSite: (i) => `/Revista/${i.slug}`,
    colunas: [
      { rotulo: '', tipo: 'imagem', valor: (i) => i.capa },
      { rotulo: tx('Número'), valor: (i) => i.numero },
      { rotulo: tx('Tema'), valor: (i) => i.titulo, principal: true },
      { rotulo: tx('Data'), valor: (i) => i.data, data: true },
    ],
    novo: () => ({ numero: '', titulo: '', data: new Date().toISOString().slice(0, 10), resumo: '', pdf: '', capa: '', destaque: false, sumario: [] }),
    campos: [
      { nome: 'numero', rotulo: tx('Número'), tipo: 'texto', largura: 'terco', ajuda: tx('Ex.: N.º 3') },
      { nome: 'titulo', rotulo: tx('Tema do número'), tipo: 'texto', largura: 'doisTercos', obrigatorio: true },
      { nome: 'data', rotulo: tx('Data de publicação'), tipo: 'data', largura: 'terco', obrigatorio: true },
      { nome: 'destaque', rotulo: tx('Em destaque na página da Revista'), tipo: 'booleano', largura: 'doisTercos' },
      { nome: 'resumo', rotulo: tx('Apresentação'), tipo: 'textarea', linhas: 3, ajuda: tx('Duas ou três frases sobre os temas deste número.') },
      { nome: 'pdf', rotulo: tx('Revista em PDF'), tipo: 'ficheiro', largura: 'metade', obrigatorio: true, ajuda: tx('O ficheiro completo, como foi paginado. Os visitantes leem-no no site e podem descarregá-lo.') },
      { nome: 'capa', rotulo: tx('Capa (opcional)'), tipo: 'imagem', largura: 'metade', ajuda: tx('Sem imagem, o site usa a primeira página do PDF como capa.') },
      { nome: 'sumario', rotulo: tx('Sumário'), tipo: 'objetos', rotuloItem: tx('Artigo'), ajuda: tx('Com a página, o leitor abre diretamente no artigo.'), campos: [
        { nome: 'titulo', rotulo: tx('Título'), tipo: 'texto', largura: 'metade' },
        { nome: 'autor', rotulo: tx('Autor'), tipo: 'texto', largura: 'terco' },
        { nome: 'pagina', rotulo: tx('Página'), tipo: 'texto', largura: 'sexto' },
      ] },
    ],
  },
  publicidade: {
    titulo: tx('Publicidade'), singular: 'banner', botaoNovo: tx('Novo banner'), icone: 'fa-bullhorn', chave: 'id', campoTitulo: 'titulo', ordenavel: true,
    ajudaLista: tx('Em cada posição do site aparece o primeiro banner ativo da lista (use as setas para escolher a ordem).'),
    colunas: [
      { rotulo: '', tipo: 'imagem', valor: (i) => i.imagem },
      { rotulo: tx('Banner'), valor: (i) => i.titulo, principal: true },
      { rotulo: tx('Anunciante'), valor: (i) => i.anunciante },
      { rotulo: tx('Posição'), valor: (i) => POSICOES_BANNER.find((p) => p.valor === i.posicao)?.rotulo || i.posicao },
      { rotulo: tx('Período'), valor: (i) => (i.inicio || i.fim ? `${i.inicio || '…'} → ${i.fim || '…'}` : tx('Sem limite')) },
    ],
    novo: () => ({ titulo: '', anunciante: '', tipo: 'composto', texto: '', botao: 'Saber mais', imagem: '', ligacao: '', posicao: 'home-meio', inicio: '', fim: '', ativo: true }),
    campos: [
      { nome: 'titulo', rotulo: tx('Título do banner'), tipo: 'texto', obrigatorio: true },
      { nome: 'anunciante', rotulo: tx('Anunciante'), tipo: 'texto', largura: 'metade' },
      {
        nome: 'tipo', rotulo: tx('Formato'), tipo: 'selecao', largura: 'metade',
        opcoes: [
          { valor: 'composto', rotulo: tx('Composto — imagem de fundo + título, texto e botão') },
          { valor: 'imagem', rotulo: tx('Só imagem — arte final do anunciante') },
        ],
      },
      { nome: 'imagem', rotulo: tx('Imagem'), tipo: 'imagem', ajuda: tx('Formato "só imagem": use 1600×300 px (horizontal) ou 600×500 px (lateral).'), recomendado: TAMANHOS.bannerLargo },
      { nome: 'texto', rotulo: tx('Texto (formato composto)'), tipo: 'textarea', linhas: 2 },
      { nome: 'botao', rotulo: tx('Texto do botão'), tipo: 'texto', largura: 'metade' },
      { nome: 'ligacao', rotulo: tx('Ligação'), tipo: 'texto', largura: 'metade', ajuda: tx('Endereço completo (https://…) ou página do site (ex.: /Cursos).') },
      { nome: 'posicao', rotulo: tx('Posição no site'), tipo: 'selecao', opcoes: 'posicoesBanner', largura: 'metade' },
      { nome: 'ativo', rotulo: tx('Ativo'), tipo: 'booleano', largura: 'metade' },
      { nome: 'inicio', rotulo: tx('Mostrar a partir de'), tipo: 'data', largura: 'metade' },
      { nome: 'fim', rotulo: tx('Mostrar até'), tipo: 'data', largura: 'metade' },
    ],
  },
}

// ---------- páginas ----------

export const PAGINAS = {
  home: {
    titulo: tx('Página inicial'), icone: 'fa-home', rota: '/',
    grupos: [
      { titulo: tx('Topo'), campos: [
        { nome: 'hero.titulo', rotulo: tx('Título principal'), tipo: 'texto' },
        { nome: 'hero.texto', rotulo: tx('Texto'), tipo: 'textarea', linhas: 2 },
        { nome: 'hero.imagem', rotulo: tx('Imagem de fundo'), tipo: 'imagem', recomendado: TAMANHOS.fundo },
        { nome: 'hero.metricas', rotulo: tx('Números em destaque'), tipo: 'objetos', rotuloItem: tx('Número'), campos: [
          { nome: 'valor', rotulo: tx('Valor'), tipo: 'texto', largura: 'metade' },
          { nome: 'legenda', rotulo: tx('Legenda'), tipo: 'texto', largura: 'metade' },
        ] },
      ] },
      { titulo: tx('Títulos das secções'), campos: [
        { nome: 'formacao.etiqueta', rotulo: tx('Formação — etiqueta'), tipo: 'texto', largura: 'terco' },
        { nome: 'formacao.titulo', rotulo: tx('Formação — título'), tipo: 'texto', largura: 'doisTercos' },
        { nome: 'formacao.texto', rotulo: tx('Formação — texto'), tipo: 'textarea', linhas: 2 },
        { nome: 'noticias.etiqueta', rotulo: tx('Notícias — etiqueta'), tipo: 'texto', largura: 'terco' },
        { nome: 'noticias.titulo', rotulo: tx('Notícias — título'), tipo: 'texto', largura: 'doisTercos' },
        { nome: 'eventos.etiqueta', rotulo: tx('Eventos — etiqueta'), tipo: 'texto', largura: 'terco' },
        { nome: 'eventos.titulo', rotulo: tx('Eventos — título'), tipo: 'texto', largura: 'doisTercos' },
        { nome: 'corpo.etiqueta', rotulo: tx('Corpo docente — etiqueta'), tipo: 'texto', largura: 'terco' },
        { nome: 'corpo.titulo', rotulo: tx('Corpo docente — título'), tipo: 'texto', largura: 'doisTercos' },
      ] },
      { titulo: tx('Avisos e comunicados'), campos: [
        { nome: 'avisos.etiqueta', rotulo: tx('Etiqueta'), tipo: 'texto', largura: 'terco' },
        { nome: 'avisos.titulo', rotulo: tx('Título'), tipo: 'texto', largura: 'doisTercos' },
        { nome: 'avisos.lista', rotulo: tx('Avisos'), tipo: 'objetos', rotuloItem: tx('Aviso'), campos: [
          { nome: 'tipo', rotulo: tx('Tipo (ex.: Comunicado)'), tipo: 'texto', largura: 'terco' },
          { nome: 'data', rotulo: tx('Data'), tipo: 'data', largura: 'terco' },
          { nome: 'importante', rotulo: tx('Importante'), tipo: 'booleano', largura: 'terco' },
          { nome: 'titulo', rotulo: tx('Título'), tipo: 'texto' },
          { nome: 'resumo', rotulo: tx('Texto'), tipo: 'textarea', linhas: 2 },
        ] },
      ] },
      { titulo: tx('Missão, visão e valores'), campos: [
        { nome: 'missao.imagem', rotulo: tx('Imagem de fundo'), tipo: 'imagem', recomendado: TAMANHOS.seccao },
        { nome: 'missao.missao', rotulo: tx('Missão'), tipo: 'textarea', linhas: 2 },
        { nome: 'missao.visao', rotulo: tx('Visão'), tipo: 'textarea', linhas: 2 },
        { nome: 'missao.valores', rotulo: tx('Valores'), tipo: 'textarea', linhas: 2 },
      ] },
      { titulo: tx('Perguntas frequentes'), campos: [
        { nome: 'faq.etiqueta', rotulo: tx('Etiqueta'), tipo: 'texto', largura: 'terco' },
        { nome: 'faq.titulo', rotulo: tx('Título'), tipo: 'texto', largura: 'doisTercos' },
        { nome: 'faq.perguntas', rotulo: tx('Perguntas'), tipo: 'objetos', rotuloItem: tx('Pergunta'), campos: [
          { nome: 'pergunta', rotulo: tx('Pergunta'), tipo: 'texto' },
          { nome: 'resposta', rotulo: tx('Resposta'), tipo: 'textarea', linhas: 3 },
        ] },
      ] },
      { titulo: tx('Chamada final'), campos: [
        { nome: 'cta.titulo', rotulo: tx('Título'), tipo: 'texto' },
        { nome: 'cta.texto', rotulo: tx('Texto'), tipo: 'textarea', linhas: 2 },
        { nome: 'cta.botao', rotulo: tx('Texto do botão'), tipo: 'texto', largura: 'metade' },
      ] },
    ],
  },
  institucional: {
    titulo: tx('Institucional'), icone: 'fa-landmark', rota: '/Institucional',
    grupos: [
      { titulo: tx('Abertura'), campos: [
        { nome: 'entrada', rotulo: tx('Texto de entrada'), tipo: 'textarea', linhas: 2 },
        { nome: 'imagemSede', rotulo: tx('Fotografia da sede'), tipo: 'imagem', recomendado: TAMANHOS.sede },
        { nome: 'legendaSede', rotulo: tx('Legenda da fotografia'), tipo: 'texto' },
        { nome: 'numeros', rotulo: tx('Números institucionais'), tipo: 'objetos', rotuloItem: tx('Número'), campos: [
          { nome: 'valor', rotulo: tx('Valor'), tipo: 'texto', largura: 'terco' },
          { nome: 'legenda', rotulo: tx('Legenda'), tipo: 'texto', largura: 'doisTercos' },
        ] },
      ] },
      { titulo: tx('I. História'), campos: [
        { nome: 'historia.titulo', rotulo: tx('Título'), tipo: 'texto' },
        { nome: 'historia.paragrafos', rotulo: tx('Texto (um parágrafo por item)'), tipo: 'listaTexto', multilinha: true },
        { nome: 'historia.imagem', rotulo: tx('Imagem'), tipo: 'imagem', largura: 'metade', recomendado: TAMANHOS.texto },
        { nome: 'historia.legenda', rotulo: tx('Legenda da imagem'), tipo: 'texto', largura: 'metade' },
        { nome: 'historia.marcos', rotulo: tx('Cronologia'), tipo: 'objetos', rotuloItem: tx('Marco'), campos: [
          { nome: 'ano', rotulo: tx('Ano'), tipo: 'texto', largura: 'terco' },
          { nome: 'titulo', rotulo: tx('Título'), tipo: 'texto', largura: 'doisTercos' },
          { nome: 'texto', rotulo: tx('Descrição'), tipo: 'textarea', linhas: 2 },
        ] },
      ] },
      { titulo: tx('II. Missão, visão e valores'), campos: [
        { nome: 'missao', rotulo: tx('Missão'), tipo: 'textarea', linhas: 2 },
        { nome: 'visao', rotulo: tx('Visão'), tipo: 'textarea', linhas: 2 },
        { nome: 'valores', rotulo: tx('Valores'), tipo: 'objetos', rotuloItem: tx('Valor'), campos: [
          { nome: 'nome', rotulo: tx('Valor'), tipo: 'texto', largura: 'terco' },
          { nome: 'texto', rotulo: tx('Descrição'), tipo: 'texto', largura: 'doisTercos' },
        ] },
      ] },
      { titulo: tx('III. Estrutura'), campos: [
        { nome: 'estrutura.introducao', rotulo: tx('Introdução'), tipo: 'textarea', linhas: 2 },
        { nome: 'estrutura.orgaos', rotulo: tx('Organograma (órgãos e dependências)'), tipo: 'objetos', rotuloItem: tx('Órgão'), ajuda: tx('Sai na secção «Direção / Comando». O órgão sem «Depende de» fica no topo; os de apoio ficam ao lado de quem dependem.'), campos: [
          { nome: 'nome', rotulo: tx('Órgão'), tipo: 'texto', largura: 'metade', obrigatorio: true },
          { nome: 'sigla', rotulo: tx('Sigla'), tipo: 'texto', largura: 'terco' },
          { nome: 'dependeDe', rotulo: tx('Depende de'), tipo: 'selecao', opcoes: 'irmaos', largura: 'metade', ajuda: tx('Vazio: fica no topo do organograma.') },
          { nome: 'tipo', rotulo: tx('Tipo'), tipo: 'selecao', largura: 'terco', opcoes: [{ valor: 'linha', rotulo: tx('Linha (hierarquia)') }, { valor: 'apoio', rotulo: tx('Apoio (assessoria)') }] },
          { nome: 'responsavel', rotulo: tx('Responsável'), tipo: 'selecao', opcoes: 'pessoas', largura: 'metade' },
          { nome: 'ligacao', rotulo: tx('Ligação (opcional)'), tipo: 'texto', largura: 'metade', ajuda: tx('Página do site (ex.: /Cursos) ou endereço completo.') },
          { nome: 'texto', rotulo: tx('Missão'), tipo: 'texto' },
        ] },
        { nome: 'estrutura.ramos', rotulo: tx('Áreas e órgãos'), tipo: 'objetos', rotuloItem: tx('Área'), campos: [
          { nome: 'titulo', rotulo: tx('Área'), tipo: 'texto' },
          { nome: 'orgaos', rotulo: tx('Órgãos'), tipo: 'objetos', rotuloItem: tx('Órgão'), campos: [
            { nome: 'nome', rotulo: tx('Órgão'), tipo: 'texto', largura: 'terco' },
            { nome: 'texto', rotulo: tx('Missão'), tipo: 'texto', largura: 'doisTercos' },
          ] },
        ] },
      ] },
      { titulo: tx('IV. Mensagem do Comandante'), campos: [
        { nome: 'mensagem.citacao', rotulo: tx('Citação'), tipo: 'textarea', linhas: 3 },
        { nome: 'mensagem.texto', rotulo: tx('Mensagem'), tipo: 'textarea', linhas: 4, ajuda: tx('O nome, cargo e fotografia vêm da primeira pessoa em "Corpo docente".') },
      ] },
    ],
  },
  cursos: {
    titulo: tx('Admissão aos cursos'), icone: 'fa-user-graduate', rota: '/Cursos',
    grupos: [
      { titulo: tx('Geral'), campos: [
        { nome: 'entrada', rotulo: tx('Texto de entrada da página Cursos'), tipo: 'textarea', linhas: 2 },
        { nome: 'anoAcademico', rotulo: tx('Ano académico'), tipo: 'texto', largura: 'terco' },
      ] },
      { titulo: tx('Processo'), campos: [
        { nome: 'processo', rotulo: tx('Passos da admissão'), tipo: 'objetos', rotuloItem: tx('Passo'), campos: [
          { nome: 'titulo', rotulo: tx('Passo'), tipo: 'texto', largura: 'terco' },
          { nome: 'texto', rotulo: tx('Descrição'), tipo: 'texto', largura: 'doisTercos' },
        ] },
      ] },
      { titulo: tx('Calendário'), campos: [
        { nome: 'calendario', rotulo: tx('Datas'), tipo: 'objetos', rotuloItem: tx('Fase'), campos: [
          { nome: 'fase', rotulo: tx('Fase'), tipo: 'texto', largura: 'metade' },
          { nome: 'periodo', rotulo: tx('Data ou período'), tipo: 'texto', largura: 'metade' },
        ] },
      ] },
    ],
  },
  contactos: {
    titulo: tx('Contactos'), icone: 'fa-address-book', rota: '/Contactos',
    grupos: [
      { titulo: tx('Contactos gerais'), campos: [
        { nome: 'email', rotulo: tx('E-mail geral'), tipo: 'texto', largura: 'metade' },
        { nome: 'mapa', rotulo: tx('Pesquisa no mapa'), tipo: 'texto', largura: 'metade', ajuda: tx('Texto usado para localizar a Escola no Google Maps.') },
        { nome: 'telefones', rotulo: tx('Telefones'), tipo: 'listaTexto', largura: 'metade' },
        { nome: 'morada', rotulo: tx('Morada (uma linha por item)'), tipo: 'listaTexto', largura: 'metade' },
        { nome: 'horario', rotulo: tx('Horário de atendimento'), tipo: 'objetos', rotuloItem: tx('Horário'), campos: [
          { nome: 'dias', rotulo: tx('Dias'), tipo: 'texto', largura: 'metade' },
          { nome: 'horas', rotulo: tx('Horas'), tipo: 'texto', largura: 'metade' },
        ] },
      ] },
      { titulo: tx('Departamentos'), campos: [
        { nome: 'departamentos', rotulo: tx('Contactos por área'), tipo: 'objetos', rotuloItem: tx('Área'), campos: [
          { nome: 'nome', rotulo: tx('Área'), tipo: 'texto', largura: 'terco' },
          { nome: 'descricao', rotulo: tx('Descrição'), tipo: 'texto', largura: 'terco' },
          { nome: 'email', rotulo: tx('E-mail'), tipo: 'texto', largura: 'terco' },
        ] },
      ] },
      { titulo: tx('Formulário'), campos: [
        { nome: 'assuntos', rotulo: tx('Assuntos do formulário de contacto'), tipo: 'listaTexto' },
      ] },
    ],
  },
  privacidade: {
    titulo: tx('Política de privacidade'), icone: 'fa-user-shield', rota: '/Privacidade',
    grupos: [
      { titulo: tx('Identificação'), campos: [
        { nome: 'titulo', rotulo: tx('Título'), tipo: 'texto', largura: 'metade' },
        { nome: 'actualizada', rotulo: tx('Última actualização'), tipo: 'data', largura: 'metade' },
        { nome: 'responsavel', rotulo: tx('Responsável pelo tratamento'), tipo: 'texto', largura: 'metade' },
        { nome: 'contacto', rotulo: tx('Contacto para os direitos dos titulares'), tipo: 'texto', largura: 'metade' },
        { nome: 'entrada', rotulo: tx('Texto de entrada'), tipo: 'textarea', linhas: 3 },
      ] },
      { titulo: tx('Secções'), campos: [
        { nome: 'seccoes', rotulo: tx('Secções da política'), tipo: 'objetos', rotuloItem: tx('Secção'), campos: [
          { nome: 'titulo', rotulo: tx('Título'), tipo: 'texto' },
          { nome: 'texto', rotulo: tx('Texto'), tipo: 'textarea', linhas: 5 },
        ] },
      ] },
    ],
  },
  // fotografia do topo de cada secção do site (vazio = a fotografia que vem com o site)
  cabecalhos: {
    titulo: tx('Imagens do topo'), icone: 'fa-image', rota: '/Institucional',
    grupos: [
      { titulo: tx('Fotografia do topo de cada secção'), campos: [
        ...[['institucional', tx('A Escola (Institucional)')], ['cursos', tx('Cursos')], ['noticias', tx('Notícias')], ['artigos', tx('Artigos')], ['eventos', tx('Eventos')], ['revista', tx('Revista')], ['contactos', tx('Contactos')], ['privacidade', tx('Política de privacidade')], ['geral', tx('Outras páginas')]]
          .map(([k, r]) => ({ nome: k, rotulo: r, tipo: 'imagem', largura: 'metade', recomendado: TAMANHOS.sede, ajuda: tx('Vazio: fica a fotografia que vem com o site.') })),
      ] },
    ],
  },
}

export const POSICOES_BANNER = [
  { valor: 'home-topo', rotulo: tx('Página inicial — logo abaixo do topo') },
  { valor: 'home-meio', rotulo: tx('Página inicial — entre os eventos e os avisos') },
  { valor: 'noticias-lateral', rotulo: tx('Notícias — coluna da direita') },
  { valor: 'noticia-fim', rotulo: tx('Notícia — no fim do texto') },
  { valor: 'rodape', rotulo: tx('Todas as páginas — acima do rodapé') },
]

// nomes legíveis para a grelha de permissões
export const NOMES_RECURSOS = {
  noticias: tx('Notícias'), artigos: tx('Artigos'), eventos: tx('Eventos'), cursos: tx('Cursos'), pessoas: tx('Corpo docente'), revistas: tx('Revista'),
  publicidade: tx('Publicidade'), paginas: tx('Páginas do site'), comentarios: tx('Comentários'), contactos: tx('Mensagens do site'), academico: tx('Gestão académica (portal)'), pessoal: tx('Pessoal e Quadros'), biblioteca: tx('Biblioteca'), integridade: tx('Integridade académica (anti-plágio)'), estatisticas: tx('Estatísticas'),
  utilizadores: tx('Utilizadores'), papeis: tx('Papéis e permissões'), atividades: tx('Registo de atividades'), seguranca: tx('Centro de segurança'),
}
export const NOMES_PERMISSOES = { ver: tx('Ver'), criar: tx('Criar'), editar: tx('Editar'), apagar: tx('Apagar'), publicar: tx('Publicar'), gerir: tx('Gerir'), notas: tx('Notas'), registar: tx('Registar') }

export const NOMES_ACOES = {
  entrar: tx('Entrou no painel'),
  sair: tx('Saiu do painel'),
  falha_entrada: tx('Tentativa de entrada falhada'),
  nova_candidatura: tx('Candidatura recebida'),
  entrar_portal: tx('Entrou no portal académico'),
  falha_entrada_portal: tx('Tentativa falhada no portal'),
  alterar_senha_portal: tx('Mudou a palavra-passe do portal'),
  criar_conta_portal: tx('Criou uma conta do portal'),
  importar_pessoas: tx('Importou pessoas (Pessoal e Quadros)'),
  criar_inquerito_institucional: tx('Preparou um inquérito de satisfação'),
  lancar_inquerito_institucional: tx('Lançou um inquérito de satisfação'),
  apagar_inquerito_institucional: tx('Apagou um inquérito de satisfação'),
  criar_obra: tx('Registou uma obra na biblioteca'),
  editar_obra: tx('Editou uma obra da biblioteca'),
  apagar_obra: tx('Apagou uma obra da biblioteca'),
  adicionar_exemplares: tx('Registou exemplares'),
  apagar_exemplar: tx('Apagou um exemplar'),
  emprestar_livro: tx('Emprestou um livro'),
  devolver_livro: tx('Registou uma devolução'),
  avisar_atrasos_biblioteca: tx('Avisou leitores em atraso'),
  preparar_reserva: tx('Separou um livro reservado'),
  verificar_originalidade: tx('Verificou a originalidade de um documento'),
  adicionar_referencia: tx('Juntou um documento ao repositório anti-plágio'),
  apagar_referencia: tx('Retirou um documento do repositório anti-plágio'),
  traduzir_ia: tx('Pediu um rascunho de tradução à IA'),
  guardar_traducao: tx('Guardou uma tradução'),
  publicar_traducao: tx('Publicou uma tradução'),
  apagar_traducao: tx('Apagou uma tradução'),
  editar_conta_portal: tx('Editou uma conta do portal'),
  repor_senha_portal: tx('Repôs a palavra-passe de uma conta do portal'),
  criar_turma: tx('Criou uma turma'),
  matricular: tx('Matriculou um estudante'),
  alterar_matricula: tx('Alterou uma matrícula'),
  criar_cadeira: tx('Criou uma cadeira'),
  editar_cadeira: tx('Editou uma cadeira'),
  apagar_cadeira: tx('Apagou uma cadeira'),
  tratar_pedido: tx('Tratou um pedido de documento'),
  aviso_geral: tx('Publicou um aviso no portal'),
  entregar_trabalho: tx('Entregou um trabalho (portal)'),
  lancar_notas: tx('Lançou notas'),
  publicar_notas: tx('Publicou notas'),
  alocar_docentes: tx('Alocou docentes a uma cadeira'),
  programa_cadeira: tx('Atualizou o programa de uma cadeira'),
  marcar_evento: tx('Marcou uma data no calendário académico'),
  apagar_topico: tx('Apagou um tópico do fórum'),
  publicar_questionario: tx('Publicou um questionário'),
  apagar_questionario: tx('Apagou um questionário'),
  entregar_questionario: tx('Entregou um questionário (portal)'),
  composicao_notas: tx('Definiu como se calcula uma componente da pauta'),
  copiar_cadeira: tx('Copiou os conteúdos de uma cadeira'),
  emitir_certificado: tx('Obteve o certificado de conclusão de uma cadeira'),
  lancar_avaliacao: tx('Lançou o inquérito de avaliação dos docentes numa turma'),
  apagar_avaliacao: tx('Apagou um inquérito de avaliação de docente'),
  importar_estudantes: tx('Importou estudantes de uma folha (Excel/CSV) para uma turma'),
  inscrever_cadeira: tx('Inscreveu um estudante numa cadeira fora da turma'),
  anular_inscricao: tx('Anulou a inscrição de um estudante numa cadeira'),
  lancar_tfc: tx('Lançou o trabalho de fim de curso de um estudante'),
  emitir_certificado_curso: tx('Emitiu o certificado de conclusão do curso'),
  prorrogar_prazo: tx('Alargou o prazo de um trabalho a um estudante'),
  pedido_documento: tx('Pediu um documento (portal)'),
  avaliar_candidatura: tx('Avaliou uma candidatura'),
  bloquear_conta: tx('Conta bloqueada por tentativas falhadas'),
  criar: tx('Criou'),
  editar: tx('Editou'),
  apagar: tx('Apagou'),
  reordenar: tx('Mudou a ordem'),
  editar_pagina: tx('Editou página'),
  carregar_ficheiro: tx('Carregou ficheiro'),
  apagar_comentario: tx('Apagou comentário'),
  apagar_contacto: tx('Apagou mensagem do site'),
  bloquear_ip: tx('Bloqueou um endereço'),
  desbloquear_ip: tx('Desbloqueou um endereço'),
  criar_ferramenta_lti: tx('Registou ferramenta externa (LTI)'),
  editar_ferramenta_lti: tx('Editou ferramenta externa (LTI)'),
  apagar_ferramenta_lti: tx('Apagou ferramenta externa (LTI)'),
  exportar_cadeira: tx('Descarregou a cópia de segurança de uma cadeira'),
  restaurar_cadeira: tx('Restaurou uma cópia numa cadeira'),
  criar_utilizador: tx('Criou utilizador'),
  editar_utilizador: tx('Editou utilizador'),
  alterar_senha: tx('Alterou a palavra-passe'),
  publicar: tx('Publicou'),
  despublicar: tx('Passou a rascunho'),
  criar_papel: tx('Criou papel'),
  editar_papel: tx('Editou papel'),
  apagar_papel: tx('Apagou papel'),
}
