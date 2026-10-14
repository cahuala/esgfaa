// pesquisa global nas cadeiras de uma conta (o serviço filtra o que o estudante não pode ver)
export class RepositorioPesquisa {
  constructor({ prisma }) {
    this.prisma = prisma
  }

  async pesquisar(cadeiraIds, q, limite = 8) {
    const t = { contains: q.replace(/[\\%_]/g, (c) => `\\${c}`), mode: 'insensitive' }
    const em = { cadeiraId: { in: cadeiraIds } }
    const p = this.prisma
    const [cadeiras, materiais, trabalhos, questionarios, topicos, termos, paginas, avisos] = await Promise.all([
      p.unidadeCurricular.findMany({ where: { id: { in: cadeiraIds }, OR: [{ nome: t }, { codigo: t }, { descricao: t }] }, take: limite }),
      p.material.findMany({ where: { ...em, OR: [{ titulo: t }, { descricao: t }, { conteudo: t }] }, take: limite * 3 }),
      p.trabalho.findMany({ where: { ...em, OR: [{ titulo: t }, { enunciado: t }] }, take: limite * 3 }),
      p.questionario.findMany({ where: { ...em, OR: [{ titulo: t }, { descricao: t }] }, take: limite * 3 }),
      p.forumTopico.findMany({ where: { ...em, OR: [{ titulo: t }, { texto: t }, { respostas: { some: { texto: t } } }] }, take: limite, orderBy: { atividadeEm: 'desc' } }),
      p.termoGlossario.findMany({ where: { ...em, aprovado: true, OR: [{ termo: t }, { definicao: t }] }, take: limite }),
      p.paginaWiki.findMany({ where: { ...em, OR: [{ titulo: t }, { versoes: { some: { conteudo: t } } }] }, take: limite }),
      p.avisoCadeira.findMany({ where: { ...em, OR: [{ titulo: t }, { texto: t }] }, take: limite, orderBy: { criadoEm: 'desc' } }),
    ])
    return { cadeiras, materiais, trabalhos, questionarios, topicos, termos, paginas, avisos }
  }
}
