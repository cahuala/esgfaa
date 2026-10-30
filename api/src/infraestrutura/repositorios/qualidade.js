import { InqueritoInstitucional } from '../../dominio/qualidade/inquerito.js'
import { Conflito } from '../../dominio/comum/erros.js'
import { Prisma, eDuplicado } from '../bd/prisma.js'

const paraEntidade = (i) => i && new InqueritoInstitucional({
  id: i.id, titulo: i.titulo, descricao: i.descricao, perguntas: i.perguntas, publico: i.publico, turmaIds: i.turmaIds || [],
  fecha: i.fecha.toISOString(), lancadoEm: i.lancadoEm ? i.lancadoEm.toISOString() : null, autor: i.autor, criadoEm: i.criadoEm.toISOString(),
  aprovacao: i.aprovacao ?? null,
  ...(i._count ? { respostas: i._count.participacoes } : {}),
})

// inquéritos institucionais, respostas anónimas e participações
export class RepositorioQualidade {
  constructor({ prisma }) {
    this.prisma = prisma
  }

  async listar({ soLancados = false } = {}) {
    const l = await this.prisma.inqueritoInstitucional.findMany({
      where: soLancados ? { lancadoEm: { not: null } } : {}, orderBy: { criadoEm: 'desc' }, include: { _count: { select: { participacoes: true } } },
    })
    return l.map(paraEntidade)
  }

  // lançamentos à espera do Comandante
  async pendentes() {
    return (await this.prisma.inqueritoInstitucional.findMany({ where: { aprovacao: { path: ['estado'], equals: 'pendente' } }, orderBy: { criadoEm: 'asc' } })).map(paraEntidade)
  }

  contarPendentes() {
    return this.prisma.inqueritoInstitucional.count({ where: { aprovacao: { path: ['estado'], equals: 'pendente' } } })
  }

  async porId(id) {
    const n = Number(id)
    if (!Number.isSafeInteger(n) || n < 1) return null
    return paraEntidade(await this.prisma.inqueritoInstitucional.findUnique({ where: { id: n }, include: { _count: { select: { participacoes: true } } } }))
  }

  async criar(dados) {
    return paraEntidade(await this.prisma.inqueritoInstitucional.create({ data: dados }))
  }

  async guardar(i, dados) {
    const d = 'aprovacao' in dados ? { ...dados, aprovacao: dados.aprovacao ?? Prisma.DbNull } : dados
    return paraEntidade(await this.prisma.inqueritoInstitucional.update({ where: { id: i.id }, data: d }))
  }

  apagar(id) {
    return this.prisma.inqueritoInstitucional.delete({ where: { id } })
  }

  async respondidos(contaId, ids) {
    if (!ids.length) return new Set()
    const l = await this.prisma.participacaoInstitucional.findMany({ where: { contaId, inqueritoId: { in: ids } }, select: { inqueritoId: true } })
    return new Set(l.map((x) => x.inqueritoId))
  }

  async respostas(inqueritoId) {
    return (await this.prisma.respostaInstitucional.findMany({ where: { inqueritoId }, select: { respostas: true } })).map((r) => r.respostas)
  }

  // grava a resposta sem a ligar a quem respondeu (só o dia, para não se cruzar com a participação)
  async responder(inqueritoId, contaId, respostas, quando) {
    const dia = new Date(new Date(quando).toISOString().slice(0, 10))
    try {
      await this.prisma.$transaction([
        this.prisma.participacaoInstitucional.create({ data: { inqueritoId, contaId, em: dia } }),
        this.prisma.respostaInstitucional.create({ data: { inqueritoId, respostas, criadaEm: dia } }),
      ])
    } catch (e) {
      if (eDuplicado(e)) throw new Conflito('Já respondeu a este inquérito.')
      throw e
    }
  }

  // contas a que se destina: estudantes com matrícula ativa (nas turmas indicadas) e/ou docentes ativos
  async destinatarios(i) {
    const ids = []
    if (i.publico !== 'docentes') {
      const m = await this.prisma.matricula.findMany({
        where: { estado: 'ativa', estudante: { ativo: true }, ...(i.turmaIds.length ? { turmaId: { in: i.turmaIds } } : {}) }, select: { estudanteId: true },
      })
      ids.push(...m.map((x) => x.estudanteId))
    }
    if (i.publico !== 'estudantes') ids.push(...(await this.prisma.contaPortal.findMany({ where: { tipo: 'docente', ativo: true }, select: { id: true } })).map((c) => c.id))
    return [...new Set(ids)]
  }
}
