import { Conflito, NaoEncontrado } from '../../../dominio/comum/erros.js'
import { datasPadrao, publicoAno, validarDatas, validarId } from '../../../dominio/academico/anoLetivo.js'

/*
  Anos letivos (Administração Escolar): as datas do ano e dos dois semestres, e qual é o atual. As turmas
  são de um ano letivo; as cadeiras de um semestre (ou anuais) — daqui sai se cada uma está por começar,
  a decorrer ou terminada.
*/
export class ServicoAnosLetivos {
  constructor({ prisma, auditoria, relogio }) {
    Object.assign(this, { prisma, auditoria, relogio })
  }

  async listar(ctx) {
    ctx.actor.exigir('academico.ver')
    const [anos, turmas] = await Promise.all([
      this.prisma.anoLetivo.findMany({ orderBy: { id: 'desc' } }),
      this.prisma.turma.groupBy({ by: ['anoLetivo'], _count: { _all: true } }),
    ])
    const n = Object.fromEntries(turmas.map((t) => [t.anoLetivo, t._count._all]))
    const hoje = this.relogio.agora()
    return anos.map((a) => ({ ...publicoAno(a, hoje), turmas: n[a.id] ?? 0 }))
  }

  async criar(ctx, { id, ...datas }) {
    ctx.actor.exigir('academico.gerir')
    validarId(id)
    if (await this.prisma.anoLetivo.findUnique({ where: { id } })) throw new Conflito(`O ano letivo ${id} já existe.`)
    const primeiro = !(await this.prisma.anoLetivo.count())
    const a = await this.prisma.anoLetivo.create({ data: { id, ...validarDatas(datas), atual: primeiro } })
    await this.auditoria.registar(ctx, { acao: 'criar_ano_letivo', colecao: 'anos_letivos', alvoId: id, alvoTitulo: `Ano letivo ${id}` })
    return publicoAno(a, this.relogio.agora())
  }

  async editar(ctx, id, datas) {
    ctx.actor.exigir('academico.gerir')
    if (!(await this.prisma.anoLetivo.findUnique({ where: { id } }))) throw new NaoEncontrado('Ano letivo não encontrado.')
    const a = await this.prisma.anoLetivo.update({ where: { id }, data: validarDatas(datas) })
    await this.auditoria.registar(ctx, { acao: 'editar_ano_letivo', colecao: 'anos_letivos', alvoId: id, alvoTitulo: `Ano letivo ${id}` })
    return publicoAno(a, this.relogio.agora())
  }

  async tornarAtual(ctx, id) {
    ctx.actor.exigir('academico.gerir')
    if (!(await this.prisma.anoLetivo.findUnique({ where: { id } }))) throw new NaoEncontrado('Ano letivo não encontrado.')
    await this.prisma.$transaction([
      this.prisma.anoLetivo.updateMany({ where: { atual: true }, data: { atual: false } }),
      this.prisma.anoLetivo.update({ where: { id }, data: { atual: true } }),
    ])
    await this.auditoria.registar(ctx, { acao: 'ano_letivo_atual', colecao: 'anos_letivos', alvoId: id, alvoTitulo: `Ano letivo ${id}` })
    return this.listar(ctx)
  }

  async apagar(ctx, id) {
    ctx.actor.exigir('academico.gerir')
    if (await this.prisma.turma.count({ where: { anoLetivo: id } })) throw new Conflito('Este ano letivo tem turmas: não se pode apagar.')
    await this.prisma.anoLetivo.deleteMany({ where: { id } })
    await this.auditoria.registar(ctx, { acao: 'apagar_ano_letivo', colecao: 'anos_letivos', alvoId: id, alvoTitulo: `Ano letivo ${id}` })
  }

  // uma turma nova num ano ainda por configurar: o ano fica registado com as datas habituais (corrigem-se depois)
  async garantir(id) {
    validarId(id)
    if (await this.prisma.anoLetivo.findUnique({ where: { id } })) return
    const primeiro = !(await this.prisma.anoLetivo.count())
    await this.prisma.anoLetivo.create({ data: { id, ...validarDatas(datasPadrao(id)), atual: primeiro } }).catch(() => {})
  }
}
