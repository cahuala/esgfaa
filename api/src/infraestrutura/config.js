import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

export const RAIZ_API = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const SEGREDO_DESENVOLVIMENTO = 'desenvolvimento-apenas-nao-usar-em-producao'
// PostgreSQL do docker-compose.yml (só para desenvolvimento)
export const URL_DESENVOLVIMENTO = 'postgresql://esgfaa:esgfaa_dev@localhost:5434/esgfaa'

const lista = (padrao) => z.string().default(padrao).transform((s) => s.split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean))
const inteiro = (padrao, min, max) => z.coerce.number().int().min(min).max(max).default(padrao)

const ESQUEMA = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: inteiro(3001, 1, 65535),
  DATA_DIR: z.string().default('dados'),
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'DATABASE_URL deve ser postgresql://…').optional(),
  // e-mails das contas do portal académico (vazio = qualquer domínio)
  EMAIL_DOMINIO_ESCOLA: z.string().regex(/^$|^[a-z0-9.-]+\.[a-z]{2,}$/i, 'EMAIL_DOMINIO_ESCOLA deve ser um domínio (ex.: esgfaa.gov.ao)').default('esgfaa.gov.ao'),
  FUSO_HORARIO: z.string().regex(/^[A-Za-z_]+\/[A-Za-z_]+$|^UTC$/).default('Africa/Luanda'),
  PUBLIC_URL: z.union([z.literal(''), z.url()]).default(''),
  CORS_ORIGINS: lista('http://localhost:5173,http://localhost:4173,https://cahuala.github.io'),
  JWT_SECRET: z.string().default(''),
  SESSION_TTL: z.string().regex(/^\d+[smhd]$/, 'SESSION_TTL deve ser como 8h, 30m ou 1d').default('8h'),
  MAX_UPLOAD_MB: inteiro(80, 1, 1024),
  TRUST_PROXY: z.string().default(''),
  ADMIN_NAME: z.string().default('Administrador'),
  ADMIN_EMAIL: z.string().default('admin@esgfaa.gov.ao'),
  ADMIN_PASSWORD: z.string().default(''),
  LOG: z.enum(['json', 'nenhum']).optional(),
})

// "1" -> 1 (n.º de proxies), "loopback" -> 'loopback', "" -> false
const proxy = (v) => (!v ? false : /^\d+$/.test(v) ? Number(v) : v === 'true' ? true : v)

/*
  Lê e valida a configuração do ambiente (falha no arranque se algo estiver errado).
  Em testes passa-se um objeto com os valores pretendidos.
*/
export function criarConfig(env = process.env, extras = {}) {
  const r = ESQUEMA.safeParse(env)
  if (!r.success) {
    const p = r.error.issues[0]
    throw new Error(`Configuração inválida (${p.path.join('.')}): ${p.message}`)
  }
  const e = r.data
  const producao = e.NODE_ENV === 'production'

  let segredoJwt = e.JWT_SECRET
  if (!segredoJwt) {
    if (producao) throw new Error('Defina JWT_SECRET no ambiente antes de arrancar a API em produção.')
    segredoJwt = SEGREDO_DESENVOLVIMENTO
  } else if (producao && segredoJwt.length < 32) {
    throw new Error('JWT_SECRET demasiado curto: use pelo menos 32 caracteres aleatórios.')
  }

  if (!e.DATABASE_URL && producao) throw new Error('Defina DATABASE_URL (PostgreSQL) antes de arrancar a API em produção.')
  const pastaDados = path.resolve(RAIZ_API, e.DATA_DIR)

  return {
    ambiente: e.NODE_ENV,
    producao,
    porta: e.PORT,
    pastaDados,
    urlBaseDados: e.DATABASE_URL || URL_DESENVOLVIMENTO,
    fuso: e.FUSO_HORARIO,
    pastaUploads: path.join(pastaDados, 'uploads'),
    // materiais, entregas e documentos do portal: fora da pasta pública
    pastaPrivada: path.join(pastaDados, 'privado'),
    dominioEmail: e.EMAIL_DOMINIO_ESCOLA.toLowerCase(),
    urlPublico: e.PUBLIC_URL.replace(/\/$/, ''),
    origens: e.CORS_ORIGINS,
    segredoJwt,
    segredoDesenvolvimento: segredoJwt === SEGREDO_DESENVOLVIMENTO,
    duracaoSessao: e.SESSION_TTL,
    tamanhoMaximoUpload: e.MAX_UPLOAD_MB * 1024 * 1024,
    confiarProxy: proxy(e.TRUST_PROXY),
    administrador: { nome: e.ADMIN_NAME, email: e.ADMIN_EMAIL, senha: e.ADMIN_PASSWORD },
    registos: e.LOG ?? (e.NODE_ENV === 'test' ? 'nenhum' : 'json'),
    // limites de pedidos por janela (os testes podem alterá-los)
    limites: {
      entrar: { janelaMs: 15 * 60_000, maximo: 10 },
      // tentativas por IP, qualquer que seja o e-mail (contra "password spraying")
      entrarIp: { janelaMs: 15 * 60_000, maximo: 40 },
      admin: { janelaMs: 60_000, maximo: 600 },
      publico: { janelaMs: 60_000, maximo: 300 },
      gosto: { janelaMs: 60_000, maximo: 30 },
      comentario: { janelaMs: 60_000, maximo: 4 },
      visita: { janelaMs: 60_000, maximo: 60 },
      impressao: { janelaMs: 60_000, maximo: 120 },
      clique: { janelaMs: 60_000, maximo: 30 },
      // candidaturas por IP (uma pessoa raramente envia mais de uma ou duas)
      candidatura: { janelaMs: 60 * 60_000, maximo: 5 },
      entrarPortal: { janelaMs: 15 * 60_000, maximo: 10 },
      entrarPortalIp: { janelaMs: 15 * 60_000, maximo: 60 },
      portal: { janelaMs: 60_000, maximo: 600 },
    },
    ...extras,
  }
}
