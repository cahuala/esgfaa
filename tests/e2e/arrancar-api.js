// Arranca a API para os testes ponta-a-ponta com uma base de dados nova (carregada a partir de src/data).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const pasta = path.join(os.tmpdir(), 'esgfaa-e2e')
fs.rmSync(pasta, { recursive: true, force: true })
fs.mkdirSync(pasta, { recursive: true })
process.env.DATA_DIR = pasta
await import('../../api/src/server.js')
