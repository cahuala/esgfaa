import { Utilizador, MAX_TENTATIVAS, MINUTOS_BLOQUEIO } from '../../dominio/identidade/utilizador.js'
import { Conflito } from '../../dominio/comum/erros.js'
import { eDuplicado } from '../bd/prisma.js'

const iso = (d) => (d ? new Date(d).toISOString() : null)

const paraEntidade = (l) => l && new Utilizador({
  id: l.id, nome: l.nome, email: l.email, senha: l.senha, papel: l.papel, ativo: l.ativo,
  criadoEm: iso(l.criadoEm), ultimoAcesso: iso(l.ultimoAcesso), tentativasFalhadas: l.tentativasFalhadas,
  bloqueadoAte: iso(l.bloqueadoAte), versaoToken: l.versaoToken, deveMudarSenha: l.deveMudarSenha,
})

const colunas = (u) => ({
  nome: u.nome, email: u.email, senha: u.senha, papel: u.papel, ativo: Boolean(u.ativo),
  ultimoAcesso: u.ultimoAcesso ? new Date(u.ultimoAcesso) : null,
  tentativasFalhadas: u.tentativasFalhadas, bloqueadoAte: u.bloqueadoAte ? new Date(u.bloqueadoAte) : null,
  versaoToken: u.versaoToken, deveMudarSenha: Boolean(u.deveMudarSenha),
})

export class RepositorioUtilizadores {
  constructor({ prisma }) {
    this.prisma = prisma
  }

  async porId(id) {
    const n = Number(id)
    if (!Number.isSafeInteger(n) || n < 1) return null
    return paraEntidade(await this.prisma.utilizador.findUnique({ where: { id: n } }))
  }

  async porEmail(email) {
    return paraEntidade(await this.prisma.utilizador.findUnique({ where: { email: String(email).toLowerCase() } }))
  }

  async listar() {
    return (await this.prisma.utilizador.findMany({ orderBy: { nome: 'asc' } })).map(paraEntidade)
  }

  contar() {
    return this.prisma.utilizador.count()
  }

  contarAdministradoresAtivos({ exceto = null } = {}) {
    return this.prisma.utilizador.count({ where: { papel: 'administrador', ativo: true, ...(exceto ? { id: { not: exceto } } : {}) } })
  }

  async contarPorPapel() {
    const grupos = await this.prisma.utilizador.groupBy({ by: ['papel'], _count: { _all: true } })
    return Object.fromEntries(grupos.map((g) => [g.papel, g._count._all]))
  }

  async emailEmUso(email, { exceto = null } = {}) {
    return Boolean(await this.prisma.utilizador.findFirst({ where: { email, ...(exceto ? { id: { not: exceto } } : {}) }, select: { id: true } }))
  }

  async criar(u) {
    try {
      return paraEntidade(await this.prisma.utilizador.create({ data: colunas(u) }))
    } catch (erro) {
      if (eDuplicado(erro)) throw new Conflito('Já existe um utilizador com este e-mail.')
      throw erro
    }
  }

  async guardar(u) {
    try {
      return paraEntidade(await this.prisma.utilizador.update({ where: { id: u.id }, data: colunas(u) }))
    } catch (erro) {
      if (eDuplicado(erro)) throw new Conflito('Já existe um utilizador com este e-mail.')
      throw erro
    }
  }

  /*
    Reserva uma tentativa de entrada, de forma atómica, ANTES de verificar a palavra-passe.
    Assim, mesmo com centenas de pedidos em paralelo, nunca se verificam mais de MAX_TENTATIVAS
    palavras-passe por janela de bloqueio. Devolve { permitido, tentativa, bloqueadoAte }.
  */
  async reservarTentativa(id, agora) {
    const linhas = await this.prisma.$queryRaw`
      UPDATE utilizadores SET
        tentativas_falhadas = CASE WHEN bloqueado_ate IS NOT NULL AND bloqueado_ate <= ${agora} THEN 1 ELSE tentativas_falhadas + 1 END,
        bloqueado_ate = CASE WHEN bloqueado_ate IS NOT NULL AND bloqueado_ate <= ${agora} THEN NULL ELSE bloqueado_ate END
      WHERE id = ${id} AND (bloqueado_ate IS NULL OR bloqueado_ate <= ${agora})
      RETURNING tentativas_falhadas`
    if (linhas.length && linhas[0].tentativas_falhadas <= MAX_TENTATIVAS) return { permitido: true, tentativa: linhas[0].tentativas_falhadas }
    // já bloqueada, ou excedeu o limite com pedidos simultâneos: bloqueia (ou mantém o bloqueio)
    const bloqueadoAte = linhas.length ? await this.bloquear(id, agora) : (await this.porId(id)).bloqueadoAte
    return { permitido: false, bloqueadoAte }
  }

  async bloquear(id, agora) {
    const ate = new Date(agora.getTime() + MINUTOS_BLOQUEIO * 60_000)
    await this.prisma.utilizador.update({ where: { id }, data: { bloqueadoAte: ate, tentativasFalhadas: 0 } })
    return ate.toISOString()
  }

  async registarEntrada(id, agora) {
    await this.prisma.utilizador.update({ where: { id }, data: { tentativasFalhadas: 0, bloqueadoAte: null, ultimoAcesso: agora } })
  }
}
