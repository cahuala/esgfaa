import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

/*
  Cliente Prisma ligado ao PostgreSQL por um pool de ligações (pg.Pool), um só para todo o processo: os pedidos
  reutilizam as mesmas ligações em vez de abrir uma nova cada um.
  - maximoLigacoes (DB_POOL): ligações abertas no máximo; os pedidos a mais esperam a sua vez
  - quem espera mais de 10 s por uma ligação recebe «sistema ocupado» (503) em vez de ficar pendurado
  - ligações paradas há 30 s fecham-se; cada uma renova-se ao fim de 30 min
  - no PostgreSQL: uma consulta não passa de 60 s e uma transacção esquecida aberta fecha-se ao fim de 60 s
  esquema: usado pelos testes para isolar cada ambiente
*/
export function criarPrisma(url, { esquema = null, maximoLigacoes = 10 } = {}) {
  const opcoes = ['-c statement_timeout=60000', '-c idle_in_transaction_session_timeout=60000', ...(esquema ? [`-c search_path="${esquema}"`] : [])]
  const pool = {
    connectionString: url,
    max: maximoLigacoes,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    maxLifetimeSeconds: 1800,
    application_name: 'esgfaa-pessoal',
    options: opcoes.join(' '),
  }
  return new PrismaClient({ adapter: new PrismaPg(pool, esquema ? { schema: esquema } : undefined) })
}

export const eDuplicado = (erro) => erro?.code === 'P2002'

// sem ligação livre a tempo, ou o PostgreSQL já no limite de ligações (53300)
export function eSobrecarga(erro) {
  const textos = []
  for (let e = erro, n = 0; e && n < 5; e = e.cause, n++) textos.push(String(e.message ?? ''), String(e.code ?? ''), JSON.stringify(e.meta ?? {}))
  return /timeout exceeded when trying to connect|too many clients|53300|P2024|P1001/.test(textos.join(' '))
}

/*
  Números seguidos (processos, declarações, protocolos do expediente): uma transacção com um bloqueio do
  PostgreSQL por série, para os pedidos que chegam ao mesmo tempo serem atendidos um a um; 30 cliques dão
  30 números diferentes, sem repetir nem falhar. O bloqueio solta-se sozinho no fim da transacção.
*/
export function emSerie(bd, serie, fn) {
  return bd.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${serie}))`
    return fn(tx)
  }, { maxWait: 15_000, timeout: 20_000 })
}
