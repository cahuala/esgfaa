import { Papel } from '../../dominio/identidade/papel.js'

const paraEntidade = (l, utilizadores = 0) => l && new Papel({
  id: l.id, nome: l.nome, descricao: l.descricao, permissoes: l.permissoes, sistema: l.sistema, utilizadores,
})

const colunas = (p) => ({ nome: p.nome, descricao: p.descricao || '', permissoes: p.permissoes, sistema: Boolean(p.sistema) })

export class RepositorioPapeis {
  constructor({ prisma }) {
    this.prisma = prisma
  }

  async porId(id) {
    return paraEntidade(await this.prisma.papel.findUnique({ where: { id: String(id) } }))
  }

  async existe(id) {
    return Boolean(await this.prisma.papel.findUnique({ where: { id: String(id) }, select: { id: true } }))
  }

  async listar(utilizadoresPorPapel = {}) {
    const linhas = await this.prisma.papel.findMany({ orderBy: [{ sistema: 'desc' }, { nome: 'asc' }] })
    return linhas.map((l) => paraEntidade(l, utilizadoresPorPapel[l.id] || 0))
  }

  async criar(p) {
    await this.prisma.papel.create({ data: { id: p.id, ...colunas(p) } })
  }

  // garante os papéis por omissão sem apagar alterações feitas no painel
  async garantir(p) {
    await this.prisma.papel.upsert({ where: { id: p.id }, create: { id: p.id, ...colunas(p) }, update: {} })
  }

  async guardar(p) {
    await this.prisma.papel.update({ where: { id: p.id }, data: colunas(p) })
  }

  async apagar(id) {
    await this.prisma.papel.delete({ where: { id } })
  }
}
