import { Conflito } from '../../dominio/comum/erros.js'
import { eDuplicado } from '../bd/prisma.js'

const iso = (d) => (d ? new Date(d).toISOString() : null)
const linha = (c) => c && ({
  id: c.id, codigo: c.codigo, curso: c.curso, nome: c.nome, email: c.email, telefone: c.telefone,
  dados: c.dados, estado: c.estado, notas: c.notas, criadaEm: iso(c.criadaEm), atualizadaEm: iso(c.atualizadaEm),
})

export class RepositorioCandidaturas {
  constructor({ prisma }) {
    this.prisma = prisma
  }

  async criar({ codigo, curso, nome, email, telefone, dados, ip }) {
    try {
      return linha(await this.prisma.candidatura.create({ data: { codigo, curso, nome, email, telefone, dados, ip } }))
    } catch (erro) {
      if (eDuplicado(erro)) throw new Conflito('Código de candidatura repetido.')
      throw erro
    }
  }

  // já há uma candidatura deste e-mail ao mesmo curso que ainda não foi decidida?
  async existeEmCurso(email, curso, estadosFinais) {
    return Boolean(await this.prisma.candidatura.findFirst({
      where: { email, curso, estado: { notIn: estadosFinais } }, select: { id: true },
    }))
  }

  async listar({ estado, curso, q } = {}) {
    const termo = q ? { contains: q.replace(/[\\%_]/g, (c) => `\\${c}`), mode: 'insensitive' } : undefined
    const linhas = await this.prisma.candidatura.findMany({
      where: {
        ...(estado ? { estado } : {}),
        ...(curso ? { curso } : {}),
        ...(termo ? { OR: [{ nome: termo }, { email: termo }, { codigo: termo }] } : {}),
      },
      orderBy: { criadaEm: 'desc' },
      take: 1000,
    })
    return linhas.map(linha)
  }

  async contarPorEstado() {
    const grupos = await this.prisma.candidatura.groupBy({ by: ['estado'], _count: { _all: true } })
    return Object.fromEntries(grupos.map((g) => [g.estado, g._count._all]))
  }

  async porId(id) {
    const n = Number(id)
    if (!Number.isSafeInteger(n) || n < 1) return null
    return linha(await this.prisma.candidatura.findUnique({ where: { id: n } }))
  }

  async atualizar(id, { estado, notas }, autorId) {
    return linha(await this.prisma.candidatura.update({
      where: { id },
      data: { ...(estado ? { estado } : {}), ...(notas !== undefined ? { notas } : {}), atualizadaEm: new Date(), atualizadaPor: autorId },
    }))
  }
}
