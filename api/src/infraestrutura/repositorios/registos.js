const iso = (d) => (d ? new Date(d).toISOString() : null)
const contar = (linhas, chave) => Object.fromEntries(linhas.map((l) => [l[chave], l._count._all]))

// registos de acesso dos estudantes e números de participação de uma cadeira
export class RepositorioRegistos {
  constructor({ prisma }) {
    this.prisma = prisma
  }

  registar(dados) {
    return this.prisma.registoAcesso.create({ data: dados })
  }

  // por estudante: acessos, último acesso, atividades diferentes abertas, mensagens no fórum e questionários feitos
  async participacao(cadeiraId) {
    const p = this.prisma
    const [acessos, distintas, topicos, respostas, tentativas] = await Promise.all([
      p.registoAcesso.groupBy({ by: ['contaId'], where: { cadeiraId }, _count: { _all: true }, _max: { em: true } }),
      p.registoAcesso.groupBy({ by: ['contaId', 'tipo', 'alvoId'], where: { cadeiraId, tipo: { not: 'cadeira' } } }),
      p.forumTopico.groupBy({ by: ['autorId'], where: { cadeiraId }, _count: { _all: true } }),
      p.forumResposta.groupBy({ by: ['autorId'], where: { topico: { cadeiraId } }, _count: { _all: true } }),
      p.tentativa.groupBy({ by: ['estudanteId'], where: { questionario: { cadeiraId }, entregueEm: { not: null } }, _count: { _all: true } }),
    ])
    const vistas = {}
    for (const d of distintas) vistas[d.contaId] = (vistas[d.contaId] || 0) + 1
    const t = contar(topicos, 'autorId')
    const r = contar(respostas, 'autorId')
    return {
      acessos: Object.fromEntries(acessos.map((a) => [a.contaId, { acessos: a._count._all, ultimo: iso(a._max.em) }])),
      vistas,
      forum: Object.fromEntries([...new Set([...Object.keys(t), ...Object.keys(r)])].map((k) => [k, (t[k] || 0) + (r[k] || 0)])),
      tentativas: contar(tentativas, 'estudanteId'),
    }
  }

  // por atividade: quantas vezes foi aberta e por quantos estudantes
  async porAtividade(cadeiraId) {
    const l = await this.prisma.registoAcesso.groupBy({ by: ['tipo', 'alvoId', 'contaId'], where: { cadeiraId, tipo: { not: 'cadeira' } }, _count: { _all: true } })
    const r = {}
    for (const x of l) {
      const k = `${x.tipo}-${x.alvoId}`
      r[k] ??= { vistas: 0, estudantes: 0 }
      r[k].vistas += x._count._all
      r[k].estudantes += 1
    }
    return r
  }

  async registos(cadeiraId, { contaId, antesDe, limite = 100 }) {
    const l = await this.prisma.registoAcesso.findMany({
      where: { cadeiraId, ...(contaId ? { contaId } : {}), ...(antesDe ? { id: { lt: antesDe } } : {}) },
      orderBy: { id: 'desc' }, take: limite, include: { conta: { select: { id: true, nome: true, numero: true } } },
    })
    return l.map((x) => ({ id: x.id, tipo: x.tipo, alvoId: x.alvoId, em: iso(x.em), estudante: x.conta }))
  }
}
