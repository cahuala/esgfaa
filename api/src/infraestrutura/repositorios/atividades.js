const linha = (a) => ({
  id: a.id, utilizador_id: a.utilizadorId, utilizador_nome: a.utilizadorNome, acao: a.acao, colecao: a.colecao,
  alvo_id: a.alvoId, alvo_titulo: a.alvoTitulo, detalhes: a.detalhes, ip: a.ip, agente: a.agente, data: a.data.toISOString(),
})

// registo de auditoria: tudo o que os utilizadores do painel fazem
export class RepositorioAtividades {
  constructor({ prisma }) {
    this.prisma = prisma
  }

  async registar({ utilizadorId, utilizadorNome, acao, colecao, alvoId, alvoTitulo, detalhes, ip, agente }) {
    await this.prisma.atividade.create({
      data: {
        utilizadorId: utilizadorId ?? null, utilizadorNome: utilizadorNome ?? null, acao, colecao: colecao ?? null,
        alvoId: alvoId == null ? null : String(alvoId), alvoTitulo: alvoTitulo ?? null,
        detalhes: detalhes == null ? null : (typeof detalhes === 'string' ? detalhes : JSON.stringify(detalhes)),
        ip: ip ?? null, agente: agente ? String(agente).slice(0, 300) : null,
      },
    })
  }

  async listar({ utilizador, acao, colecao, desde, ate, q, pagina = 1, porPagina = 25 }) {
    // o "contains" do Prisma NÃO escapa % e _: escapam-se aqui para a pesquisa ser sempre literal
    const termo = q ? { contains: q.replace(/[\\%_]/g, (c) => `\\${c}`), mode: 'insensitive' } : undefined
    const where = {
      ...(utilizador ? { utilizadorId: Number(utilizador) } : {}),
      ...(acao ? { acao } : {}),
      ...(colecao ? { colecao } : {}),
      ...(desde || ate ? { data: { ...(desde ? { gte: new Date(`${desde}T00:00:00Z`) } : {}), ...(ate ? { lt: new Date(new Date(`${ate}T00:00:00Z`).getTime() + 86_400_000) } : {}) } } : {}),
      ...(termo ? { OR: [{ alvoTitulo: termo }, { detalhes: termo }, { ip: termo }] } : {}),
    }
    const [total, linhas, acoes] = await Promise.all([
      this.prisma.atividade.count({ where }),
      this.prisma.atividade.findMany({ where, orderBy: { id: 'desc' }, take: porPagina, skip: (pagina - 1) * porPagina }),
      this.prisma.atividade.findMany({ distinct: ['acao'], select: { acao: true }, orderBy: { acao: 'asc' } }),
    ])
    return { total, pagina, porPagina, linhas: linhas.map(linha), acoes: acoes.map((a) => a.acao) }
  }

  async ultimas({ utilizadorId = null, limite = 8 } = {}) {
    const linhas = await this.prisma.atividade.findMany({ where: utilizadorId == null ? {} : { utilizadorId }, orderBy: { id: 'desc' }, take: limite })
    return linhas.map(linha)
  }

  async contarPorUtilizador() {
    const grupos = await this.prisma.atividade.groupBy({ by: ['utilizadorId'], _count: { _all: true } })
    return Object.fromEntries(grupos.map((g) => [g.utilizadorId, g._count._all]))
  }
}
