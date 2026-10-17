import { defineConfig } from 'prisma/config'

// configuração da CLI do Prisma (migrações e geração do cliente) — base de dados própria do pessoal
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL ?? 'postgresql://pessoal:pessoal_dev@localhost:5434/esgfaa_pessoal' },
})
