import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, Prisma } from '@prisma/client'

export { Prisma }

/*
  Cliente Prisma ligado ao PostgreSQL (adaptador "pg").
  esquema: usado pelos testes para isolar cada ambiente num esquema próprio.
*/
export function criarPrisma(url, { esquema = null, maximoLigacoes = 10 } = {}) {
  const pool = {
    connectionString: url,
    max: maximoLigacoes,
    // consultas diretas (estatísticas) também usam o esquema certo
    ...(esquema ? { options: `-c search_path="${esquema}"` } : {}),
  }
  const adapter = new PrismaPg(pool, esquema ? { schema: esquema } : undefined)
  return new PrismaClient({ adapter })
}

// violação de chave única (ex.: e-mail repetido, dois pedidos a criar o mesmo identificador)
export const eDuplicado = (erro) => erro?.code === 'P2002'
