import { criarPrisma } from './infraestrutura/bd/prisma.js'
import { CifraDados, comCifra } from './infraestrutura/bd/cifraDados.js'
import { RepositorioUtilizadores } from './infraestrutura/repositorios/utilizadores.js'
import { RepositorioPapeis } from './infraestrutura/repositorios/papeis.js'
import { RepositorioConteudos } from './infraestrutura/repositorios/conteudos.js'
import { RepositorioPaginas } from './infraestrutura/repositorios/paginas.js'
import { RepositorioInteracoes } from './infraestrutura/repositorios/interacoes.js'
import { RepositorioContactos } from './infraestrutura/repositorios/contactos.js'
import { RepositorioPacotes } from './infraestrutura/repositorios/pacotes.js'
import { RepositorioLti } from './infraestrutura/repositorios/lti.js'
import { RepositorioSeguranca } from './infraestrutura/repositorios/seguranca.js'
import { Monitor } from './infraestrutura/monitor/monitor.js'
import { ServicoSeguranca } from './aplicacao/seguranca.js'
import { chavesLti } from './infraestrutura/lti/chaves.js'
import { ServicoLti } from './aplicacao/academico/lti.js'
import { RepositorioVisitas } from './infraestrutura/repositorios/visitas.js'
import { RepositorioPublicidade } from './infraestrutura/repositorios/publicidade.js'
import { RepositorioAtividades } from './infraestrutura/repositorios/atividades.js'
import { RepositorioSessoes } from './infraestrutura/repositorios/sessoes.js'
import { RepositorioContasPortal } from './infraestrutura/repositorios/contasPortal.js'
import { RepositorioAcademico } from './infraestrutura/repositorios/academico.js'
import { ArmazenamentoPrivado } from './infraestrutura/ficheiros/privados.js'
import { CifraSenhas } from './infraestrutura/seguranca/cifra.js'
import { AUDIENCIAS, Tokens } from './infraestrutura/seguranca/tokens.js'
import { CacheLimitada } from './infraestrutura/seguranca/cacheLimitada.js'
import { ArmazenamentoLocal } from './infraestrutura/ficheiros/armazenamento.js'
import { filtrarCamposHtml, filtrarHtml } from './infraestrutura/html/filtroHtml.js'
import { ServicoPautas } from './aplicacao/academico/partilhado/pautas.js'
import { AcessoCadeiras } from './aplicacao/academico/partilhado/acesso.js'
import { RepositorioRecursosCadeira } from './infraestrutura/repositorios/recursosCadeira.js'
import { RepositorioComunicacao } from './infraestrutura/repositorios/comunicacao.js'
import { ServicoComunicacao } from './aplicacao/academico/partilhado/comunicacao.js'
import { criarCorreio } from './infraestrutura/correio/correio.js'
import { criarPush } from './infraestrutura/push/webPush.js'
import { RepositorioCopias } from './infraestrutura/repositorios/copias.js'
import { RepositorioInqueritos } from './infraestrutura/repositorios/inqueritos.js'
import { RepositorioGrupos } from './infraestrutura/repositorios/grupos.js'
import { ServicoGrupos } from './aplicacao/academico/ensino/grupos.js'
import { RepositorioRegistos } from './infraestrutura/repositorios/registos.js'
import { ServicoRegistos } from './aplicacao/academico/partilhado/registos.js'
import { ServicoIndicadores } from './aplicacao/academico/administracao/indicadores.js'
import { RepositorioWorkshops } from './infraestrutura/repositorios/workshops.js'
import { ServicoWorkshops } from './aplicacao/academico/ensino/workshops.js'
import { RepositorioColaborativo } from './infraestrutura/repositorios/colaborativo.js'
import { ServicoColaborativo } from './aplicacao/academico/ensino/colaborativo.js'
import { RepositorioPesquisa } from './infraestrutura/repositorios/pesquisa.js'
import { ServicoPesquisa } from './aplicacao/academico/ensino/pesquisa.js'
import { ServicoInqueritos } from './aplicacao/academico/ensino/inqueritos.js'
import { ServicoCopias } from './aplicacao/academico/partilhado/copias.js'
import { ServicoDisponibilidade } from './aplicacao/academico/partilhado/disponibilidade.js'
import { relogioSistema } from './infraestrutura/relogio.js'
import { ServicoAuditoria } from './aplicacao/auditoria.js'
import { ServicoSessao } from './aplicacao/sessao.js'
import { ServicoDoisFatores } from './aplicacao/doisFatores.js'
import { ServicoUtilizadores } from './aplicacao/utilizadores.js'
import { ServicoPapeis } from './aplicacao/papeis.js'
import { ServicoConteudos } from './aplicacao/conteudos.js'
import { ServicoPaginas } from './aplicacao/paginas.js'
import { ServicoInteracoes } from './aplicacao/interacoes.js'
import { ServicoContactos } from './aplicacao/contactos.js'
import { ServicoEstatisticas } from './aplicacao/estatisticas.js'
import { ServicoFicheiros } from './aplicacao/ficheiros.js'
import { ServicoSessaoPortal } from './aplicacao/academico/ensino/sessao.js'
import { ServicoPainel } from './aplicacao/academico/ensino/painel.js'
import { ServicoEstudante } from './aplicacao/academico/ensino/estudante.js'
import { ServicoFicheirosPortal } from './aplicacao/academico/ensino/ficheiros.js'
import { ServicoOrganizacao } from './aplicacao/academico/ensino/organizacao.js'
import { ServicoMateriais } from './aplicacao/academico/ensino/materiais.js'
import { ServicoCopiaSeguranca } from './aplicacao/academico/ensino/copiaSeguranca.js'
import { ServicoPacotes } from './aplicacao/academico/ensino/pacotes.js'
import { ServicoPautaDocente } from './aplicacao/academico/ensino/pautaDocente.js'
import { ServicoPrazosNotas } from './aplicacao/academico/administracao/prazosNotas.js'
import { ServicoPrivacidade } from './aplicacao/privacidade.js'
import { RepositorioPrazosNotas } from './infraestrutura/repositorios/prazosNotas.js'
import { ServicoTrabalhos } from './aplicacao/academico/ensino/trabalhos.js'
import { ServicoPresencas } from './aplicacao/academico/ensino/presencas.js'
import { ServicoForum } from './aplicacao/academico/ensino/forum.js'
import { ServicoCalendario } from './aplicacao/academico/ensino/calendario.js'
import { ServicoProgresso } from './aplicacao/academico/ensino/progresso.js'
import { ServicoQuestionarios } from './aplicacao/academico/ensino/questionarios.js'
import { ServicoLicoes } from './aplicacao/academico/ensino/licoes.js'
import { ServicoRegistoPessoal } from './aplicacao/academico/pessoal/registo.js'
import { ServicoTurmas } from './aplicacao/academico/administracao/turmas.js'
import { ServicoCadeiras } from './aplicacao/academico/administracao/cadeiras.js'
import { ServicoPautasAdministracao } from './aplicacao/academico/administracao/pautas.js'
import { ServicoCalendarioAcademico } from './aplicacao/academico/administracao/calendario.js'
import { ServicoPedidos } from './aplicacao/academico/administracao/pedidos.js'
import { ServicoAvisosGerais } from './aplicacao/academico/administracao/avisos.js'
import { ApoioCadeiras } from './aplicacao/academico/partilhado/apoio.js'
import { ServicoInscricoes } from './aplicacao/academico/administracao/inscricoes.js'
import { ServicoConclusaoCurso } from './aplicacao/academico/administracao/conclusao.js'
import { ServicoDocumentos } from './aplicacao/academico/administracao/documentos.js'
import { ServicoPercursos } from './aplicacao/academico/partilhado/percursos.js'
import { RepositorioQualidade } from './infraestrutura/repositorios/qualidade.js'
import { ServicoInqueritosInstitucionais } from './aplicacao/qualidade/inqueritos.js'
import { RepositorioConclusao } from './infraestrutura/repositorios/conclusao.js'
import { RepositorioBiblioteca } from './infraestrutura/repositorios/biblioteca.js'
import { ServicoCatalogo } from './aplicacao/biblioteca/catalogo.js'
import { ServicoCirculacao } from './aplicacao/biblioteca/circulacao.js'
import { RepositorioIntegridade } from './infraestrutura/repositorios/integridade.js'
import { ServicoOriginalidade } from './aplicacao/integridade/originalidade.js'
import { extrairTexto } from './infraestrutura/texto/extrair.js'
import { criarOcr } from './infraestrutura/texto/ocr.js'
import { PesquisaBrave } from './infraestrutura/web/pesquisaBrave.js'
import { obterPagina } from './infraestrutura/web/paginas.js'
import { ClienteClaude } from './infraestrutura/ia/claude.js'
import { RepositorioTraducoes } from './infraestrutura/repositorios/traducoes.js'
import { ServicoTraducoes } from './aplicacao/traducoes/traducoes.js'
import { ServicoTraducaoDados } from './aplicacao/traducoes/traducaoDados.js'
import { traduzirComClaude } from './aplicacao/traducoes/traducaoIA.js'
import { TradutorLibre } from './infraestrutura/traducao/libreTranslate.js'

/*
  Liga todas as peças (injeção de dependências). Os testes criam um contentor com
  esquema próprio no PostgreSQL e uma pasta de uploads temporária.
*/
export function criarContentor(config, { relogio = relogioSistema, esquema = null, externos = {} } = {}) {
  const prismaBase = criarPrisma(config.urlBaseDados, { esquema, maximoLigacoes: config.ligacoesBaseDados })
  const cifraDados = new CifraDados(config.chaveDados)
  // os dados pessoais (dados das contas, candidaturas, mensagens de contacto) vão cifrados (cifraDados.js)
  const prisma = comCifra(prismaBase, cifraDados)
  const fuso = config.fuso

  const repositorios = {
    utilizadores: new RepositorioUtilizadores({ prisma }),
    papeis: new RepositorioPapeis({ prisma }),
    conteudos: new RepositorioConteudos({ prisma }),
    paginas: new RepositorioPaginas({ prisma }),
    interacoes: new RepositorioInteracoes({ prisma, fuso }),
    contactos: new RepositorioContactos({ prisma }),
    pacotes: new RepositorioPacotes({ prisma }),
    lti: new RepositorioLti({ prisma }),
    seguranca: new RepositorioSeguranca({ prisma }),
    visitas: new RepositorioVisitas({ prisma, fuso }),
    publicidade: new RepositorioPublicidade({ prisma, fuso }),
    atividades: new RepositorioAtividades({ prisma }),
    sessoes: new RepositorioSessoes({ prisma }),
    contasPortal: new RepositorioContasPortal({ prisma }),
    academico: new RepositorioAcademico({ prisma }),
    recursos: new RepositorioRecursosCadeira({ prisma }),
    prazosNotas: new RepositorioPrazosNotas({ prisma }),
    comunicacao: new RepositorioComunicacao({ prisma }),
    copias: new RepositorioCopias({ prisma }),
    inqueritos: new RepositorioInqueritos({ prisma }),
    grupos: new RepositorioGrupos({ prisma }),
    registos: new RepositorioRegistos({ prisma }),
    workshops: new RepositorioWorkshops({ prisma }),
    colaborativo: new RepositorioColaborativo({ prisma }),
    pesquisa: new RepositorioPesquisa({ prisma }),
    conclusao: new RepositorioConclusao({ prisma }),
    qualidade: new RepositorioQualidade({ prisma }),
    biblioteca: new RepositorioBiblioteca({ prisma }),
    integridade: new RepositorioIntegridade({ prisma }),
    traducoes: new RepositorioTraducoes({ prisma }),
  }

  const cifra = new CifraSenhas()
  const tokens = new Tokens({ segredo: config.segredoJwt, duracao: config.duracaoSessao })
  const tokensPortal = new Tokens({ segredo: config.segredoJwt, duracao: config.duracaoSessao, audiencia: AUDIENCIAS.portal })
  const privados = config.pastaPrivada ? new ArmazenamentoPrivado({ pasta: config.pastaPrivada, relogio: relogio.agora }) : null
  const armazenamento = config.pastaUploads ? new ArmazenamentoLocal({ pasta: config.pastaUploads, relogio: relogio.agora }) : null
  const auditoria = new ServicoAuditoria({ atividades: repositorios.atividades })
  const doisFatores = new ServicoDoisFatores({ prisma, auditoria, relogio, papeis: config.doisFatoresPapeis })
  const r = repositorios

  const conteudos = new ServicoConteudos({
    conteudos: r.conteudos, interacoes: r.interacoes, publicidade: r.publicidade, auditoria, filtroHtml: filtrarCamposHtml, relogio,
  })
  const titulos = () => conteudos.titulosInterativos()
  const acesso = new AcessoCadeiras({ academico: r.academico })
  const disponibilidade = new ServicoDisponibilidade({ academico: r.academico, recursos: r.recursos, inqueritos: r.inqueritos, workshops: r.workshops, relogio })
  const registos = new ServicoRegistos({ registos: r.registos, academico: r.academico, acesso, disponibilidade, relogio, registarErro: (x) => console.error(JSON.stringify(x)) })
  const copias = new ServicoCopias({ copias: r.copias, academico: r.academico, privados, auditoria })
  const correio = criarCorreio({ smtp: config.smtp, remetente: config.remetente, registar: (x) => console.error(JSON.stringify(x)) })
  const notificacoes = new ServicoComunicacao({
    comunicacao: r.comunicacao, academico: r.academico, acesso, correio, relogio, urlPortal: config.urlPortal, registar: (x) => console.error(JSON.stringify(x)),
    // avisos no telemóvel (os testes trazem um falso; null desliga)
    push: 'push' in externos ? externos.push : criarPush(config),
  })
  const pautas = new ServicoPautas({ academico: r.academico, recursos: r.recursos, workshops: r.workshops, prazosNotas: r.prazosNotas, fuso: config.fuso, auditoria, notificacoes, relogio })

  const percursos = new ServicoPercursos({ academico: r.academico, conclusao: r.conclusao })
  const apoio = new ApoioCadeiras({ acesso, academico: r.academico, notificacoes, privados })
  // serviços externos opcionais: sem chave ficam desligados (os testes substituem-nos)
  // Lei n.º 22/11: a IA e a pesquisa externas (fora de Angola) só com autorização expressa (DADOS_FORA_DE_ANGOLA=sim)
  const fora = config.dadosForaDeAngola
  const claude = fora && config.ia?.chave ? new ClienteClaude({ chave: config.ia.chave, modelo: config.ia.modelo }) : null
  const ext = {
    pesquisaWeb: fora && config.pesquisaWeb?.chave ? new PesquisaBrave({ chave: config.pesquisaWeb.chave }) : null,
    obterPagina, claude, ...externos,
  }
  // tradução dos conteúdos: o Claude (melhor) ou o LibreTranslate (gratuito, no servidor)
  if (!('tradutor' in externos)) {
    ext.tradutor = ext.claude ? { nome: 'Claude (IA)', traduzirMapa: (m, l) => traduzirComClaude(ext.claude, m, l) }
      : config.tradutor?.url ? Object.assign(new TradutorLibre(config.tradutor), { nome: 'LibreTranslate' }) : null
  }
  // anti-plágio: indexa trabalhos entregues e obras digitais, e compara em fila
  const originalidade = new ServicoOriginalidade({
    pesquisaWeb: ext.pesquisaWeb, obterPagina: ext.obterPagina, claude: ext.claude, pesquisasPorDocumento: config.pesquisaWeb?.porDocumento ?? 8,
    // tradução (paráfrase noutra língua) e OCR dos PDF digitalizados: correm no servidor (o Claude só se autorizado)
    tradutor: ext.tradutor, ocr: 'ocr' in externos ? externos.ocr : criarOcr(),
    integridade: r.integridade, academico: r.academico, contas: r.contasPortal, biblioteca: r.biblioteca, privados, extrair: extrairTexto, apoio, auditoria, relogio,
    registarErro: (x) => console.error(JSON.stringify(x)),
  })
  // casos de uso do portal académico (estudantes e docentes)
  const ensino = () => {
    const lti = new ServicoLti({ lti: r.lti, academico: r.academico, contas: r.contasPortal, apoio, disponibilidade, registos, auditoria, chaves: chavesLti(config.pastaDados), segredo: config.segredoJwt })
    const pacotes = new ServicoPacotes({ pacotes: r.pacotes, academico: r.academico, recursos: r.recursos, contas: r.contasPortal, apoio, disponibilidade, registos, privados, segredo: config.segredoJwt })
    const d = {
      lti, pacotes, academico: r.academico, recursos: r.recursos, inqueritos: r.inqueritos, grupos: r.grupos, workshops: r.workshops, contas: r.contasPortal,
      registos, pautas, notificacoes, copias, disponibilidade, privados, auditoria, relogio, acesso, apoio, percursos, certificadosCurso: r.conclusao, filtroHtml: filtrarHtml, originalidade, jitsiUrl: config.jitsiUrl,
    }
    return {
      painel: new ServicoPainel(d),
      estudante: new ServicoEstudante(d),
      ficheiros: new ServicoFicheirosPortal(d),
      organizacao: new ServicoOrganizacao(d),
      materiais: new ServicoMateriais(d),
      pautaDocente: new ServicoPautaDocente(d),
      trabalhos: new ServicoTrabalhos(d),
      presencas: new ServicoPresencas(d),
      forum: new ServicoForum(d),
      calendario: new ServicoCalendario(d),
      progresso: new ServicoProgresso(d),
      questionarios: new ServicoQuestionarios(d),
      licoes: new ServicoLicoes(d),
      pacotes,
      lti,
      copiaSeguranca: new ServicoCopiaSeguranca({ copiasRepo: r.copias, academico: r.academico, privados, apoio, auditoria, filtroHtml: filtrarHtml, relogio, config }),
    }
  }
  // casos de uso da Administração Escolar (painel)
  const administracaoEscolar = () => {
    const d = {
      contas: r.contasPortal, academico: r.academico, recursos: r.recursos, conteudos: r.conteudos, pautas, notificacoes, copias, copiasRepo: r.copias,
      privados, cifra, auditoria, relogio, dominioEmail: config.dominioEmail, filtroHtml: filtrarHtml, percursos, conclusao: r.conclusao, paginas: r.paginas,
    }
    return {
      inscricoes: new ServicoInscricoes(d),
      conclusao: new ServicoConclusaoCurso(d),
      documentos: new ServicoDocumentos(d),
      turmas: new ServicoTurmas(d),
      cadeiras: new ServicoCadeiras(d),
      pautas: new ServicoPautasAdministracao(d),
      calendario: new ServicoCalendarioAcademico(d),
      prazosNotas: new ServicoPrazosNotas({ ...d, prazosNotas: r.prazosNotas }),
      pedidos: new ServicoPedidos(d),
      avisos: new ServicoAvisosGerais(d),
    }
  }

  const traducoes = new ServicoTraducoes({ traducoes: r.traducoes, conteudos: r.conteudos, paginas: r.paginas, tradutor: ext.tradutor, auditoria, registarErro: (x) => console.error(JSON.stringify(x)) })
  conteudos.aoPublicar = (colecao, id) => traducoes.agendar(colecao, id)

  const servicos = {
    auditoria,
    conteudos,
    sessao: new ServicoSessao({ utilizadores: r.utilizadores, papeis: r.papeis, sessoes: r.sessoes, cifra, tokens, auditoria, relogio, doisFatores }),
    doisFatores,
    utilizadores: new ServicoUtilizadores({ utilizadores: r.utilizadores, papeis: r.papeis, atividades: r.atividades, cifra, auditoria }),
    papeis: new ServicoPapeis({ papeis: r.papeis, utilizadores: r.utilizadores, auditoria }),
    paginas: Object.assign(new ServicoPaginas({ paginas: r.paginas, auditoria, filtroHtml: filtrarCamposHtml }), { aoPublicar: (c, id) => traducoes.agendar(c, id) }),
    privacidade: new ServicoPrivacidade({ prisma, notificacoes, auditoria, relogio, conservacao: config.conservacao }),
    seguranca: new ServicoSeguranca({ monitor: new Monitor(), seguranca: r.seguranca, correio, emailAlerta: config.emailSeguranca, auditoria, pastaDados: config.pastaDados, registar: (x) => console.error(JSON.stringify(x)) }),
    contactos: new ServicoContactos({ contactos: r.contactos, correio, emailDestino: config.emailContactos, auditoria, registar: (x) => console.error(JSON.stringify(x)) }),
    interacoes: new ServicoInteracoes({ interacoes: r.interacoes, conteudos: r.conteudos, auditoria, vistasRecentes: new CacheLimitada(), titulos }),
    estatisticas: new ServicoEstatisticas({
      visitas: r.visitas, interacoes: r.interacoes, conteudos: r.conteudos, atividades: r.atividades, publicidade: r.publicidade, titulos,
    }),
    ficheiros: new ServicoFicheiros({ armazenamento, auditoria }),
    sessaoPortal: new ServicoSessaoPortal({ contas: r.contasPortal, sessoes: r.sessoes, cifra, tokens: tokensPortal, auditoria, relogio, academico: r.academico }),
    comunicacao: notificacoes,
    grupos: new ServicoGrupos({ grupos: r.grupos, academico: r.academico, acesso }),
    registos,
    workshops: new ServicoWorkshops({ workshops: r.workshops, academico: r.academico, acesso, disponibilidade, privados, notificacoes, pautas, registos, relogio }),
    colaborativo: new ServicoColaborativo({ colaborativo: r.colaborativo, acesso, notificacoes, filtroHtml: filtrarHtml, relogio }),
    pesquisa: new ServicoPesquisa({ pesquisa: r.pesquisa, acesso, disponibilidade }),
    indicadores: new ServicoIndicadores({ academico: r.academico, recursos: r.recursos, pautas, relogio }),
    inqueritos: new ServicoInqueritos({ inqueritos: r.inqueritos, academico: r.academico, acesso, disponibilidade, notificacoes, registos, auditoria, relogio }),
    ensino: ensino(),
    administracaoEscolar: administracaoEscolar(),
    // qualidade: inquéritos institucionais de satisfação
    qualidade: { inqueritos: new ServicoInqueritosInstitucionais({ qualidade: r.qualidade, academico: r.academico, notificacoes, auditoria, relogio }) },
    integridade: originalidade,
    // traduções do site (redação, com rascunho da IA se houver chave)
    traducoes,
    traducaoDados: new ServicoTraducaoDados({ traducoes: r.traducoes, tradutor: ext.tradutor, registarErro: (x) => console.error(JSON.stringify(x)) }),
    // biblioteca: catálogo e circulação
    biblioteca: {
      catalogo: new ServicoCatalogo({ biblioteca: r.biblioteca, academico: r.academico, privados, auditoria, relogio, originalidade }),
      circulacao: new ServicoCirculacao({ biblioteca: r.biblioteca, contas: r.contasPortal, notificacoes, auditoria, relogio }),
    },
    // Repartição de Pessoal e Quadros: registo de estudantes e docentes
    pessoal: {
      registo: new ServicoRegistoPessoal({ contas: r.contasPortal, cifra, auditoria, relogio, privados, dominioEmail: config.dominioEmail }),
    },
  }

  const fechar = async () => { await servicos.seguranca.parar(); await prismaBase.$disconnect() }
  return { config, prisma, prismaBase, cifraDados, fechar, relogio, repositorios, servicos, cifra, tokens, tokensPortal, armazenamento, privados, correio }
}
