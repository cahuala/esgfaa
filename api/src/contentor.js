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
import { CifraSenhas } from './infraestrutura/seguranca/cifra.js'
import { Tokens } from './infraestrutura/seguranca/tokens.js'
import { CacheLimitada } from './infraestrutura/seguranca/cacheLimitada.js'
import { ArmazenamentoLocal } from './infraestrutura/ficheiros/armazenamento.js'
import { filtrarCamposHtml } from './infraestrutura/html/filtroHtml.js'
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
  }

  const cifra = new CifraSenhas()
  const tokens = new Tokens({ segredo: config.segredoJwt, duracao: config.duracaoSessao })
  const armazenamento = config.pastaUploads ? new ArmazenamentoLocal({ pasta: config.pastaUploads, relogio: relogio.agora }) : null
  const auditoria = new ServicoAuditoria({ atividades: repositorios.atividades })
  const r = repositorios

  const conteudos = new ServicoConteudos({
    conteudos: r.conteudos, interacoes: r.interacoes, publicidade: r.publicidade, auditoria, filtroHtml: filtrarCamposHtml, relogio,
  })
  const titulos = () => conteudos.titulosInterativos()

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
  }

  const fechar = () => prisma.$disconnect()
  return { config, prisma, fechar, relogio, repositorios, servicos, cifra, tokens, armazenamento }
}
