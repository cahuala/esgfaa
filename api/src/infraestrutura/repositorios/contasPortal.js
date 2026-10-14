import { ContaPortal } from '../../dominio/academico/pessoas/conta.js'
import { MAX_TENTATIVAS, MINUTOS_BLOQUEIO } from '../../dominio/identidade/utilizador.js'
import { Conflito } from '../../dominio/comum/erros.js'
import { eDuplicado } from '../bd/prisma.js'

const iso = (d) => (d ? new Date(d).toISOString() : null)

export const paraConta = (l) => l && new ContaPortal({
  id: l.id, tipo: l.tipo, numero: l.numero, nome: l.nome, email: l.email, senha: l.senha, ativo: l.ativo, dados: l.dados,
  criadoEm: iso(l.criadoEm), ultimoAcesso: iso(l.ultimoAcesso), tentativasFalhadas: l.tentativasFalhadas,
  bloqueadoAte: iso(l.bloqueadoAte), versaoToken: l.versaoToken, deveMudarSenha: l.deveMudarSenha,
})

export class RepositorioContasPortal {
  constructor({ prisma }) {
    this.prisma = prisma
  }

  async tokenCalendario(id) {
    return (await this.prisma.contaPortal.findUnique({ where: { id }, select: { tokenCalendario: true } }))?.tokenCalendario ?? null
  }

  definirTokenCalendario(id, token) {
    return this.prisma.contaPortal.update({ where: { id }, data: { tokenCalendario: token } })
  }

  async porTokenCalendario(token) {
    return paraConta(await this.prisma.contaPortal.findUnique({ where: { tokenCalendario: token } }))
  }

  async porNumero(numero) {
    return paraConta(await this.prisma.contaPortal.findUnique({ where: { numero: String(numero).toUpperCase() } }))
  }

  async porId(id) {
    const n = Number(id)
    if (!Number.isSafeInteger(n) || n < 1) return null
    return paraConta(await this.prisma.contaPortal.findUnique({ where: { id: n } }))
  }

  async porEmail(email) {
    return paraConta(await this.prisma.contaPortal.findUnique({ where: { email: String(email).toLowerCase() } }))
  }

  async listar({ tipo, q } = {}) {
    const termo = q ? { contains: q.replace(/[\\%_]/g, (c) => `\\${c}`), mode: 'insensitive' } : undefined
    const linhas = await this.prisma.contaPortal.findMany({
      where: { ...(tipo ? { tipo } : {}), ...(termo ? { OR: [{ nome: termo }, { email: termo }, { numero: termo }] } : {}) },
      orderBy: { nome: 'asc' },
      take: 2000,
    })
    return linhas.map(paraConta)
  }

  // próximo número sequencial do ano (E2026-0001, …)
  async proximaSequencia(tipo, ano) {
    const prefixo = `${tipo === 'docente' ? 'D' : 'E'}${ano}-`
    const ultimo = await this.prisma.contaPortal.findFirst({ where: { numero: { startsWith: prefixo } }, orderBy: { numero: 'desc' }, select: { numero: true } })
    return ultimo ? Number(ultimo.numero.slice(prefixo.length)) + 1 : 1
  }

  async criar({ tipo, numero, nome, email, senha, dados }) {
    try {
      return paraConta(await this.prisma.contaPortal.create({ data: { tipo, numero, nome, email, senha, dados: dados || {}, deveMudarSenha: true } }))
    } catch (erro) {
      if (eDuplicado(erro)) throw new Conflito(String(erro.meta?.target || '').includes('email') ? 'Já existe uma conta com este e-mail.' : 'Número já usado; tente de novo.')
      throw erro
    }
  }

  async guardar(c) {
    try {
      return paraConta(await this.prisma.contaPortal.update({
        where: { id: c.id },
        data: {
          nome: c.nome, email: c.email, senha: c.senha, ativo: Boolean(c.ativo), dados: c.dados || {},
          versaoToken: c.versaoToken, deveMudarSenha: Boolean(c.deveMudarSenha),
          tentativasFalhadas: c.tentativasFalhadas, bloqueadoAte: c.bloqueadoAte ? new Date(c.bloqueadoAte) : null,
        },
      }))
    } catch (erro) {
      if (eDuplicado(erro)) throw new Conflito('Já existe uma conta com este e-mail.')
      throw erro
    }
  }

  // mesmo mecanismo do painel: a tentativa reserva-se antes de verificar a palavra-passe
  async reservarTentativa(id, agora) {
    const linhas = await this.prisma.$queryRaw`
      UPDATE contas_portal SET
        tentativas_falhadas = CASE WHEN bloqueado_ate IS NOT NULL AND bloqueado_ate <= ${agora} THEN 1 ELSE tentativas_falhadas + 1 END,
        bloqueado_ate = CASE WHEN bloqueado_ate IS NOT NULL AND bloqueado_ate <= ${agora} THEN NULL ELSE bloqueado_ate END
      WHERE id = ${id} AND (bloqueado_ate IS NULL OR bloqueado_ate <= ${agora})
      RETURNING tentativas_falhadas`
    if (linhas.length && linhas[0].tentativas_falhadas <= MAX_TENTATIVAS) return { permitido: true, tentativa: linhas[0].tentativas_falhadas }
    const bloqueadoAte = linhas.length ? await this.bloquear(id, agora) : (await this.porId(id)).bloqueadoAte
    return { permitido: false, bloqueadoAte }
  }

  async bloquear(id, agora) {
    const ate = new Date(agora.getTime() + MINUTOS_BLOQUEIO * 60_000)
    await this.prisma.contaPortal.update({ where: { id }, data: { bloqueadoAte: ate, tentativasFalhadas: 0 } })
    return ate.toISOString()
  }

  async registarEntrada(id, agora) {
    await this.prisma.contaPortal.update({ where: { id }, data: { tentativasFalhadas: 0, bloqueadoAte: null, ultimoAcesso: agora } })
  }
}
