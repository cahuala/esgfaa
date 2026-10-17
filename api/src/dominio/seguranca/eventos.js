/*
  Eventos de segurança: o que, nos pedidos que chegam à API, mostra alguém a tentar entrar onde não deve.
  Cada pedido é classificado pela resposta que recebeu (e pelo endereço pedido). Nada disto bloqueia
  o pedido — os bloqueios já existem nas regras de acesso; isto serve para ver e para avisar.
*/
export const TIPOS_EVENTO = {
  login_falhado: { nome: 'Palavra-passe errada', gravidade: 1 },
  conta_bloqueada: { nome: 'Conta bloqueada por tentativas', gravidade: 2 },
  limite: { nome: 'Demasiados pedidos (travado)', gravidade: 1 },
  sessao_invalida: { nome: 'Pedido sem sessão válida', gravidade: 0 },
  acesso_negado: { nome: 'Acesso negado (sem permissão)', gravidade: 1 },
  sondagem: { nome: 'Procura de ficheiros ou páginas de ataque', gravidade: 2 },
  injecao: { nome: 'Tentativa de injeção (SQL, script, caminhos)', gravidade: 3 },
  erro_interno: { nome: 'Erro do servidor', gravidade: 1 },
  ip_bloqueado: { nome: 'Pedido de um endereço bloqueado', gravidade: 1 },
}

// endereços que só um programa de ataque pede (WordPress, painéis de bases de dados, ficheiros de configuração…)
const SONDAGEM = /(\/\.env|\/\.git|\/\.svn|\/\.ds_store|wp-(admin|login|content|includes)|xmlrpc\.php|phpmyadmin|\/pma\b|adminer|\/cgi-bin|\.php\b|\.asp\b|\.aspx\b|\.jsp\b|\/actuator|\/server-status|\/vendor\/|\/config\.(json|ya?ml)|\/backup|\.sql\b|\.bak\b|\/etc\/passwd|\/boaform|\/HNAP1|\/owa\/|\/solr\/|\/console\b)/i
// sinais de injeção no endereço (já descodificado)
const INJECAO = /(\.\.\/|\.\.\\|<script|javascript:|onerror\s*=|union(\s|\+|\/\*.*\*\/)+select|\bor\b\s+1\s*=\s*1|';\s*(drop|delete|insert|update)\b|sleep\s*\(\s*\d+\s*\)|\$\{jndi:|\{\{.*\}\}|\bexec\s*\(|\/proc\/self)/i

const descodificar = (u) => {
  let s = String(u || '')
  for (let i = 0; i < 2; i++) { try { const d = decodeURIComponent(s.replace(/\+/g, ' ')); if (d === s) break; s = d } catch { break } }
  return s
}

// tipo do evento de um pedido já respondido (ou null, se foi um pedido normal)
export function classificarPedido({ metodo, url, estado }) {
  const u = descodificar(url)
  const caminho = u.split('?')[0]
  if (INJECAO.test(u)) return 'injecao'
  if (estado === 404 && SONDAGEM.test(caminho)) return 'sondagem'
  if (estado === 423) return 'conta_bloqueada'
  if (estado === 429) return 'limite'
  if (metodo === 'POST' && /\/entrar$/.test(caminho) && (estado === 401 || estado === 400)) return 'login_falhado'
  if (estado === 401) return 'sessao_invalida'
  if (estado === 403) return 'acesso_negado'
  if (estado >= 500) return 'erro_interno'
  return null
}

/*
  Nível de alerta pelos últimos 5 minutos: normal, atenção ou ataque (com os motivos).
  Os limites pensam numa escola: muitos erros de palavra-passe seguidos, robôs a procurar falhas,
  injeções (que nunca acontecem por engano) ou o servidor a falhar.
*/
export const LIMITES_ALERTA = {
  login_falhado: [15, 50], conta_bloqueada: [2, 6], limite: [100, 600], acesso_negado: [30, 150],
  sondagem: [10, 60], injecao: [1, 10], erro_interno: [10, 50],
}

export function nivelDeAlerta(contagens) {
  const motivos = []
  let nivel = 0
  for (const [tipo, [atencao, ataque]] of Object.entries(LIMITES_ALERTA)) {
    const n = contagens[tipo] || 0
    if (n >= ataque) { nivel = 2; motivos.push({ tipo, n, nivel: 2 }) } else if (n >= atencao) { nivel = Math.max(nivel, 1); motivos.push({ tipo, n, nivel: 1 }) }
  }
  return { nivel: ['normal', 'atencao', 'ataque'][nivel], motivos: motivos.sort((a, b) => b.nivel - a.nivel || b.n - a.n) }
}

// bloqueio automático: um endereço que, em 5 minutos, procura falhas ou tenta injeções (comportamento de robô de ataque)
export const BLOQUEIO_AUTOMATICO = { sondagem: 20, injecao: 5, horas: 24 }
export function deveBloquear(contagensDoIp) {
  return (contagensDoIp.sondagem || 0) >= BLOQUEIO_AUTOMATICO.sondagem || (contagensDoIp.injecao || 0) >= BLOQUEIO_AUTOMATICO.injecao
}

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/
export const ipValido = (ip) => IPV4.test(ip) || (/^[0-9a-f:.]+$/i.test(ip) && ip.includes(':') && ip.length <= 45)
export const ipLocal = (ip) => /^(::1|127\.|::ffff:127\.)/.test(ip || '')
