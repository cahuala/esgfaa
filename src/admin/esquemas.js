/*
  Definição dos formulários do painel.
  Cada campo: { nome, rotulo, tipo, obrigatorio?, ajuda?, largura?, opcoes?, campos?, ... }
  `nome` pode ser um caminho com pontos ("hero.titulo") para editar objetos dentro de objetos.

  Tipos: texto, textarea, data, hora, numero, booleano, selecao, sugestoes (texto com lista),
         imagem, ficheiro, video, youtube, listaTexto, objetos (lista de sub-formulários), blocos.
*/

// ---------- blocos do conteúdo (corpo das notícias, artigos e eventos) ----------

export const TIPOS_BLOCO = {
  texto: { rotulo: 'Texto formatado', icone: 'fa-file-alt', campos: [{ nome: 'html', rotulo: 'Texto', tipo: 'textoRico' }] },
  paragrafo: { rotulo: 'Parágrafo simples', icone: 'fa-align-left', campos: [{ nome: 'texto', rotulo: 'Texto', tipo: 'textarea', linhas: 5 }] },
  subtitulo: { rotulo: 'Subtítulo', icone: 'fa-heading', campos: [{ nome: 'texto', rotulo: 'Subtítulo', tipo: 'texto' }] },
  imagem: {
    rotulo: 'Imagem', icone: 'fa-image',
    campos: [
      { nome: 'src', rotulo: 'Imagem', tipo: 'imagem' },
      { nome: 'legenda', rotulo: 'Legenda', tipo: 'texto', largura: 'metade' },
      {
        nome: 'posicao', rotulo: 'Posição no texto', tipo: 'selecao', largura: 'metade',
        opcoes: [
          { valor: 'centro', rotulo: 'Centro — largura do texto' },
          { valor: 'esquerda', rotulo: 'Esquerda — texto à volta' },
          { valor: 'direita', rotulo: 'Direita — texto à volta' },
          { valor: 'larga', rotulo: 'Larga — sai da coluna' },
        ],
      },
    ],
  },
  galeria: {
    rotulo: 'Galeria', icone: 'fa-images',
    campos: [
      { nome: 'imagens', rotulo: 'Imagens', tipo: 'objetos', rotuloItem: 'Imagem', campos: [
        { nome: 'src', rotulo: 'Imagem', tipo: 'imagem' },
        { nome: 'legenda', rotulo: 'Legenda', tipo: 'texto' },
      ] },
      { nome: 'legenda', rotulo: 'Legenda da galeria', tipo: 'texto' },
    ],
  },
  video: {
    rotulo: 'Vídeo', icone: 'fa-video',
    campos: [
      { nome: 'youtube', rotulo: 'Vídeo do YouTube', tipo: 'youtube', ajuda: 'Cole o endereço do vídeo do YouTube — ou deixe vazio e carregue um ficheiro abaixo.' },
      { nome: 'src', rotulo: 'Ficheiro de vídeo (MP4)', tipo: 'video', largura: 'metade' },
      { nome: 'poster', rotulo: 'Imagem de capa do vídeo', tipo: 'imagem', largura: 'metade' },
      { nome: 'legenda', rotulo: 'Legenda', tipo: 'texto' },
    ],
  },
  citacao: {
    rotulo: 'Citação', icone: 'fa-quote-left',
    campos: [
      { nome: 'texto', rotulo: 'Citação', tipo: 'textarea', linhas: 3 },
      { nome: 'autor', rotulo: 'Autor', tipo: 'texto' },
    ],
  },
  lista: {
    rotulo: 'Lista', icone: 'fa-list-ul',
    campos: [
      { nome: 'itens', rotulo: 'Itens', tipo: 'listaTexto' },
      { nome: 'ordenada', rotulo: 'Lista numerada', tipo: 'booleano' },
    ],
  },
  destaque: {
    rotulo: 'Caixa de destaque', icone: 'fa-square',
    campos: [
      { nome: 'titulo', rotulo: 'Título (opcional)', tipo: 'texto' },
      { nome: 'texto', rotulo: 'Texto', tipo: 'textarea', linhas: 3 },
    ],
  },
  referencias: {
    rotulo: 'Referências', icone: 'fa-book',
    campos: [{ nome: 'itens', rotulo: 'Referências bibliográficas', tipo: 'listaTexto' }],
  },
}

// ---------- coleções ----------

export const COLECOES = {
  noticias: {
    titulo: 'Notícias', singular: 'notícia', botaoNovo: 'Nova notícia', feminino: true, icone: 'fa-newspaper', chave: 'slug', campoTitulo: 'titulo',
    rotaSite: (i) => `/Noticias/${i.slug}`,
    colunas: [
      { rotulo: '', tipo: 'imagem', valor: (i) => i.capa },
      { rotulo: 'Título', valor: (i) => i.titulo, principal: true },
      { rotulo: 'Secção', valor: (i) => i.categoria },
      { rotulo: 'Data', valor: (i) => i.data, data: true },
    ],
    novo: () => ({ titulo: '', categoria: '', data: new Date().toISOString().slice(0, 10), autor: 'Gabinete de Comunicação', resumo: '', capa: '', destaque: false, conteudo: [{ tipo: 'texto', html: '' }] }),
    campos: [
      { nome: 'titulo', rotulo: 'Título', tipo: 'texto', obrigatorio: true },
      { nome: 'categoria', rotulo: 'Secção', tipo: 'sugestoes', largura: 'terco', obrigatorio: true },
      { nome: 'data', rotulo: 'Data', tipo: 'data', largura: 'terco', obrigatorio: true },
      { nome: 'autor', rotulo: 'Autoria', tipo: 'texto', largura: 'terco' },
      { nome: 'resumo', rotulo: 'Resumo', tipo: 'textarea', linhas: 2, obrigatorio: true, ajuda: 'Aparece nas listagens e no topo da notícia.' },
      { nome: 'capa', rotulo: 'Imagem de capa', tipo: 'imagem', obrigatorio: true },
      { nome: 'destaque', rotulo: 'Manchete (aparece em grande no topo do boletim)', tipo: 'booleano' },
      { nome: 'conteudo', rotulo: 'Conteúdo da notícia', tipo: 'blocos' },
    ],
  },
  artigos: {
    titulo: 'Artigos', singular: 'artigo', botaoNovo: 'Novo artigo', icone: 'fa-book-open', chave: 'slug', campoTitulo: 'titulo',
    rotaSite: (i) => `/Artigos/${i.slug}`,
    colunas: [
      { rotulo: 'Título', valor: (i) => i.titulo, principal: true },
      { rotulo: 'Tipo', valor: (i) => i.tipo },
      { rotulo: 'Área', valor: (i) => i.area },
      { rotulo: 'Data', valor: (i) => i.data, data: true },
    ],
    novo: () => ({ titulo: '', tipo: 'Artigo científico', area: '', autor: '', data: new Date().toISOString().slice(0, 10), resumo: '', palavrasChave: [], capa: '', pdf: '', conteudo: [{ tipo: 'texto', html: '' }] }),
    campos: [
      { nome: 'titulo', rotulo: 'Título', tipo: 'texto', obrigatorio: true },
      { nome: 'tipo', rotulo: 'Tipo de publicação', tipo: 'sugestoes', largura: 'terco', valores: ['Artigo científico', 'Ensaio', 'Opinião', 'Recensão'] },
      { nome: 'area', rotulo: 'Área de investigação', tipo: 'sugestoes', largura: 'terco' },
      { nome: 'data', rotulo: 'Data de publicação', tipo: 'data', largura: 'terco' },
      { nome: 'autor', rotulo: 'Autor', tipo: 'selecao', opcoes: 'pessoas', largura: 'metade' },
      { nome: 'palavrasChave', rotulo: 'Palavras-chave', tipo: 'listaTexto', largura: 'metade' },
      { nome: 'resumo', rotulo: 'Resumo', tipo: 'textarea', linhas: 4, obrigatorio: true },
      { nome: 'capa', rotulo: 'Imagem de capa (opcional)', tipo: 'imagem', largura: 'metade' },
      { nome: 'pdf', rotulo: 'Versão em PDF (opcional)', tipo: 'ficheiro', largura: 'metade' },
      { nome: 'conteudo', rotulo: 'Texto do artigo', tipo: 'blocos' },
    ],
  },
  eventos: {
    titulo: 'Eventos', singular: 'evento', botaoNovo: 'Novo evento', icone: 'fa-calendar-alt', chave: 'id', campoTitulo: 'titulo',
    rotaSite: (i) => `/Eventos/${i.id}`,
    colunas: [
      { rotulo: '', tipo: 'imagem', valor: (i) => i.capa },
      { rotulo: 'Evento', valor: (i) => i.titulo, principal: true },
      { rotulo: 'Tipo', valor: (i) => i.categoria },
      { rotulo: 'Data', valor: (i) => i.data, data: true },
      { rotulo: 'Hora', valor: (i) => i.horaInicio },
    ],
    novo: () => ({ titulo: '', categoria: '', data: '', horaInicio: '09:00', horaFim: '', local: '', resumo: '', capa: '', inscricoes: false, programa: [], conteudo: [{ tipo: 'texto', html: '' }] }),
    campos: [
      { nome: 'titulo', rotulo: 'Título do evento', tipo: 'texto', obrigatorio: true },
      { nome: 'categoria', rotulo: 'Tipo de evento', tipo: 'sugestoes', largura: 'metade', obrigatorio: true },
      { nome: 'local', rotulo: 'Local', tipo: 'texto', largura: 'metade' },
      { nome: 'data', rotulo: 'Data', tipo: 'data', largura: 'terco', obrigatorio: true },
      { nome: 'horaInicio', rotulo: 'Início', tipo: 'hora', largura: 'terco', obrigatorio: true },
      { nome: 'horaFim', rotulo: 'Fim', tipo: 'hora', largura: 'terco' },
      { nome: 'resumo', rotulo: 'Resumo', tipo: 'textarea', linhas: 2 },
      { nome: 'capa', rotulo: 'Imagem', tipo: 'imagem' },
      { nome: 'inscricoes', rotulo: 'Inscrições abertas', tipo: 'booleano' },
      { nome: 'programa', rotulo: 'Programa do dia', tipo: 'objetos', rotuloItem: 'Momento', campos: [
        { nome: 'hora', rotulo: 'Hora', tipo: 'hora', largura: 'terco' },
        { nome: 'atividade', rotulo: 'Atividade', tipo: 'texto', largura: 'doisTercos' },
      ] },
      { nome: 'conteudo', rotulo: 'Descrição do evento', tipo: 'blocos' },
    ],
  },
  cursos: {
    titulo: 'Cursos', singular: 'curso', botaoNovo: 'Novo curso', icone: 'fa-graduation-cap', chave: 'id', campoTitulo: 'nome', ordenavel: true,
    rotaSite: (i) => `/Cursos/${i.id}`,
    colunas: [
      { rotulo: '', tipo: 'imagem', valor: (i) => i.imagem },
      { rotulo: 'Sigla', valor: (i) => i.sigla },
      { rotulo: 'Curso', valor: (i) => i.nome, principal: true },
      { rotulo: 'Duração', valor: (i) => i.duracao },
      { rotulo: 'Vagas', valor: (i) => i.vagas },
    ],
    novo: () => ({ nome: '', sigla: '', resumo: '', imagem: '', duracao: '', regime: 'Presencial, tempo integral', vagas: '', destinatarios: '', coordenador: '', apresentacao: [''], objetivos: [], plano: [], requisitos: [], saidas: [] }),
    campos: [
      { nome: 'nome', rotulo: 'Nome do curso', tipo: 'texto', largura: 'doisTercos', obrigatorio: true },
      { nome: 'sigla', rotulo: 'Sigla', tipo: 'texto', largura: 'terco' },
      { nome: 'resumo', rotulo: 'Resumo', tipo: 'textarea', linhas: 2 },
      { nome: 'imagem', rotulo: 'Imagem', tipo: 'imagem' },
      { nome: 'duracao', rotulo: 'Duração', tipo: 'texto', largura: 'terco' },
      { nome: 'regime', rotulo: 'Regime', tipo: 'texto', largura: 'terco' },
      { nome: 'vagas', rotulo: 'Vagas', tipo: 'texto', largura: 'terco' },
      { nome: 'destinatarios', rotulo: 'Destinatários', tipo: 'texto', largura: 'metade' },
      { nome: 'coordenador', rotulo: 'Coordenação', tipo: 'selecao', opcoes: 'pessoas', largura: 'metade' },
      { nome: 'apresentacao', rotulo: 'Apresentação (um parágrafo por linha da lista)', tipo: 'listaTexto', multilinha: true },
      { nome: 'objetivos', rotulo: 'Objetivos', tipo: 'listaTexto' },
      { nome: 'plano', rotulo: 'Plano curricular', tipo: 'objetos', rotuloItem: 'Período', campos: [
        { nome: 'periodo', rotulo: 'Período (ex.: 1.º semestre)', tipo: 'texto' },
        { nome: 'unidades', rotulo: 'Unidades curriculares', tipo: 'objetos', rotuloItem: 'Unidade', campos: [
          { nome: 'nome', rotulo: 'Unidade curricular', tipo: 'texto', largura: 'doisTercos' },
          { nome: 'horas', rotulo: 'Horas', tipo: 'numero', largura: 'terco' },
        ] },
      ] },
      { nome: 'requisitos', rotulo: 'Requisitos de admissão', tipo: 'listaTexto' },
      { nome: 'saidas', rotulo: 'Saídas profissionais', tipo: 'listaTexto' },
    ],
  },
  pessoas: {
    titulo: 'Corpo docente', singular: 'pessoa', botaoNovo: 'Nova pessoa', feminino: true, icone: 'fa-user-tie', chave: 'id', campoTitulo: 'nome', ordenavel: true,
    ajudaLista: 'A primeira pessoa da lista é apresentada como Comandante na página Institucional.',
    colunas: [
      { rotulo: '', tipo: 'avatar', valor: (i) => i.foto },
      { rotulo: 'Nome', valor: (i) => i.nome, principal: true },
      { rotulo: 'Cargo', valor: (i) => i.cargo },
    ],
    novo: () => ({ nome: '', cargo: '', destaque: '', foto: '' }),
    campos: [
      { nome: 'nome', rotulo: 'Nome (com posto, ex.: Cor. João Silva)', tipo: 'texto', obrigatorio: true },
      { nome: 'cargo', rotulo: 'Cargo', tipo: 'texto' },
      { nome: 'destaque', rotulo: 'Nota biográfica curta', tipo: 'textarea', linhas: 2 },
      { nome: 'foto', rotulo: 'Fotografia', tipo: 'imagem', ajuda: 'Sem fotografia, o site mostra as iniciais.' },
    ],
  },
  publicidade: {
    titulo: 'Publicidade', singular: 'banner', botaoNovo: 'Novo banner', icone: 'fa-bullhorn', chave: 'id', campoTitulo: 'titulo', ordenavel: true,
    ajudaLista: 'Em cada posição do site aparece o primeiro banner ativo da lista (use as setas para escolher a ordem).',
    colunas: [
      { rotulo: '', tipo: 'imagem', valor: (i) => i.imagem },
      { rotulo: 'Banner', valor: (i) => i.titulo, principal: true },
      { rotulo: 'Anunciante', valor: (i) => i.anunciante },
      { rotulo: 'Posição', valor: (i) => POSICOES_BANNER.find((p) => p.valor === i.posicao)?.rotulo || i.posicao },
      { rotulo: 'Período', valor: (i) => (i.inicio || i.fim ? `${i.inicio || '…'} → ${i.fim || '…'}` : 'Sem limite') },
    ],
    novo: () => ({ titulo: '', anunciante: '', tipo: 'composto', texto: '', botao: 'Saber mais', imagem: '', ligacao: '', posicao: 'home-meio', inicio: '', fim: '', ativo: true }),
    campos: [
      { nome: 'titulo', rotulo: 'Título do banner', tipo: 'texto', obrigatorio: true },
      { nome: 'anunciante', rotulo: 'Anunciante', tipo: 'texto', largura: 'metade' },
      {
        nome: 'tipo', rotulo: 'Formato', tipo: 'selecao', largura: 'metade',
        opcoes: [
          { valor: 'composto', rotulo: 'Composto — imagem de fundo + título, texto e botão' },
          { valor: 'imagem', rotulo: 'Só imagem — arte final do anunciante' },
        ],
      },
      { nome: 'imagem', rotulo: 'Imagem', tipo: 'imagem', ajuda: 'Formato "só imagem": use 1600×300 px (horizontal) ou 600×500 px (lateral).' },
      { nome: 'texto', rotulo: 'Texto (formato composto)', tipo: 'textarea', linhas: 2 },
      { nome: 'botao', rotulo: 'Texto do botão', tipo: 'texto', largura: 'metade' },
      { nome: 'ligacao', rotulo: 'Ligação', tipo: 'texto', largura: 'metade', ajuda: 'Endereço completo (https://…) ou página do site (ex.: /Cursos).' },
      { nome: 'posicao', rotulo: 'Posição no site', tipo: 'selecao', opcoes: 'posicoesBanner', largura: 'metade' },
      { nome: 'ativo', rotulo: 'Ativo', tipo: 'booleano', largura: 'metade' },
      { nome: 'inicio', rotulo: 'Mostrar a partir de', tipo: 'data', largura: 'metade' },
      { nome: 'fim', rotulo: 'Mostrar até', tipo: 'data', largura: 'metade' },
    ],
  },
}

// ---------- páginas ----------

export const PAGINAS = {
  home: {
    titulo: 'Página inicial', icone: 'fa-home', rota: '/',
    grupos: [
      { titulo: 'Topo', campos: [
        { nome: 'hero.titulo', rotulo: 'Título principal', tipo: 'texto' },
        { nome: 'hero.texto', rotulo: 'Texto', tipo: 'textarea', linhas: 2 },
        { nome: 'hero.imagem', rotulo: 'Imagem de fundo', tipo: 'imagem' },
        { nome: 'hero.metricas', rotulo: 'Números em destaque', tipo: 'objetos', rotuloItem: 'Número', campos: [
          { nome: 'valor', rotulo: 'Valor', tipo: 'texto', largura: 'metade' },
          { nome: 'legenda', rotulo: 'Legenda', tipo: 'texto', largura: 'metade' },
        ] },
        { nome: 'hero.formularioTitulo', rotulo: 'Título do formulário de candidatura', tipo: 'texto', largura: 'metade' },
        { nome: 'hero.formularioTexto', rotulo: 'Texto do formulário', tipo: 'texto', largura: 'metade' },
      ] },
      { titulo: 'Títulos das secções', campos: [
        { nome: 'formacao.etiqueta', rotulo: 'Formação — etiqueta', tipo: 'texto', largura: 'terco' },
        { nome: 'formacao.titulo', rotulo: 'Formação — título', tipo: 'texto', largura: 'doisTercos' },
        { nome: 'formacao.texto', rotulo: 'Formação — texto', tipo: 'textarea', linhas: 2 },
        { nome: 'noticias.etiqueta', rotulo: 'Notícias — etiqueta', tipo: 'texto', largura: 'terco' },
        { nome: 'noticias.titulo', rotulo: 'Notícias — título', tipo: 'texto', largura: 'doisTercos' },
        { nome: 'eventos.etiqueta', rotulo: 'Eventos — etiqueta', tipo: 'texto', largura: 'terco' },
        { nome: 'eventos.titulo', rotulo: 'Eventos — título', tipo: 'texto', largura: 'doisTercos' },
        { nome: 'corpo.etiqueta', rotulo: 'Corpo docente — etiqueta', tipo: 'texto', largura: 'terco' },
        { nome: 'corpo.titulo', rotulo: 'Corpo docente — título', tipo: 'texto', largura: 'doisTercos' },
      ] },
      { titulo: 'Avisos e comunicados', campos: [
        { nome: 'avisos.etiqueta', rotulo: 'Etiqueta', tipo: 'texto', largura: 'terco' },
        { nome: 'avisos.titulo', rotulo: 'Título', tipo: 'texto', largura: 'doisTercos' },
        { nome: 'avisos.lista', rotulo: 'Avisos', tipo: 'objetos', rotuloItem: 'Aviso', campos: [
          { nome: 'tipo', rotulo: 'Tipo (ex.: Comunicado)', tipo: 'texto', largura: 'terco' },
          { nome: 'data', rotulo: 'Data', tipo: 'data', largura: 'terco' },
          { nome: 'importante', rotulo: 'Importante', tipo: 'booleano', largura: 'terco' },
          { nome: 'titulo', rotulo: 'Título', tipo: 'texto' },
          { nome: 'resumo', rotulo: 'Texto', tipo: 'textarea', linhas: 2 },
        ] },
      ] },
      { titulo: 'Missão, visão e valores', campos: [
        { nome: 'missao.imagem', rotulo: 'Imagem de fundo', tipo: 'imagem' },
        { nome: 'missao.missao', rotulo: 'Missão', tipo: 'textarea', linhas: 2 },
        { nome: 'missao.visao', rotulo: 'Visão', tipo: 'textarea', linhas: 2 },
        { nome: 'missao.valores', rotulo: 'Valores', tipo: 'textarea', linhas: 2 },
      ] },
      { titulo: 'Perguntas frequentes', campos: [
        { nome: 'faq.etiqueta', rotulo: 'Etiqueta', tipo: 'texto', largura: 'terco' },
        { nome: 'faq.titulo', rotulo: 'Título', tipo: 'texto', largura: 'doisTercos' },
        { nome: 'faq.perguntas', rotulo: 'Perguntas', tipo: 'objetos', rotuloItem: 'Pergunta', campos: [
          { nome: 'pergunta', rotulo: 'Pergunta', tipo: 'texto' },
          { nome: 'resposta', rotulo: 'Resposta', tipo: 'textarea', linhas: 3 },
        ] },
      ] },
      { titulo: 'Chamada final', campos: [
        { nome: 'cta.titulo', rotulo: 'Título', tipo: 'texto' },
        { nome: 'cta.texto', rotulo: 'Texto', tipo: 'textarea', linhas: 2 },
        { nome: 'cta.botao', rotulo: 'Texto do botão', tipo: 'texto', largura: 'metade' },
      ] },
    ],
  },
  institucional: {
    titulo: 'Institucional', icone: 'fa-landmark', rota: '/Institucional',
    grupos: [
      { titulo: 'Abertura', campos: [
        { nome: 'entrada', rotulo: 'Texto de entrada', tipo: 'textarea', linhas: 2 },
        { nome: 'imagemSede', rotulo: 'Fotografia da sede', tipo: 'imagem' },
        { nome: 'legendaSede', rotulo: 'Legenda da fotografia', tipo: 'texto' },
        { nome: 'numeros', rotulo: 'Números institucionais', tipo: 'objetos', rotuloItem: 'Número', campos: [
          { nome: 'valor', rotulo: 'Valor', tipo: 'texto', largura: 'terco' },
          { nome: 'legenda', rotulo: 'Legenda', tipo: 'texto', largura: 'doisTercos' },
        ] },
      ] },
      { titulo: 'I. História', campos: [
        { nome: 'historia.titulo', rotulo: 'Título', tipo: 'texto' },
        { nome: 'historia.paragrafos', rotulo: 'Texto (um parágrafo por item)', tipo: 'listaTexto', multilinha: true },
        { nome: 'historia.imagem', rotulo: 'Imagem', tipo: 'imagem', largura: 'metade' },
        { nome: 'historia.legenda', rotulo: 'Legenda da imagem', tipo: 'texto', largura: 'metade' },
        { nome: 'historia.marcos', rotulo: 'Cronologia', tipo: 'objetos', rotuloItem: 'Marco', campos: [
          { nome: 'ano', rotulo: 'Ano', tipo: 'texto', largura: 'terco' },
          { nome: 'titulo', rotulo: 'Título', tipo: 'texto', largura: 'doisTercos' },
          { nome: 'texto', rotulo: 'Descrição', tipo: 'textarea', linhas: 2 },
        ] },
      ] },
      { titulo: 'II. Missão, visão e valores', campos: [
        { nome: 'missao', rotulo: 'Missão', tipo: 'textarea', linhas: 2 },
        { nome: 'visao', rotulo: 'Visão', tipo: 'textarea', linhas: 2 },
        { nome: 'valores', rotulo: 'Valores', tipo: 'objetos', rotuloItem: 'Valor', campos: [
          { nome: 'nome', rotulo: 'Valor', tipo: 'texto', largura: 'terco' },
          { nome: 'texto', rotulo: 'Descrição', tipo: 'texto', largura: 'doisTercos' },
        ] },
      ] },
      { titulo: 'III. Estrutura', campos: [
        { nome: 'estrutura.introducao', rotulo: 'Introdução', tipo: 'textarea', linhas: 2 },
        { nome: 'estrutura.ramos', rotulo: 'Áreas e órgãos', tipo: 'objetos', rotuloItem: 'Área', campos: [
          { nome: 'titulo', rotulo: 'Área', tipo: 'texto' },
          { nome: 'orgaos', rotulo: 'Órgãos', tipo: 'objetos', rotuloItem: 'Órgão', campos: [
            { nome: 'nome', rotulo: 'Órgão', tipo: 'texto', largura: 'terco' },
            { nome: 'texto', rotulo: 'Missão', tipo: 'texto', largura: 'doisTercos' },
          ] },
        ] },
      ] },
      { titulo: 'IV. Mensagem do Comandante', campos: [
        { nome: 'mensagem.citacao', rotulo: 'Citação', tipo: 'textarea', linhas: 3 },
        { nome: 'mensagem.texto', rotulo: 'Mensagem', tipo: 'textarea', linhas: 4, ajuda: 'O nome, cargo e fotografia vêm da primeira pessoa em "Corpo docente".' },
      ] },
    ],
  },
  cursos: {
    titulo: 'Admissão aos cursos', icone: 'fa-user-graduate', rota: '/Cursos',
    grupos: [
      { titulo: 'Geral', campos: [
        { nome: 'entrada', rotulo: 'Texto de entrada da página Cursos', tipo: 'textarea', linhas: 2 },
        { nome: 'anoAcademico', rotulo: 'Ano académico', tipo: 'texto', largura: 'terco' },
        { nome: 'prazo', rotulo: 'Prazo de candidatura', tipo: 'texto', largura: 'terco' },
        { nome: 'candidaturasAbertas', rotulo: 'Candidaturas abertas (mostra a faixa vermelha)', tipo: 'booleano', largura: 'terco' },
      ] },
      { titulo: 'Processo', campos: [
        { nome: 'processo', rotulo: 'Passos da candidatura', tipo: 'objetos', rotuloItem: 'Passo', campos: [
          { nome: 'titulo', rotulo: 'Passo', tipo: 'texto', largura: 'terco' },
          { nome: 'texto', rotulo: 'Descrição', tipo: 'texto', largura: 'doisTercos' },
        ] },
      ] },
      { titulo: 'Calendário', campos: [
        { nome: 'calendario', rotulo: 'Datas', tipo: 'objetos', rotuloItem: 'Fase', campos: [
          { nome: 'fase', rotulo: 'Fase', tipo: 'texto', largura: 'metade' },
          { nome: 'periodo', rotulo: 'Data ou período', tipo: 'texto', largura: 'metade' },
        ] },
      ] },
    ],
  },
  contactos: {
    titulo: 'Contactos', icone: 'fa-address-book', rota: '/Contactos',
    grupos: [
      { titulo: 'Contactos gerais', campos: [
        { nome: 'email', rotulo: 'E-mail geral', tipo: 'texto', largura: 'metade' },
        { nome: 'mapa', rotulo: 'Pesquisa no mapa', tipo: 'texto', largura: 'metade', ajuda: 'Texto usado para localizar a Escola no Google Maps.' },
        { nome: 'telefones', rotulo: 'Telefones', tipo: 'listaTexto', largura: 'metade' },
        { nome: 'morada', rotulo: 'Morada (uma linha por item)', tipo: 'listaTexto', largura: 'metade' },
        { nome: 'horario', rotulo: 'Horário de atendimento', tipo: 'objetos', rotuloItem: 'Horário', campos: [
          { nome: 'dias', rotulo: 'Dias', tipo: 'texto', largura: 'metade' },
          { nome: 'horas', rotulo: 'Horas', tipo: 'texto', largura: 'metade' },
        ] },
      ] },
      { titulo: 'Departamentos', campos: [
        { nome: 'departamentos', rotulo: 'Contactos por área', tipo: 'objetos', rotuloItem: 'Área', campos: [
          { nome: 'nome', rotulo: 'Área', tipo: 'texto', largura: 'terco' },
          { nome: 'descricao', rotulo: 'Descrição', tipo: 'texto', largura: 'terco' },
          { nome: 'email', rotulo: 'E-mail', tipo: 'texto', largura: 'terco' },
        ] },
      ] },
      { titulo: 'Formulário', campos: [
        { nome: 'assuntos', rotulo: 'Assuntos do formulário de contacto', tipo: 'listaTexto' },
      ] },
    ],
  },
}

export const POSICOES_BANNER = [
  { valor: 'home-topo', rotulo: 'Página inicial — logo abaixo do topo' },
  { valor: 'home-meio', rotulo: 'Página inicial — entre os eventos e os avisos' },
  { valor: 'noticias-lateral', rotulo: 'Notícias — coluna da direita' },
  { valor: 'noticia-fim', rotulo: 'Notícia — no fim do texto' },
  { valor: 'rodape', rotulo: 'Todas as páginas — acima do rodapé' },
]

// nomes legíveis para a grelha de permissões
export const NOMES_RECURSOS = {
  noticias: 'Notícias', artigos: 'Artigos', eventos: 'Eventos', cursos: 'Cursos', pessoas: 'Corpo docente',
  publicidade: 'Publicidade', paginas: 'Páginas do site', comentarios: 'Comentários', estatisticas: 'Estatísticas',
  utilizadores: 'Utilizadores', papeis: 'Papéis e permissões', atividades: 'Registo de atividades',
}
export const NOMES_PERMISSOES = { ver: 'Ver', criar: 'Criar', editar: 'Editar', apagar: 'Apagar', publicar: 'Publicar', gerir: 'Gerir' }

export const NOMES_ACOES = {
  entrar: 'Entrou no painel',
  sair: 'Saiu do painel',
  falha_entrada: 'Tentativa de entrada falhada',
  criar: 'Criou',
  editar: 'Editou',
  apagar: 'Apagou',
  reordenar: 'Mudou a ordem',
  editar_pagina: 'Editou página',
  carregar_ficheiro: 'Carregou ficheiro',
  apagar_comentario: 'Apagou comentário',
  criar_utilizador: 'Criou utilizador',
  editar_utilizador: 'Editou utilizador',
  alterar_senha: 'Alterou a palavra-passe',
  publicar: 'Publicou',
  despublicar: 'Passou a rascunho',
  criar_papel: 'Criou papel',
  editar_papel: 'Editou papel',
  apagar_papel: 'Apagou papel',
}
