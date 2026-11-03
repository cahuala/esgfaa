#!/usr/bin/env node
/*
  Aplica as migrações (prisma/migrations/<nome>/migration.sql) que faltam, sem a linha de comandos do Prisma:
  é o que corre na instalação a partir do pendrive (Windows e Linux, sem internet).
  Usa a mesma tabela que o «prisma migrate deploy» (_prisma_migrations, com o mesmo resumo SHA-256),
  por isso as duas formas podem alternar na mesma base.
    node --env-file=.env scripts/migrar.js
*/
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const PASTA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'prisma', 'migrations')

export async function migrar(url, { registar = console.log } = {}) {
  const c = new pg.Client({ connectionString: url })
  await c.connect()
  try {
    await c.query(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" VARCHAR(36) PRIMARY KEY NOT NULL, "checksum" VARCHAR(64) NOT NULL, "finished_at" TIMESTAMPTZ, "migration_name" VARCHAR(255) NOT NULL,
      "logs" TEXT, "rolled_back_at" TIMESTAMPTZ, "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(), "applied_steps_count" INTEGER NOT NULL DEFAULT 0)`)
    const feitas = new Set((await c.query('SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL')).rows.map((r) => r.migration_name))
    const falhadas = (await c.query('SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL')).rows.map((r) => r.migration_name)
    if (falhadas.length) throw new Error(`Há uma migração que ficou a meio (${falhadas.join(', ')}). Reponha a cópia de segurança antes de continuar.`)
    const todas = fs.readdirSync(PASTA).filter((d) => fs.existsSync(path.join(PASTA, d, 'migration.sql'))).sort()
    let n = 0
    for (const nome of todas.filter((d) => !feitas.has(d))) {
      const sql = fs.readFileSync(path.join(PASTA, nome, 'migration.sql'), 'utf8')
      const id = crypto.randomUUID()
      await c.query('INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at, applied_steps_count) VALUES ($1, $2, $3, now(), 0)', [id, crypto.createHash('sha256').update(sql).digest('hex'), nome])
      try {
        await c.query('BEGIN')
        await c.query(sql)
        await c.query('COMMIT')
      } catch (e) {
        await c.query('ROLLBACK').catch(() => {})
        await c.query('DELETE FROM "_prisma_migrations" WHERE id = $1', [id])
        throw new Error(`A migração ${nome} falhou: ${e.message}`, { cause: e })
      }
      await c.query('UPDATE "_prisma_migrations" SET finished_at = now(), applied_steps_count = 1 WHERE id = $1', [id])
      registar(`  migração aplicada: ${nome}`)
      n++
    }
    registar(n ? `${n} migração(ões) aplicada(s).` : 'A base de dados já está actualizada.')
    return n
  } finally {
    await c.end()
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.env.DATABASE_URL) {
    console.error('Falta DATABASE_URL.')
    process.exit(1)
  }
  migrar(process.env.DATABASE_URL).catch((e) => { console.error(e.message); process.exit(1) })
}
