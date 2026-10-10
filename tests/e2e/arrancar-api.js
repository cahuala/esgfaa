// Arranca a API para os testes ponta-a-ponta: base de dados PostgreSQL recriada do zero
// (com as migrações do Prisma) e carregada a partir de src/data.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { criarEsquema } from '../../api/tests/apoio/esquema.js'

const url = process.env.DATABASE_URL_E2E || 'postgresql://esgfaa:esgfaa_dev@localhost:5434/esgfaa_e2e'
await criarEsquema(url, 'public')

const pasta = path.join(os.tmpdir(), 'esgfaa-e2e')
fs.rmSync(pasta, { recursive: true, force: true })
fs.mkdirSync(pasta, { recursive: true })
process.env.DATA_DIR = pasta
process.env.DATABASE_URL = url
await import('../../api/src/server.js')
