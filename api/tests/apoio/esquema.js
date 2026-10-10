import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { RAIZ_API } from '../../src/infraestrutura/config.js'

// base de dados dos testes (docker-compose.yml cria-a; no CI vem do serviço postgres)
export const URL_TESTE = process.env.DATABASE_URL_TESTE || 'postgresql://esgfaa:esgfaa_dev@localhost:5434/esgfaa_teste'

const pastaMigracoes = path.join(RAIZ_API, 'prisma', 'migrations')
const MIGRACOES = fs.readdirSync(pastaMigracoes)
  .filter((d) => fs.existsSync(path.join(pastaMigracoes, d, 'migration.sql')))
  .sort()
  .map((d) => fs.readFileSync(path.join(pastaMigracoes, d, 'migration.sql'), 'utf8'))

async function comCliente(url, fn) {
  const c = new pg.Client({ connectionString: url })
  await c.connect()
  try {
    return await fn(c)
  } finally {
    await c.end()
  }
}

// cria um esquema novo com as mesmas migrações que a produção (prisma/migrations)
export async function criarEsquema(url = URL_TESTE, nome = `t_${crypto.randomBytes(6).toString('hex')}`) {
  await comCliente(url, async (c) => {
    await c.query(`DROP SCHEMA IF EXISTS "${nome}" CASCADE`)
    await c.query(`CREATE SCHEMA "${nome}"`)
    await c.query(`SET search_path TO "${nome}"`)
    for (const sql of MIGRACOES) await c.query(sql)
  })
  return nome
}

export async function apagarEsquema(nome, url = URL_TESTE) {
  await comCliente(url, (c) => c.query(`DROP SCHEMA IF EXISTS "${nome}" CASCADE`))
}
