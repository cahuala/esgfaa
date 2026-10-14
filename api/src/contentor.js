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
import { ServicoPautas } from './aplicacao/pautas.js'
import { AcessoCadeiras } from './aplicacao/portal/acesso.js'
import { ServicoRecursos } from './aplicacao/portal/recursos.js'
import { RepositorioRecursosCadeira } from './infraestrutura/repositorios/recursosCadeira.js'
import { RepositorioComunicacao } from './infraestrutura/repositorios/comunicacao.js'
import { ServicoComunicacao } from './aplicacao/portal/comunicacao.js'
import { criarCorreio } from './infraestrutura/correio/correio.js'
import { RepositorioCopias } from './infraestrutura/repositorios/copias.js'
import { ServicoCopias } from './aplicacao/copias.js'
import { ServicoDisponibilidade } from './aplicacao/portal/disponibilidade.js'
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
import { ServicoSessaoPortal } from './aplicacao/portal/sessao.js'
import { ServicoPortal } from './aplicacao/portal/academico.js'
import { ServicoSecretaria } from './aplicacao/secretaria.js'

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
  const disponibilidade = new ServicoDisponibilidade({ academico: r.academico, recursos: r.recursos, relogio })
  const copias = new ServicoCopias({ copias: r.copias, academico: r.academico, privados, auditoria })
  const correio = criarCorreio({ smtp: config.smtp, remetente: config.remetente, registar: (x) => console.error(JSON.stringify(x)) })
  const notificacoes = new ServicoComunicacao({
    comunicacao: r.comunicacao, academico: r.academico, acesso, correio, relogio, urlPortal: config.urlPortal, registar: (x) => console.error(JSON.stringify(x)),
  })
  const pautas = new ServicoPautas({ academico: r.academico, recursos: r.recursos, auditoria, notificacoes, relogio })

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
    portal: new ServicoPortal({ academico: r.academico, recursos: r.recursos, pautas, notificacoes, copias, disponibilidade, privados, auditoria, relogio }),
    recursos: new ServicoRecursos({ academico: r.academico, recursos: r.recursos, acesso, notificacoes, pautas, disponibilidade, auditoria, relogio }),
    comunicacao: notificacoes,
    secretaria: new ServicoSecretaria({
      contas: r.contasPortal, academico: r.academico, recursos: r.recursos, conteudos: r.conteudos, pautas, notificacoes, copias, copiasRepo: r.copias, privados, cifra, auditoria, relogio, dominioEmail: config.dominioEmail,
      filtroHtml: filtrarHtml,
    }),
  }

  const fechar = () => prisma.$disconnect()
  return { config, prisma, fechar, relogio, repositorios, servicos, cifra, tokens, tokensPortal, armazenamento, privados, correio }
}
