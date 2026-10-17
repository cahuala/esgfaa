import { criarPrisma } from './infraestrutura/bd.js'
import { CifraSenhas } from './infraestrutura/cifra.js'
import { Tokens } from './infraestrutura/tokens.js'
import { ServicoAuditoria } from './aplicacao/auditoria.js'
import { ServicoSessao } from './aplicacao/sessao.js'
import { ServicoPessoas } from './aplicacao/pessoas.js'
import { ServicoPropostas } from './aplicacao/propostas.js'
import { ServicoLicencas } from './aplicacao/licencas.js'
import { ServicoOrganica } from './aplicacao/organica.js'
import { ServicoPainel } from './aplicacao/painel.js'
import { ServicoSincronizacao } from './aplicacao/sincronizacao.js'
import { ServicoImportacao } from './aplicacao/importacao.js'
import { ServicoProcessos } from './aplicacao/processos.js'
import { ServicoExtractos } from './aplicacao/extractos.js'
import { ServicoExpediente } from './aplicacao/expediente.js'
import { ServicoMensagens } from './aplicacao/mensagens.js'
import { Ficheiros } from './infraestrutura/ficheiros.js'

// liga as peças: base de dados, segurança e serviços (os testes passam outro esquema, relógio e envio)
export function criarContentor(config, { esquema = null, agora, enviar, enviarBi } = {}) {
  const bd = criarPrisma(config.urlBaseDados, { esquema, maximoLigacoes: config.ligacoesBd })
  const relogio = agora ? { agora } : {}
  const auditoria = new ServicoAuditoria({ bd })
  const pessoas = new ServicoPessoas({ bd, auditoria, config, ...(enviarBi ? { enviar: enviarBi } : {}), ...relogio })
  const ficheiros = new Ficheiros(config.pastaFicheiros)
  const servicos = {
    auditoria,
    sessao: new ServicoSessao({ bd, auditoria, cifra: new CifraSenhas(), tokens: new Tokens({ segredo: config.segredoJwt, duracao: config.duracaoSessao }), ...relogio }),
    pessoas,
    propostas: new ServicoPropostas({ bd, auditoria, ...relogio }),
    licencas: new ServicoLicencas({ bd, auditoria, ...relogio }),
    organica: new ServicoOrganica({ bd, auditoria }),
    painel: new ServicoPainel({ bd, pessoas, ...relogio }),
    importacao: new ServicoImportacao({ bd, pessoas, auditoria }),
    processos: new ServicoProcessos({ bd, auditoria, ficheiros }),
    extractos: new ServicoExtractos({ bd, auditoria, ficheiros, ...relogio }),
    expediente: new ServicoExpediente({ bd, auditoria, ficheiros, ...relogio }),
    mensagens: new ServicoMensagens({ bd, ficheiros, ...relogio }),
    sincronizacao: new ServicoSincronizacao({ bd, auditoria, config, ...(enviar ? { enviar } : {}), ...relogio }),
  }
  // um docente ou estudante alterado vai para o portal daí a poucos segundos (não espera pelo minuto)
  if (!config.teste) pessoas.aoMudarPortal = () => servicos.sincronizacao.agendar()
  return { config, bd, servicos, fechar: () => bd.$disconnect() }
}
