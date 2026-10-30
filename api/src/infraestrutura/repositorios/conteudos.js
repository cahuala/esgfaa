import { Conteudo } from '../../dominio/conteudos/conteudo.js'
import { Conflito } from '../../dominio/comum/erros.js'
import { Prisma, eDuplicado } from '../bd/prisma.js'

const paraEntidade = (l) => l && new Conteudo({
  colecao: l.colecao, id: l.id, dados: l.dados, estado: l.estado, ordem: l.ordem, aprovacao: l.aprovacao ?? null,
  criadoEm: l.criadoEm.toISOString(), atualizadoEm: l.atualizadoEm.toISOString(), editadoPor: l.autorEdicao?.nome ?? null,
})

const COM_AUTOR = { autorEdicao: { select: { nome: true } } }
const chave = (colecao, id) => ({ colecao_id: { colecao, id: String(id) } })

export class RepositorioConteudos {
  constructor({ prisma }) {
    this.prisma = prisma
  }

  async listar(colecao, { soPublicados = false } = {}) {
    const linhas = await this.prisma.item.findMany({
      where: { colecao, ...(soPublicados ? { estado: 'publicado' } : {}) },
      include: COM_AUTOR,
      orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
    })
    return linhas.map(paraEntidade)
  }

  async ler(colecao, id) {
    return paraEntidade(await this.prisma.item.findUnique({ where: chave(colecao, id), include: COM_AUTOR }))
  }

  async existe(colecao, id) {
    return Boolean(await this.prisma.item.findUnique({ where: chave(colecao, id), select: { id: true } }))
  }

  async publicadoExiste(colecao, id) {
    return Boolean(await this.prisma.item.findFirst({ where: { colecao, id: String(id), estado: 'publicado' }, select: { id: true } }))
  }

  // as publicações à espera do Comandante (em todas as coleções)
  async pendentes() {
    const linhas = await this.prisma.item.findMany({ where: { aprovacao: { path: ['estado'], equals: 'pendente' } }, include: COM_AUTOR })
    return linhas.map(paraEntidade)
  }

  contarPendentes() {
    return this.prisma.item.count({ where: { aprovacao: { path: ['estado'], equals: 'pendente' } } })
  }

  contar(colecao, estado) {
    return this.prisma.item.count({ where: { colecao, estado } })
  }

  contarTodos() {
    return this.prisma.item.count()
  }

  async proximaOrdem(colecao) {
    const r = await this.prisma.item.aggregate({ where: { colecao }, _max: { ordem: true } })
    return (r._max.ordem ?? 0) + 1
  }

  // Conflito se outro pedido criou o mesmo identificador entretanto (o serviço tenta outro)
  async criar(c, autorId) {
    try {
      await this.prisma.item.create({
        data: { colecao: c.colecao, id: c.id, dados: c.dados, ordem: c.ordem, estado: c.estado, aprovacao: c.aprovacao ?? undefined, atualizadoPor: autorId, criadoPor: autorId },
      })
    } catch (erro) {
      if (eDuplicado(erro)) throw new Conflito('Já existe um conteúdo com este identificador.')
      throw erro
    }
    return this.ler(c.colecao, c.id)
  }

  // carga inicial (não substitui o que já existe)
  async semear(lista) {
    await this.prisma.item.createMany({
      data: lista.map((c) => ({ colecao: c.colecao, id: c.id, dados: c.dados, ordem: c.ordem, estado: c.estado })),
      skipDuplicates: true,
    })
  }

  async guardar(c, autorId) {
    await this.prisma.item.update({
      where: chave(c.colecao, c.id),
      data: { dados: c.dados, estado: c.estado, aprovacao: c.aprovacao ?? Prisma.DbNull, atualizadoEm: new Date(), atualizadoPor: autorId },
    })
    return this.ler(c.colecao, c.id)
  }

  // apaga o item e tudo o que lhe está associado, numa só transação
  async apagar(colecao, id) {
    const p = this.prisma
    await p.$transaction([
      p.item.deleteMany({ where: { colecao, id } }),
      p.gosto.deleteMany({ where: { colecao, itemId: id } }),
      p.comentario.deleteMany({ where: { colecao, itemId: id } }),
      p.visualizacao.deleteMany({ where: { colecao, itemId: id } }),
      ...(colecao === 'publicidade' ? [p.publicidadeMetrica.deleteMany({ where: { bannerId: id } })] : []),
    ])
  }

  async reordenar(colecao, ids) {
    await this.prisma.$transaction(ids.map((id, i) => this.prisma.item.updateMany({ where: { colecao, id }, data: { ordem: i + 1 } })))
  }

  async apagarTodos() {
    await this.prisma.$transaction([this.prisma.item.deleteMany(), this.prisma.pagina.deleteMany()])
  }
}
