/*
  Detectores de ataques no conteúdo dos pedidos (o endereço já é visto em eventos.js):
  injecções no corpo e na pesquisa (SQL, XSS, NoSQL, comandos, caminhos, modelos), phishing nas mensagens
  enviadas pelos visitantes, robôs de IA e ferramentas de ataque (pelo User-Agent) e textos que tentam dar
  ordens a uma IA (injecção de instruções). As consultas à base de dados são sempre parametrizadas: uma
  injecção de SQL não chega a correr; detectá-la serve para bloquear quem a tenta.
*/

// --- injecções ---
const PADROES_INJECAO = [
  ['SQL', /(\bunion\b[\s\S]{0,40}\bselect\b|['"]\s*(or|and)\s+['"]?\w+['"]?\s*=\s*['"]?\w+|\bor\s+1\s*=\s*1\b|;\s*(drop|delete|truncate|insert|update|alter)\s+(table|from|into|database)\b|\b(sleep|benchmark|pg_sleep)\s*\(\s*\d|\bwaitfor\s+delay\b|\bxp_cmdshell\b|\binformation_schema\b|'\s*--\s*$|'\s*#\s*$)/i],
  ['XSS', /(<script\b|javascript:|<iframe\b|<object\b|<embed\b|<svg[^>]*\bon\w+\s*=|\bon(error|load|mouseover|focus|click)\s*=\s*['"]?[^'"\s>]|document\.cookie|eval\s*\()/i],
  ['Comando', /([;&|`]\s*(cat|ls|id|whoami|wget|curl|bash|sh|nc|rm|chmod|python|perl)\b|\$\(\s*(cat|id|whoami|curl|wget)\b)/i],
  ['Caminho', /(\.\.[/\\]){2,}|\/etc\/passwd|\\windows\\system32|\/proc\/self/i],
  ['Modelo', /(\$\{jndi:|\$\{env:|\{\{\s*[\w.]*(constructor|__proto__|config|self|request)\b)/i],
]

// os textos de um pedido (corpo e pesquisa), até um limite (não pesa nos pedidos grandes)
function textos(valor, saida = [], fundo = 0) {
  if (saida.length > 200 || fundo > 5 || valor === null || valor === undefined) return saida
  if (typeof valor === 'string') saida.push(valor.slice(0, 5000))
  else if (Array.isArray(valor)) for (const v of valor) textos(v, saida, fundo + 1)
  else if (typeof valor === 'object') for (const [k, v] of Object.entries(valor)) { saida.push(k); textos(v, saida, fundo + 1) }
  return saida
}

// NoSQL: operadores de consulta enviados no lugar de um valor ({ "senha": { "$ne": "" } })
const temOperador = (v, fundo = 0) => fundo < 5 && v && typeof v === 'object' && Object.entries(v).some(([k, x]) => /^\$(ne|gt|gte|lt|lte|in|nin|regex|where|exists|or|and)$/.test(k) || temOperador(x, fundo + 1))

// a primeira injecção encontrada: { categoria, exemplo } ou null
export function injecaoNoPedido({ corpo, consulta }) {
  if (temOperador(corpo) || temOperador(consulta)) return { categoria: 'NoSQL', exemplo: 'operador de consulta ($ne, $gt…) num campo' }
  for (const t of [...textos(consulta), ...textos(corpo)]) {
    for (const [categoria, re] of PADROES_INJECAO) {
      const m = t.match(re)
      if (m) return { categoria, exemplo: m[0].slice(0, 80) }
    }
  }
  return null
}

// --- phishing (ligações para enganar quem lê: páginas falsas da Escola, pedidos de senha, encurtadores) ---
const ENCURTADORES = /^(bit\.ly|tinyurl\.com|t\.co|is\.gd|cutt\.ly|rebrand\.ly|shorturl\.at|ow\.ly|rb\.gy|tiny\.cc|s\.id|t\.ly|lnkd\.in|goo\.gl)$/i
const ISCO = /\b(senha|palavra-passe|password|credenciais|verifi(car|que) (a sua )?conta|confirm(ar|e) (os seus )?dados|conta (será )?(bloqueada|suspensa|desativada)|actualiz(ar|e) (os seus )?dados|iban|multicaixa|pagamento urgente|prémio|ganhou)\b/i

export function phishingNoTexto(texto, dominio = 'esgfaa.gov.ao') {
  const t = String(texto || '')
  const urls = t.match(/\b(?:https?:\/\/|www\.)[^\s<>"')]+/gi) || []
  for (const u of urls) {
    let host
    try { host = new URL(u.startsWith('http') ? u : `http://${u}`).hostname.toLowerCase() } catch { continue }
    if (/@/.test(u.split('/')[2] || '')) return { motivo: 'ligação com «@» no endereço (esconde o site verdadeiro)', ligacao: u }
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return { motivo: 'ligação para um endereço IP em vez de um nome', ligacao: u }
    if (host.split('.').some((p) => p.startsWith('xn--'))) return { motivo: 'ligação com letras disfarçadas (punycode)', ligacao: u }
    if (ENCURTADORES.test(host)) return { motivo: 'ligação encurtada (esconde o destino)', ligacao: u }
    const escola = dominio.split('.')[0]
    if (host.includes(escola) && host !== dominio && !host.endsWith(`.${dominio}`)) return { motivo: `imita o endereço da Escola (${dominio})`, ligacao: u }
  }
  if (urls.length && ISCO.test(t)) return { motivo: 'pede dados ou senhas e traz uma ligação', ligacao: urls[0] }
  return null
}

// --- robôs de IA e ferramentas de ataque (pelo User-Agent) ---
const ROBOS_IA = /(GPTBot|ChatGPT-User|OAI-SearchBot|ClaudeBot|Claude-Web|anthropic-ai|CCBot|Google-Extended|PerplexityBot|Perplexity-User|Bytespider|Amazonbot|Applebot-Extended|cohere-ai|Diffbot|YouBot|meta-externalagent|FacebookBot|ImagesiftBot|Omgilibot|Timpibot|AI2Bot)/i
const FERRAMENTAS = /(sqlmap|nikto|nmap|masscan|acunetix|nessus|openvas|wpscan|dirbuster|gobuster|dirb\b|ffuf|hydra|zgrab|nuclei|commix|xsstrike|burp|w3af|arachni|havij|jaeles)/i

export function robo(agente) {
  const a = String(agente || '')
  const f = a.match(FERRAMENTAS)
  if (f) return { tipo: 'ferramenta_ataque', nome: f[0] }
  const r = a.match(ROBOS_IA)
  if (r) return { tipo: 'robo_ia', nome: r[0] }
  return null
}

// --- injecção de instruções numa IA (o texto de um trabalho a tentar mandar no avaliador) ---
const INSTRUCOES_IA = /(\b(ignore|ignora|esquece|desconsidera|disregard)\b[\s\S]{0,30}\b(previous|prior|above|anteriores?|acima|todas?)\b[\s\S]{0,20}\b(instructions|instruções|ordens|regras)\b|\byou are now\b|\bagora és\b|\bsystem prompt\b|\bprompt do sistema\b|\bfinge (que és|ser)\b|\bjailbreak\b|\bDAN mode\b|<\/?(system|assistant|instructions)>|\b(responde|answer|devolve)\b[\s\S]{0,25}\b(probabilidade|probability)\b[\s\S]{0,10}\b0\b)/i

export function instrucoesParaIA(texto) {
  const m = String(texto || '').match(INSTRUCOES_IA)
  return m ? m[0].slice(0, 120) : null
}
