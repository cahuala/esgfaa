import { Emprestimo } from '../../dominio/biblioteca/emprestimo.js'
import { Conflito } from '../../dominio/comum/erros.js'
import { eDuplicado } from '../bd/prisma.js'

const iso = (d) => (d ? d.toISOString() : null)
const leitor = (c) => c && { id: c.id, nome: c.nome, numero: c.numero, tipo: c.tipo, email: c.email }

const paraEmprestimo = (e) => e && new Emprestimo({
  id: e.id, exemplarId: e.exemplarId, contaId: e.contaId, emprestadoEm: iso(e.emprestadoEm), prazo: iso(e.prazo), renovacoes: e.renovacoes,
  devolvidoEm: iso(e.devolvidoEm), registadoPor: e.registadoPor,
  ...(e.conta ? { leitor: leitor(e.conta) } : {}),
  ...(e.exemplar ? { exemplar: { id: e.exemplar.id, codigo: e.exemplar.codigo, obra: e.exemplar.obra && { id: e.exemplar.obra.id, titulo: e.exemplar.obra.titulo, autores: e.exemplar.obra.autores, cota: e.exemplar.obra.cota } } } : {}),
})

const paraObra = (o) => o && {
  id: o.id, tipo: o.tipo, titulo: o.titulo, subtitulo: o.subtitulo, autores: o.autores, ano: o.ano, editora: o.editora, edicao: o.edicao, isbn: o.isbn,
  cota: o.cota, assuntos: o.assuntos, idioma: o.idioma, resumo: o.resumo, ficheiroId: o.ficheiroId, acesso: o.acesso,
  ficheiro: o.ficheiro ? { nome: o.ficheiro.nome, tamanho: o.ficheiro.tamanho, tipo: o.ficheiro.tipo } : null,
  criadoEm: iso(o.criadoEm), atualizadoEm: iso(o.atualizadoEm),
  ...(o.exemplares ? {
    exemplares: o.exemplares.map((x) => ({
      id: x.id, codigo: x.codigo, estado: x.estado, localizacao: x.localizacao,
      emprestimo: x.emprestimos?.[0] ? paraEmprestimo(x.emprestimos[0]) : null,
    })),
  } : {}),
}

const ativoCom = { where: { devolvidoEm: null }, include: { conta: true }, take: 1 }
const sem = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

// catálogo (obras e exemplares) e circulação (empréstimos)
export class RepositorioBiblioteca {
  constructor({ prisma }) {
    this.prisma = prisma
  }

  #duplicado(e) {
    if (!eDuplicado(e)) throw e
    const alvo = String(e.meta?.target || '')
    throw new Conflito(alvo.includes('isbn') ? 'Já existe uma obra com este ISBN.' : alvo.includes('codigo') ? 'Já existe um exemplar com este código.' : 'Registo repetido.')
  }

  // ---------- catálogo ----------

  async listarObras({ tipo = '', soDigital = false } = {}) {
    const l = await this.prisma.obra.findMany({
      where: { ...(tipo ? { tipo } : {}), ...(soDigital ? { ficheiroId: { not: null } } : {}) }, orderBy: [{ titulo: 'asc' }], take: 20_000,
      include: { ficheiro: true, exemplares: { orderBy: { codigo: 'asc' }, include: { emprestimos: ativoCom } } },
    })
    return l.map(paraObra)
  }

  // pesquisa em título, autores, assuntos, editora, cota, resumo, ISBN e código do exemplar (sem distinguir maiúsculas nem acentos)
  async pesquisarObras({ q = '', limite = 500, ...filtros } = {}) {
    const base = await this.listarObras(filtros)
    const termo = sem(q.trim())
    if (!termo) return base.slice(0, limite)
    const tem = (s) => sem(s).includes(termo)
    const isbn = q.replace(/[\s-]/g, '')
    return base.filter((o) => tem(o.titulo) || tem(o.subtitulo) || tem(o.editora) || tem(o.cota) || tem(o.resumo) || o.autores.some(tem) || o.assuntos.some(tem)
      || (/^\d{4,}X?$/i.test(isbn) && o.isbn?.includes(isbn.toUpperCase())) || o.exemplares.some((x) => x.codigo === q.trim().toUpperCase())).slice(0, limite)
  }

  async obra(id) {
    const n = Number(id)
    if (!Number.isSafeInteger(n) || n < 1) return null
    return paraObra(await this.prisma.obra.findUnique({
      where: { id: n }, include: { ficheiro: true, exemplares: { orderBy: { codigo: 'asc' }, include: { emprestimos: ativoCom } } },
    }))
  }

  async criarObra(dados) {
    try {
      return await this.obra((await this.prisma.obra.create({ data: dados })).id)
    } catch (e) {
      return this.#duplicado(e)
    }
  }

  async guardarObra(id, dados) {
    try {
      await this.prisma.obra.update({ where: { id }, data: dados })
    } catch (e) {
      this.#duplicado(e)
    }
    return this.obra(id)
  }

  apagarObra(id) {
    return this.prisma.obra.delete({ where: { id } })
  }

  async contarEmprestimosAtivosDaObra(obraId) {
    return this.prisma.emprestimo.count({ where: { devolvidoEm: null, exemplar: { obraId } } })
  }

  async exemplar(id) {
    const n = Number(id)
    if (!Number.isSafeInteger(n) || n < 1) return null
    return this.prisma.exemplar.findUnique({ where: { id: n }, include: { obra: true, emprestimos: { where: { devolvidoEm: null }, take: 1 } } })
  }

  exemplarPorCodigo(codigo) {
    return this.prisma.exemplar.findUnique({ where: { codigo: String(codigo).trim().toUpperCase() }, include: { obra: true, emprestimos: { where: { devolvidoEm: null }, take: 1 } } })
  }

  async criarExemplar(obraId, dados) {
    try {
      return await this.prisma.exemplar.create({ data: { obraId, ...dados } })
    } catch (e) {
      return this.#duplicado(e)
    }
  }

  async guardarExemplar(id, dados) {
    try {
      return await this.prisma.exemplar.update({ where: { id }, data: dados })
    } catch (e) {
      return this.#duplicado(e)
    }
  }

  apagarExemplar(id) {
    return this.prisma.exemplar.delete({ where: { id } })
  }

  // próximo código livre com um prefixo (BIB-000123)
  async proximoCodigo(prefixo = 'BIB-') {
    const l = await this.prisma.exemplar.findMany({ where: { codigo: { startsWith: prefixo } }, select: { codigo: true } })
    const n = l.map((x) => Number(x.codigo.slice(prefixo.length))).filter(Number.isInteger)
    return `${prefixo}${String((n.length ? Math.max(...n) : 0) + 1).padStart(6, '0')}`
  }

  // ---------- circulação ----------

  async emprestimo(id) {
    const n = Number(id)
    if (!Number.isSafeInteger(n) || n < 1) return null
    return paraEmprestimo(await this.prisma.emprestimo.findUnique({ where: { id: n }, include: { conta: true, exemplar: { include: { obra: true } } } }))
  }

  async ativosDoLeitor(contaId) {
    const l = await this.prisma.emprestimo.findMany({ where: { contaId, devolvidoEm: null }, orderBy: { prazo: 'asc' }, include: { exemplar: { include: { obra: true } } } })
    return l.map(paraEmprestimo)
  }

  async doLeitor(contaId, { limite = 100 } = {}) {
    const l = await this.prisma.emprestimo.findMany({ where: { contaId }, orderBy: [{ devolvidoEm: { sort: 'desc', nulls: 'first' } }, { emprestadoEm: 'desc' }], take: limite, include: { exemplar: { include: { obra: true } } } })
    return l.map(paraEmprestimo)
  }

  async listarEmprestimos({ ativos = true, ate = null, limite = 1000 } = {}) {
    const l = await this.prisma.emprestimo.findMany({
      where: { ...(ativos ? { devolvidoEm: null } : {}), ...(ate ? { prazo: { lt: ate } } : {}) },
      orderBy: ativos ? { prazo: 'asc' } : { emprestadoEm: 'desc' }, take: limite,
      include: { conta: true, exemplar: { include: { obra: true } } },
    })
    return l.map(paraEmprestimo)
  }

  async emprestar({ exemplarId, contaId, emprestadoEm, prazo, registadoPor }) {
    try {
      const e = await this.prisma.emprestimo.create({ data: { exemplarId, contaId, emprestadoEm, prazo, registadoPor, exemplarAtivo: exemplarId } })
      return this.emprestimo(e.id)
    } catch (e) {
      if (eDuplicado(e)) throw new Conflito('Este exemplar já está emprestado.')
      throw e
    }
  }

  async devolver(id, quando) {
    // só muda se ainda estiver ativo (duas devoluções ao mesmo tempo não se pisam)
    const { count } = await this.prisma.emprestimo.updateMany({ where: { id, devolvidoEm: null }, data: { devolvidoEm: quando, exemplarAtivo: null } })
    if (!count) throw new Conflito('Este empréstimo já foi devolvido.')
    return this.emprestimo(id)
  }

  async renovar(id, { prazo, renovacoes }) {
    const { count } = await this.prisma.emprestimo.updateMany({ where: { id, devolvidoEm: null, renovacoes: renovacoes - 1 }, data: { prazo, renovacoes } })
    if (!count) throw new Conflito('O empréstimo mudou entretanto. Atualize a página.')
    return this.emprestimo(id)
  }

  async resumo(agora) {
    const [obras, exemplares, ativos, atrasados, digitais] = await Promise.all([
      this.prisma.obra.count(), this.prisma.exemplar.count(), this.prisma.emprestimo.count({ where: { devolvidoEm: null } }),
      this.prisma.emprestimo.count({ where: { devolvidoEm: null, prazo: { lt: agora } } }), this.prisma.obra.count({ where: { ficheiroId: { not: null } } }),
    ])
    return { obras, exemplares, ativos, atrasados, digitais }
  }
}
