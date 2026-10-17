import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const URL_DESENVOLVIMENTO = 'postgresql://pessoal:pessoal_dev@localhost:5434/esgfaa_pessoal'
const SEGREDO_DESENVOLVIMENTO = 'pessoal-desenvolvimento-apenas-nao-usar-em-producao'

const lista = (padrao) => z.string().default(padrao).transform((s) => s.split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean))
const inteiro = (padrao, min, max) => z.coerce.number().int().min(min).max(max).default(padrao)

const ESQUEMA = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: inteiro(3002, 1, 65535),
  // por omissão só aceita ligações da própria máquina; no servidor da Escola use o IP da rede interna
  HOST: z.string().default('127.0.0.1'),
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'DATABASE_URL deve ser postgresql://…').optional(),
  DB_POOL: inteiro(10, 2, 100),
  JWT_SECRET: z.string().default(''),
  // chave da encriptação dos dados pessoais na base de dados (32 bytes: 64 hex ou base64); NUNCA a perca
  DADOS_CHAVE: z.string().default(''),
  SESSION_TTL: z.string().regex(/^\d+[smhd]$/).default('8h'),
  // redes de onde se aceitam pedidos (IPv4 em CIDR); tudo o resto é recusado
  REDES_INTERNAS: lista('127.0.0.1/32,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16'),
  CORS_ORIGINS: lista('http://localhost:5173,http://localhost:4173,http://localhost:3002'),
  TRUST_PROXY: z.string().default(''),
  ADMIN_NOME: z.string().default('Administrador do Pessoal'),
  ADMIN_EMAIL: z.string().default('pessoal@esgfaa.gov.ao'),
  ADMIN_PASSWORD: z.string().default(''),
  // ligação ao Portal Académico (num só sentido): para onde enviar os docentes e estudantes, e a chave partilhada
  PORTAL_API_URL: z.union([z.literal(''), z.url()]).default(''),
  INTEGRACAO_CHAVE: z.string().default(''),
  // pasta com a aplicação já construída (dist/pessoal) para servir no mesmo endereço; vazio = não serve
  APP_DIR: z.string().default(''),
  MAX_FOTO_MB: inteiro(5, 1, 50),
  // documentos do processo individual, extractos, expediente e anexos das mensagens
  MAX_DOCUMENTO_MB: inteiro(25, 1, 200),
  // consulta do Bilhete de Identidade na base de dados do Estado; sem chave fica desligada
  BI_API_URL: z.url().default('https://api.gov.ao/bi/v1/getBI'),
  BI_API_KEY: z.string().default(''),
  DATA_DIR: z.string().default('dados'),
})

const proxy = (v) => (!v ? false : /^\d+$/.test(v) ? Number(v) : v === 'true' ? true : v)

export function criarConfig(env = process.env) {
  const r = ESQUEMA.safeParse(env)
  if (!r.success) {
    const p = r.error.issues[0]
    throw new Error(`Configuração inválida (${p.path.join('.')}): ${p.message}`)
  }
  const e = r.data
  const producao = e.NODE_ENV === 'production'
  let segredo = e.JWT_SECRET
  if (!segredo) {
    if (producao) throw new Error('Defina JWT_SECRET antes de arrancar em produção.')
    segredo = SEGREDO_DESENVOLVIMENTO
  } else if (producao && segredo.length < 32) throw new Error('JWT_SECRET demasiado curto: use pelo menos 32 caracteres aleatórios.')
  if (producao && !e.DADOS_CHAVE) throw new Error('Defina DADOS_CHAVE (32 bytes aleatórios) antes de arrancar em produção: encripta os dados pessoais.')
  if (producao && !e.DATABASE_URL) throw new Error('Defina DATABASE_URL antes de arrancar em produção.')
  if (e.PORTAL_API_URL && e.INTEGRACAO_CHAVE.length < 32) throw new Error('INTEGRACAO_CHAVE deve ter pelo menos 32 caracteres (a mesma na API do portal).')
  return {
    producao,
    teste: e.NODE_ENV === 'test',
    porta: e.PORT,
    host: e.HOST,
    urlBaseDados: e.DATABASE_URL || URL_DESENVOLVIMENTO,
    ligacoesBd: e.DB_POOL,
    segredoJwt: segredo,
    // em desenvolvimento e testes, uma chave fixa (os dados de demonstração não são reais)
    chaveDados: e.DADOS_CHAVE || crypto.createHash('sha256').update('pessoal-desenvolvimento-dados').digest('hex'),
    duracaoSessao: e.SESSION_TTL,
    redesInternas: e.REDES_INTERNAS,
    origens: e.CORS_ORIGINS,
    confiarProxy: proxy(e.TRUST_PROXY),
    admin: { nome: e.ADMIN_NOME, email: e.ADMIN_EMAIL.toLowerCase(), senha: e.ADMIN_PASSWORD },
    portal: { url: e.PORTAL_API_URL.replace(/\/$/, ''), chave: e.INTEGRACAO_CHAVE },
    pastaApp: e.APP_DIR ? path.resolve(RAIZ, e.APP_DIR) : '',
    pastaFotos: path.resolve(RAIZ, e.DATA_DIR, 'fotos'),
    maxFoto: e.MAX_FOTO_MB * 1048576,
    pastaFicheiros: path.resolve(RAIZ, e.DATA_DIR, 'ficheiros'),
    maxDocumento: e.MAX_DOCUMENTO_MB * 1048576,
    bi: { url: e.BI_API_URL, chave: e.BI_API_KEY },
  }
}
