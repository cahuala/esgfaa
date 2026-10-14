import { Conflito } from '../../dominio/comum/erros.js'
import { eDuplicado } from '../bd/prisma.js'

const iso = (d) => (d ? new Date(d).toISOString() : null)
const autor = { select: { id: true, nome: true, tipo: true } }
const paraTermo = (t) => t && { id: t.id, cadeiraId: t.cadeiraId, termo: t.termo, definicao: t.definicao, aprovado: t.aprovado, autor: t.autor, criadoEm: iso(t.criadoEm), atualizadoEm: iso(t.atualizadoEm) }
const paraVersao = (v) => v && { id: v.id, paginaId: v.paginaId, conteudo: v.conteudo, resumo: v.resumo, autor: v.autor, criadaEm: iso(v.criadaEm) }

// glossário e wiki de uma cadeira
export class RepositorioColaborativo {
  constructor({ prisma }) {
    this.prisma = prisma
  }

  // ---------- glossário ----------

  async termos(cadeiraId, { q, contaId, todos }) {
    const termo = q ? { contains: q.replace(/[\\%_]/g, (c) => `\\${c}`), mode: 'insensitive' } : null
    const l = await this.prisma.termoGlossario.findMany({
      where: {
        cadeiraId,
        ...(todos ? {} : { OR: [{ aprovado: true }, { autorId: contaId }] }),
        ...(termo ? { AND: [{ OR: [{ termo }, { definicao: termo }] }] } : {}),
      },
      include: { autor },
    })
    return l.map(paraTermo).sort((a, b) => a.termo.localeCompare(b.termo, 'pt', { sensitivity: 'base' }))
  }

  async termo(id) {
    const n = Number(id)
    if (!Number.isSafeInteger(n) || n < 1) return null
    return paraTermo(await this.prisma.termoGlossario.findUnique({ where: { id: n }, include: { autor } }))
  }

  // já existe este termo (sem contar maiúsculas) na cadeira?
  async termoExiste(cadeiraId, termo, excepto = null) {
    const n = await this.prisma.termoGlossario.count({ where: { cadeiraId, termo: { equals: termo, mode: 'insensitive' }, ...(excepto ? { id: { not: excepto } } : {}) } })
    return n > 0
  }

  async criarTermo(dados) {
    return paraTermo(await this.prisma.termoGlossario.create({ data: dados, include: { autor } }))
  }

  async atualizarTermo(id, dados) {
    return paraTermo(await this.prisma.termoGlossario.update({ where: { id }, data: dados, include: { autor } }))
  }

  apagarTermo(id) {
    return this.prisma.termoGlossario.delete({ where: { id } })
  }

  // ---------- wiki ----------

  async paginas(cadeiraId) {
    const l = await this.prisma.paginaWiki.findMany({
      where: { cadeiraId }, orderBy: { titulo: 'asc' },
      include: { _count: { select: { versoes: true } }, versoes: { orderBy: { id: 'desc' }, take: 1, include: { autor } } },
    })
    return l.map((p) => ({ id: p.id, titulo: p.titulo, atualizadaEm: iso(p.atualizadaEm), versoes: p._count.versoes, ultimoAutor: p.versoes[0]?.autor ?? null }))
  }

  async pagina(id) {
    const n = Number(id)
    if (!Number.isSafeInteger(n) || n < 1) return null
    const p = await this.prisma.paginaWiki.findUnique({ where: { id: n }, include: { versoes: { orderBy: { id: 'desc' }, include: { autor } } } })
    return p && {
      id: p.id, cadeiraId: p.cadeiraId, titulo: p.titulo, criadaEm: iso(p.criadaEm), atualizadaEm: iso(p.atualizadaEm),
      versoes: p.versoes.map(paraVersao),
    }
  }

  async criarPagina({ cadeiraId, titulo, conteudo, autorId, quando }) {
    try {
      const p = await this.prisma.paginaWiki.create({ data: { cadeiraId, titulo, criadaEm: quando, atualizadaEm: quando, versoes: { create: { conteudo, autorId, resumo: 'Página criada', criadaEm: quando } } } })
      return p.id
    } catch (e) {
      if (eDuplicado(e)) throw new Conflito('Já existe uma página com esse título.')
      throw e
    }
  }

  // nova versão, só se ninguém tiver gravado outra entretanto (base = a versão que se editou)
  async novaVersao({ paginaId, base, conteudo, resumo, autorId, quando }) {
    return this.prisma.$transaction(async (tx) => {
      const ultima = await tx.versaoWiki.findFirst({ where: { paginaId }, orderBy: { id: 'desc' }, select: { id: true } })
      if (base && ultima && ultima.id !== Number(base)) throw new Conflito('Alguém gravou esta página enquanto a editava. Abra a versão nova e volte a aplicar as suas mudanças.')
      await tx.versaoWiki.create({ data: { paginaId, conteudo, resumo, autorId, criadaEm: quando } })
      await tx.paginaWiki.update({ where: { id: paginaId }, data: { atualizadaEm: quando } })
    })
  }

  apagarPagina(id) {
    return this.prisma.paginaWiki.delete({ where: { id } })
  }
}
