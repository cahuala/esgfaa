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

// liga as peças: base de dados, segurança e serviços (os testes passam outro esquema, relógio e envio)
export function criarContentor(config, { esquema = null, agora, enviar } = {}) {
  const bd = criarPrisma(config.urlBaseDados, { esquema, maximoLigacoes: config.ligacoesBd })
  const relogio = agora ? { agora } : {}
  const auditoria = new ServicoAuditoria({ bd })
  const pessoas = new ServicoPessoas({ bd, auditoria, ...relogio })
  const servicos = {
    auditoria,
    sessao: new ServicoSessao({ bd, auditoria, cifra: new CifraSenhas(), tokens: new Tokens({ segredo: config.segredoJwt, duracao: config.duracaoSessao }), ...relogio }),
    pessoas,
    propostas: new ServicoPropostas({ bd, auditoria, ...relogio }),
    licencas: new ServicoLicencas({ bd, auditoria, ...relogio }),
    organica: new ServicoOrganica({ bd, auditoria }),
    painel: new ServicoPainel({ bd, pessoas, ...relogio }),
    sincronizacao: new ServicoSincronizacao({ bd, auditoria, config, ...(enviar ? { enviar } : {}), ...relogio }),
  }
  return { config, bd, servicos, fechar: () => bd.$disconnect() }
}
