import { Conflito } from '../../dominio/comum/erros.js'
import { eDuplicado } from '../bd/prisma.js'

const membros = { membros: { include: { estudante: { select: { id: true, nome: true, numero: true, email: true } } } } }
const paraGrupo = (g) => g && {
  id: g.id, cadeiraId: g.cadeiraId, nome: g.nome,
  membros: (g.membros || []).map((m) => m.estudante).sort((a, b) => a.nome.localeCompare(b.nome, 'pt')),
}

// grupos de estudantes de uma cadeira
export class RepositorioGrupos {
  constructor({ prisma }) {
    this.prisma = prisma
  }

  async grupos(cadeiraId) {
    const l = await this.prisma.grupoCadeira.findMany({ where: { cadeiraId }, include: membros })
    // ordem natural: "Grupo 2" antes de "Grupo 10"
    return l.map(paraGrupo).sort((a, b) => a.nome.localeCompare(b.nome, 'pt', { numeric: true }))
  }

  async grupo(id) {
    const n = Number(id)
    if (!Number.isSafeInteger(n) || n < 1) return null
    return paraGrupo(await this.prisma.grupoCadeira.findUnique({ where: { id: n }, include: membros }))
  }

  // o grupo do estudante nesta cadeira (ou null)
  async grupoDe(cadeiraId, estudanteId) {
    const m = await this.prisma.membroGrupo.findUnique({ where: { cadeiraId_estudanteId: { cadeiraId, estudanteId } }, include: { grupo: { include: membros } } })
    return m ? paraGrupo(m.grupo) : null
  }

  async #nomeLivre(fn) {
    try {
      return await fn()
    } catch (e) {
      if (eDuplicado(e)) throw new Conflito('Já existe um grupo com esse nome nesta cadeira.')
      throw e
    }
  }

  async criar(cadeiraId, nome) {
    return this.#nomeLivre(async () => paraGrupo(await this.prisma.grupoCadeira.create({ data: { cadeiraId, nome }, include: membros })))
  }

  async renomear(id, nome) {
    return this.#nomeLivre(() => this.prisma.grupoCadeira.update({ where: { id }, data: { nome } }))
  }

  apagar(id) {
    return this.prisma.grupoCadeira.delete({ where: { id } })
  }

  // membros do grupo: quem entra sai do grupo onde estava nesta cadeira
  async definirMembros(grupo, estudanteIds) {
    await this.prisma.$transaction([
      this.prisma.membroGrupo.deleteMany({ where: { OR: [{ grupoId: grupo.id }, { cadeiraId: grupo.cadeiraId, estudanteId: { in: estudanteIds } }] } }),
      this.prisma.membroGrupo.createMany({ data: estudanteIds.map((estudanteId) => ({ grupoId: grupo.id, cadeiraId: grupo.cadeiraId, estudanteId })) }),
    ])
  }

  // cria grupos de uma vez (distribuição automática): [{ nome, estudanteIds }]
  async criarVarios(cadeiraId, lista) {
    return this.#nomeLivre(() => this.prisma.$transaction(async (tx) => {
      await tx.membroGrupo.deleteMany({ where: { cadeiraId, estudanteId: { in: lista.flatMap((g) => g.estudanteIds) } } })
      for (const g of lista) {
        await tx.grupoCadeira.create({ data: { cadeiraId, nome: g.nome, membros: { create: g.estudanteIds.map((estudanteId) => ({ cadeiraId, estudanteId })) } } })
      }
    }))
  }
}
