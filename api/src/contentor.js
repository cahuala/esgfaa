import { criarPrisma } from './infraestrutura/bd/prisma.js'
import { RepositorioUtilizadores } from './infraestrutura/repositorios/utilizadores.js'
import { RepositorioPapeis } from './infraestrutura/repositorios/papeis.js'
import { RepositorioConteudos } from './infraestrutura/repositorios/conteudos.js'
import { RepositorioPaginas } from './infraestrutura/repositorios/paginas.js'
import { RepositorioInteracoes } from './infraestrutura/repositorios/interacoes.js'
import { RepositorioVisitas } from './infraestrutura/repositorios/visitas.js'
import { RepositorioPublicidade } from './infraestrutura/repositorios/publicidade.js'
import { RepositorioAtividades } from './infraestrutura/repositorios/atividades.js'
import { RepositorioSessoes } from './infraestrutura/repositorios/sessoes.js'
import { RepositorioCandidaturas } from './infraestrutura/repositorios/candidaturas.js'
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
import { ServicoUtilizadores } from './aplicacao/utilizadores.js'
import { ServicoPapeis } from './aplicacao/papeis.js'
import { ServicoConteudos } from './aplicacao/conteudos.js'
import { ServicoPaginas } from './aplicacao/paginas.js'
import { ServicoInteracoes } from './aplicacao/interacoes.js'
import { ServicoEstatisticas } from './aplicacao/estatisticas.js'
import { ServicoFicheiros } from './aplicacao/ficheiros.js'
import { ServicoCandidaturas } from './aplicacao/candidaturas.js'
import { ServicoSessaoPortal } from './aplicacao/academico/ensino/sessao.js'
import { ServicoPainel } from './aplicacao/academico/ensino/painel.js'
import { ServicoEstudante } from './aplicacao/academico/ensino/estudante.js'
import { ServicoFicheirosPortal } from './aplicacao/academico/ensino/ficheiros.js'
import { ServicoOrganizacao } from './aplicacao/academico/ensino/organizacao.js'
import { ServicoMateriais } from './aplicacao/academico/ensino/materiais.js'
import { ServicoPautaDocente } from './aplicacao/academico/ensino/pautaDocente.js'
import { ServicoTrabalhos } from './aplicacao/academico/ensino/trabalhos.js'
import { ServicoPresencas } from './aplicacao/academico/ensino/presencas.js'
import { ServicoForum } from './aplicacao/academico/ensino/forum.js'
import { ServicoCalendario } from './aplicacao/academico/ensino/calendario.js'
import { ServicoProgresso } from './aplicacao/academico/ensino/progresso.js'
import { ServicoQuestionarios } from './aplicacao/academico/ensino/questionarios.js'
import { ServicoContas } from './aplicacao/academico/administracao/contas.js'
import { ServicoTurmas } from './aplicacao/academico/administracao/turmas.js'
import { ServicoCadeiras } from './aplicacao/academico/administracao/cadeiras.js'
import { ServicoPautasAdministracao } from './aplicacao/academico/administracao/pautas.js'
import { ServicoCalendarioAcademico } from './aplicacao/academico/administracao/calendario.js'
import { ServicoPedidos } from './aplicacao/academico/administracao/pedidos.js'
import { ServicoAvisosGerais } from './aplicacao/academico/administracao/avisos.js'
import { ApoioCadeiras } from './aplicacao/academico/partilhado/apoio.js'

/*
  Liga todas as peças (injeção de dependências). Os testes criam um contentor com
  esquema próprio no PostgreSQL e uma pasta de uploads temporária.
*/
export function criarContentor(config, { relogio = relogioSistema, esquema = null } = {}) {
  const prisma = criarPrisma(config.urlBaseDados, { esquema })
  const fuso = config.fuso

  const repositorios = {
    utilizadores: new RepositorioUtilizadores({ prisma }),
    papeis: new RepositorioPapeis({ prisma }),
    conteudos: new RepositorioConteudos({ prisma }),
    paginas: new RepositorioPaginas({ prisma }),
    interacoes: new RepositorioInteracoes({ prisma, fuso }),
    visitas: new RepositorioVisitas({ prisma, fuso }),
    publicidade: new RepositorioPublicidade({ prisma, fuso }),
    atividades: new RepositorioAtividades({ prisma }),
    sessoes: new RepositorioSessoes({ prisma }),
    candidaturas: new RepositorioCandidaturas({ prisma }),
    contasPortal: new RepositorioContasPortal({ prisma }),
    academico: new RepositorioAcademico({ prisma }),
    recursos: new RepositorioRecursosCadeira({ prisma }),
    comunicacao: new RepositorioComunicacao({ prisma }),
    copias: new RepositorioCopias({ prisma }),
    inqueritos: new RepositorioInqueritos({ prisma }),
    grupos: new RepositorioGrupos({ prisma }),
    registos: new RepositorioRegistos({ prisma }),
    workshops: new RepositorioWorkshops({ prisma }),
    colaborativo: new RepositorioColaborativo({ prisma }),
    pesquisa: new RepositorioPesquisa({ prisma }),
  }

  const cifra = new CifraSenhas()
  const tokens = new Tokens({ segredo: config.segredoJwt, duracao: config.duracaoSessao })
  const tokensPortal = new Tokens({ segredo: config.segredoJwt, duracao: config.duracaoSessao, audiencia: AUDIENCIAS.portal })
  const privados = config.pastaPrivada ? new ArmazenamentoPrivado({ pasta: config.pastaPrivada, relogio: relogio.agora }) : null
  const armazenamento = config.pastaUploads ? new ArmazenamentoLocal({ pasta: config.pastaUploads, relogio: relogio.agora }) : null
  const auditoria = new ServicoAuditoria({ atividades: repositorios.atividades })
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
  })
  const pautas = new ServicoPautas({ academico: r.academico, recursos: r.recursos, workshops: r.workshops, auditoria, notificacoes, relogio })

  const apoio = new ApoioCadeiras({ acesso, academico: r.academico, notificacoes, privados })
  // casos de uso do portal académico (estudantes e docentes)
  const ensino = () => {
    const d = {
      academico: r.academico, recursos: r.recursos, inqueritos: r.inqueritos, grupos: r.grupos, workshops: r.workshops, contas: r.contasPortal,
      registos, pautas, notificacoes, copias, disponibilidade, privados, auditoria, relogio, acesso, apoio, filtroHtml: filtrarHtml,
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
    }
  }
  // casos de uso da Administração Escolar (painel)
  const administracaoEscolar = () => {
    const d = {
      contas: r.contasPortal, academico: r.academico, recursos: r.recursos, conteudos: r.conteudos, pautas, notificacoes, copias, copiasRepo: r.copias,
      privados, cifra, auditoria, relogio, dominioEmail: config.dominioEmail, filtroHtml: filtrarHtml,
    }
    d.servicoContas = new ServicoContas(d)
    return {
      contas: d.servicoContas,
      turmas: new ServicoTurmas(d),
      cadeiras: new ServicoCadeiras(d),
      pautas: new ServicoPautasAdministracao(d),
      calendario: new ServicoCalendarioAcademico(d),
      pedidos: new ServicoPedidos(d),
      avisos: new ServicoAvisosGerais(d),
    }
  }

  const servicos = {
    auditoria,
    conteudos,
    sessao: new ServicoSessao({ utilizadores: r.utilizadores, papeis: r.papeis, sessoes: r.sessoes, cifra, tokens, auditoria, relogio }),
    utilizadores: new ServicoUtilizadores({ utilizadores: r.utilizadores, papeis: r.papeis, atividades: r.atividades, cifra, auditoria }),
    papeis: new ServicoPapeis({ papeis: r.papeis, utilizadores: r.utilizadores, auditoria }),
    paginas: new ServicoPaginas({ paginas: r.paginas, auditoria, filtroHtml: filtrarCamposHtml }),
    interacoes: new ServicoInteracoes({ interacoes: r.interacoes, conteudos: r.conteudos, auditoria, vistasRecentes: new CacheLimitada(), titulos }),
    estatisticas: new ServicoEstatisticas({
      visitas: r.visitas, interacoes: r.interacoes, conteudos: r.conteudos, atividades: r.atividades, publicidade: r.publicidade, titulos,
    }),
    ficheiros: new ServicoFicheiros({ armazenamento, auditoria }),
    candidaturas: new ServicoCandidaturas({ candidaturas: r.candidaturas, conteudos: r.conteudos, auditoria, relogio }),
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
  }

  const fechar = () => prisma.$disconnect()
  return { config, prisma, fechar, relogio, repositorios, servicos, cifra, tokens, tokensPortal, armazenamento, privados, correio }
}
