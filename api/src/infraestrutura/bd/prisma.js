import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, Prisma } from '@prisma/client'

export { Prisma }

/*
  Cliente Prisma ligado ao PostgreSQL (adaptador "pg") por um pool de ligações, um só para todo o processo.
  - maximoLigacoes (DB_POOL): ligações abertas no máximo; os pedidos a mais esperam a sua vez
  - quem espera mais de 10 s por uma ligação recebe erro em vez de ficar pendurado
  - ligações paradas há 30 s fecham-se; cada uma renova-se ao fim de 30 min
  - no PostgreSQL: uma consulta não passa de 60 s e uma transação esquecida aberta fecha-se ao fim de 60 s
  esquema: usado pelos testes para isolar cada ambiente num esquema próprio.
*/
export function criarPrisma(url, { esquema = null, maximoLigacoes = 10 } = {}) {
  const opcoes = [
    '-c statement_timeout=60000',
    '-c idle_in_transaction_session_timeout=60000',
    // consultas diretas (estatísticas) também usam o esquema certo
    ...(esquema ? [`-c search_path="${esquema}"`] : []),
  ]
  const pool = {
    connectionString: url,
    max: maximoLigacoes,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    maxLifetimeSeconds: 1800,
    application_name: 'esgfaa-portal',
    options: opcoes.join(' '),
  }
  const adapter = new PrismaPg(pool, esquema ? { schema: esquema } : undefined)
  return new PrismaClient({ adapter })
}

// violação de chave única (ex.: e-mail repetido, dois pedidos a criar o mesmo identificador)
export const eDuplicado = (erro) => erro?.code === 'P2002'
