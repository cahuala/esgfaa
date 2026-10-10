import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

export const RAIZ_API = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const SEGREDO_DESENVOLVIMENTO = 'desenvolvimento-apenas-nao-usar-em-producao'

const lista = (padrao) => z.string().default(padrao).transform((s) => s.split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean))
const inteiro = (padrao, min, max) => z.coerce.number().int().min(min).max(max).default(padrao)

const ESQUEMA = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: inteiro(3001, 1, 65535),
  DATA_DIR: z.string().default('dados'),
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
  Em testes passa-se um objeto com os valores pretendidos (ex.: DATA_DIR ':memory:').
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

  const memoria = e.DATA_DIR === ':memory:'
  const pastaDados = memoria ? null : path.resolve(RAIZ_API, e.DATA_DIR)

  return {
    ambiente: e.NODE_ENV,
    producao,
    porta: e.PORT,
    pastaDados,
    ficheiroBase: memoria ? ':memory:' : path.join(pastaDados, 'esgfaa.sqlite'),
    pastaUploads: memoria ? null : path.join(pastaDados, 'uploads'),
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
      admin: { janelaMs: 60_000, maximo: 600 },
      publico: { janelaMs: 60_000, maximo: 300 },
      gosto: { janelaMs: 60_000, maximo: 30 },
      comentario: { janelaMs: 60_000, maximo: 4 },
      visita: { janelaMs: 60_000, maximo: 60 },
      impressao: { janelaMs: 60_000, maximo: 120 },
      clique: { janelaMs: 60_000, maximo: 30 },
    },
    ...extras,
  }
}
