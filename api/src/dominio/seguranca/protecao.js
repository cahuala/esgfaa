/*
  Defesa activa: níveis de protecção e serviços que se desligam durante um ataque.
  O nível e os serviços desligados guardam-se na base de dados; cada pedido passa por decidirPedido()
  antes de chegar às rotas. O que fica sempre aberto: o estado do servidor, a entrada no painel e o
  Centro de segurança (para quem defende poder voltar a ligar tudo) e os endereços da lista de confiança.
  Com a API fechada, o site público continua a mostrar os conteúdos que vêm com ele.
*/

// serviços que se podem desligar um a um: [nome, o que fica fechado]
export const SERVICOS = {
  portal: { nome: 'Portal Académico', descricao: 'Entrada e uso do portal pelos docentes e estudantes.' },
  painel: { nome: 'Painel de gestão', descricao: 'Tudo o painel, menos a entrada e o Centro de segurança.' },
  escritaPublica: { nome: 'Formulários do site', descricao: 'Comentários, mensagens de contacto, gostos e o registo das visitas.' },
  sitePublico: { nome: 'Conteúdos do site pela API', descricao: 'O site passa a mostrar só os conteúdos que traz consigo.' },
  ficheiros: { nome: 'Envio e descarga de ficheiros', descricao: 'Carregar ficheiros e abrir os ficheiros carregados (uploads).' },
  integracao: { nome: 'Ligação ao Sistema de Pessoal', descricao: 'A entrada das contas enviadas pelo Pessoal (fica em fila do lado do Pessoal).' },
  externos: { nome: 'Pacotes e LTI', descricao: 'Pacotes de conteúdos e ferramentas externas (LTI).' },
}

// níveis: o que cada um desliga e como reage ao ataque
export const NIVEIS = {
  normal: { nome: 'Normal', descricao: 'Tudo ligado; os robôs que procuram falhas ficam bloqueados 24 horas.', desliga: [] },
  reforcado: { nome: 'Reforçado', descricao: 'Tudo ligado, mas os bloqueios automáticos são mais rápidos (também por palavras-passe erradas) e duram 3 dias.', desliga: [] },
  emergencia: { nome: 'Emergência', descricao: 'Fecha o portal, os formulários do site, os ficheiros e as ligações externas; o site mostra os conteúdos que traz; o painel fica só para a segurança.', desliga: ['portal', 'painel', 'escritaPublica', 'ficheiros', 'integracao', 'externos'] },
  isolamento: { nome: 'Isolamento', descricao: 'Desliga tudo. Só respondem a entrada no painel, o Centro de segurança e os endereços de confiança.', desliga: Object.keys(SERVICOS) },
}

// regras dos bloqueios automáticos por nível (em 5 minutos, por endereço)
export const REGRAS_BLOQUEIO = {
  normal: { sondagem: 20, injecao: 5, login_falhado: null, horas: 24 },
  reforcado: { sondagem: 5, injecao: 1, login_falhado: 15, horas: 72 },
  emergencia: { sondagem: 3, injecao: 1, login_falhado: 8, horas: 168 },
  isolamento: { sondagem: 3, injecao: 1, login_falhado: 8, horas: 168 },
}

export const PROTECAO_INICIAL = { nivel: 'normal', desligados: [], automatico: true, confianca: [], motivo: '', alteradoPor: '', alteradoEm: null, automaticoDesde: null }

// o que fica sempre aberto: estado do servidor, entrada e sessão no painel, Centro de segurança
const SEMPRE = /^\/api\/(saude|admin\/(entrar|sair|eu(\/|$)|seguranca(\/|$)))/

// a que serviço pertence um pedido (null = não se desliga)
export function servicoDoPedido(metodo, caminho) {
  if (/^\/(api\/)?uploads\//.test(caminho)) return 'ficheiros'
  if (caminho.startsWith('/api/portal')) return 'portal'
  if (caminho.startsWith('/api/integracao')) return 'integracao'
  if (caminho.startsWith('/api/pacotes') || caminho.startsWith('/api/lti')) return 'externos'
  if (caminho.startsWith('/api/admin')) return 'painel'
  // no site: ler é «conteúdos»; tudo o que o visitante envia (comentários, contactos, gostos, visitas) é «formulários»
  if (caminho.startsWith('/api/publico')) return metodo === 'GET' || metodo === 'HEAD' ? 'sitePublico' : 'escritaPublica'
  return null
}

// endereço numa lista de confiança (IP exacto ou rede IPv4 com /8, /16 ou /24)
export function confiavel(ip, lista = []) {
  const x = String(ip || '').replace(/^::ffff:/, '')
  return lista.some((r) => {
    const [base, bits] = String(r).split('/')
    if (!bits) return base === x
    const n = Number(bits)
    if (![8, 16, 24].includes(n)) return false
    return x.split('.').slice(0, n / 8).join('.') === base.split('.').slice(0, n / 8).join('.')
  })
}

export const desligadosDe = (p) => [...new Set([...(NIVEIS[p.nivel]?.desliga ?? []), ...(p.desligados ?? [])])]

// null = deixa passar; senão a resposta a dar (503, com a mensagem para quem usa)
export function decidirPedido(protecao, { metodo, caminho, ip }) {
  const fora = desligadosDe(protecao)
  if (!fora.length || SEMPRE.test(caminho) || confiavel(ip, protecao.confianca)) return null
  const s = servicoDoPedido(metodo, caminho)
  if (!s || !fora.includes(s)) return null
  return { estado: 503, erro: `${SERVICOS[s].nome}: temporariamente fechado por motivos de segurança. Tente mais tarde.`, codigo: 'servico_fechado', servico: s }
}
