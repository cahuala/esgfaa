import { eDuplicado } from '../bd/prisma.js'

const iso = (d) => new Date(d).toISOString()
const linha = (c) => ({
  id: c.id, colecao: c.colecao, item_id: c.itemId, nome: c.nome, texto: c.texto, ip: c.ip, data: iso(c.data),
  estado: c.estado, revistoPor: c.revistoPor ?? null, revistoEm: c.revistoEm ? iso(c.revistoEm) : null,
})

export class RepositorioInteracoes {
  constructor({ prisma, fuso }) {
    this.prisma = prisma
    this.fuso = fuso
  }

  async resumo(colecao, id, visitante) {
    const p = this.prisma
    const [gostos, meu, comentarios, vistas] = await Promise.all([
      p.gosto.count({ where: { colecao, itemId: id } }),
      visitante ? p.gosto.findUnique({ where: { colecao_itemId_visitante: { colecao, itemId: id, visitante } }, select: { visitante: true } }) : null,
      p.comentario.findMany({ where: { colecao, itemId: id, estado: 'publicado' }, select: { id: true, nome: true, texto: true, data: true }, orderBy: [{ data: 'desc' }, { id: 'desc' }] }),
      p.visualizacao.findUnique({ where: { colecao_itemId: { colecao, itemId: id } } }),
    ])
    return { gostos, gostei: Boolean(meu), comentarios: comentarios.map((c) => ({ ...c, data: iso(c.data) })), visualizacoes: vistas?.total || 0 }
  }

  // dá ou retira o gosto; dois pedidos simultâneos do mesmo visitante não dão erro
  async alternarGosto(colecao, id, visitante) {
    const { count } = await this.prisma.gosto.deleteMany({ where: { colecao, itemId: id, visitante } })
    if (count) return
    try {
      await this.prisma.gosto.create({ data: { colecao, itemId: id, visitante } })
    } catch (erro) {
      if (!eDuplicado(erro)) throw erro
    }
  }

  // o comentário novo espera a equipa de comunicação (e depois o Comandante)
  async comentar(colecao, id, { nome, texto }, ip) {
    await this.prisma.comentario.create({ data: { colecao, itemId: id, nome, texto, ip, estado: 'pendente' } })
  }

  // incremento atómico (sem perder contagens com pedidos simultâneos)
  async contarVisualizacao(colecao, id) {
    await this.prisma.$executeRaw`
      INSERT INTO visualizacoes (colecao, item_id, total) VALUES (${colecao}, ${id}, 1)
      ON CONFLICT (colecao, item_id) DO UPDATE SET total = visualizacoes.total + 1`
  }

  async comentario(id) {
    const n = Number(id)
    if (!Number.isSafeInteger(n) || n < 1) return null
    const c = await this.prisma.comentario.findUnique({ where: { id: n } })
    return c && linha(c)
  }

  async listarComentarios({ limite = 500, estado } = {}) {
    const linhas = await this.prisma.comentario.findMany({ where: estado ? { estado } : {}, orderBy: [{ data: 'desc' }, { id: 'desc' }], take: limite })
    return linhas.map(linha)
  }

  contarComentarios(estado) {
    return this.prisma.comentario.count({ where: { estado } })
  }

  async mudarEstadoComentario(id, estado, revisao = {}) {
    await this.prisma.comentario.update({ where: { id: Number(id) }, data: { estado, ...revisao } })
  }

  async apagarComentario(id) {
    await this.prisma.comentario.deleteMany({ where: { id: Number(id) } })
  }

  // { 'noticias/slug': { gostos, comentarios, visualizacoes } }
  async porItem() {
    const p = this.prisma
    const [gostos, comentarios, vistas] = await Promise.all([
      p.gosto.groupBy({ by: ['colecao', 'itemId'], _count: { _all: true } }),
      p.comentario.groupBy({ by: ['colecao', 'itemId'], where: { estado: 'publicado' }, _count: { _all: true } }),
      p.visualizacao.findMany(),
    ])
    const mapa = {}
    const juntar = (k, campo, total) => { mapa[k] = { gostos: 0, comentarios: 0, visualizacoes: 0, ...mapa[k], [campo]: total } }
    gostos.forEach((g) => juntar(`${g.colecao}/${g.itemId}`, 'gostos', g._count._all))
    comentarios.forEach((g) => juntar(`${g.colecao}/${g.itemId}`, 'comentarios', g._count._all))
    vistas.forEach((v) => juntar(`${v.colecao}/${v.itemId}`, 'visualizacoes', v.total))
    return mapa
  }

  async totais() {
    const [gostos, comentarios, vistas, [hoje]] = await Promise.all([
      this.prisma.gosto.count(),
      this.prisma.comentario.count(),
      this.prisma.visualizacao.aggregate({ _sum: { total: true } }),
      this.prisma.$queryRaw`SELECT COUNT(*)::int n FROM comentarios WHERE (data AT TIME ZONE ${this.fuso})::date = (now() AT TIME ZONE ${this.fuso})::date`,
    ])
    return { gostos, comentarios, visualizacoes: vistas._sum.total || 0, comentariosHoje: hoje.n }
  }

  comentariosPorDia(dias = 14) {
    return this.prisma.$queryRaw`
      SELECT to_char((data AT TIME ZONE ${this.fuso})::date, 'YYYY-MM-DD') dia, COUNT(*)::int n FROM comentarios
      WHERE data >= now() - make_interval(days => ${dias - 1}) GROUP BY dia ORDER BY dia`
  }
}
