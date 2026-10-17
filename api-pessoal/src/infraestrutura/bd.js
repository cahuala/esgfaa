import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

// cliente Prisma ligado ao PostgreSQL; esquema: usado pelos testes para isolar cada ambiente
export function criarPrisma(url, { esquema = null, maximoLigacoes = 10 } = {}) {
  const pool = { connectionString: url, max: maximoLigacoes, ...(esquema ? { options: `-c search_path="${esquema}"` } : {}) }
  return new PrismaClient({ adapter: new PrismaPg(pool, esquema ? { schema: esquema } : undefined) })
}

export const eDuplicado = (erro) => erro?.code === 'P2002'
