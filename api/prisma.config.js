import { defineConfig } from 'prisma/config'

// configuração da CLI do Prisma (migrações e geração do cliente)
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL ?? 'postgresql://esgfaa:esgfaa_dev@localhost:5434/esgfaa' },
})
