import { ContaPortal } from '../../dominio/academico/pessoas/conta.js'
import { MAX_TENTATIVAS, MINUTOS_BLOQUEIO } from '../../dominio/identidade/utilizador.js'
import { Conflito } from '../../dominio/comum/erros.js'
import { eDuplicado } from '../bd/prisma.js'
import { ordenarPorHierarquia } from '../../dominio/academico/pessoas/hierarquia.js'

const iso = (d) => (d ? new Date(d).toISOString() : null)

export const paraConta = (l) => l && new ContaPortal({
  id: l.id, tipo: l.tipo, numero: l.numero, nome: l.nome, email: l.email, senha: l.senha, ativo: l.ativo, dados: l.dados, temFoto: Boolean(l.fotoCaminho),
  criadoEm: iso(l.criadoEm), ultimoAcesso: iso(l.ultimoAcesso), tentativasFalhadas: l.tentativasFalhadas,
  bloqueadoAte: iso(l.bloqueadoAte), versaoToken: l.versaoToken, deveMudarSenha: l.deveMudarSenha, verificadoEm: iso(l.verificadoEm),
})

export class RepositorioContasPortal {
  constructor({ prisma }) {
    this.prisma = prisma
  }

  // a fotografia (vinda do Pessoal): { fotoCaminho, fotoId } ou null
  async foto(id) {
    return this.prisma.contaPortal.findUnique({ where: { id }, select: { fotoCaminho: true, fotoId: true } })
  }

  async guardarFoto(id, fotoCaminho, fotoId) {
    await this.prisma.contaPortal.update({ where: { id }, data: { fotoCaminho, fotoId } })
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

  // o estado de várias contas de uma vez (para o Pessoal): número, ativa, último acesso e palavra-passe inicial
  async estados(ids) {
    const linhas = await this.prisma.contaPortal.findMany({ where: { id: { in: ids } }, select: { id: true, numero: true, ativo: true, ultimoAcesso: true, deveMudarSenha: true } })
    return linhas.map((l) => ({ ...l, ultimoAcesso: iso(l.ultimoAcesso) }))
  }

  // anoLetivo: quem está nesse ano (estudantes matriculados, docentes com cadeiras) e quem ainda não tem turma
  async listar({ tipo, q, anoLetivo } = {}) {
    const termo = q ? { contains: q.replace(/[\\%_]/g, (c) => `\\${c}`), mode: 'insensitive' } : undefined
    // os sem ano conhecido (docentes sem cadeiras nem anos, estudantes sem turma) só no ano actual e nos seguintes:
    // num ano que já passou não aparecem (esse ano mostra só quem lá esteve)
    const atual = anoLetivo ? (await this.prisma.anoLetivo.findFirst({ where: { atual: true }, select: { id: true } }))?.id : null
    const semAno = anoLetivo && (!atual || anoLetivo >= atual)
    const doAno = anoLetivo ? {
      OR: [
        { tipo: 'estudante', matriculas: { some: { turma: { anoLetivo } } } },
        // o docente desse ano: tem cadeiras nesse ano ou está na lista do corpo docente desse ano (do Pessoal)
        { tipo: 'docente', docencias: { some: { cadeira: { turma: { anoLetivo } } } } },
        { tipo: 'docente', anosDocente: { has: anoLetivo } },
        ...(semAno ? [
          // o docente de quem ainda não se sabem os anos (o Pessoal antigo não os enviava) e sem cadeiras: não desaparece
          { tipo: 'docente', anosDocente: { isEmpty: true }, docencias: { none: {} } },
          // o estudante ainda sem turma (para o matricular)
          { tipo: 'estudante', matriculas: { none: {} } },
        ] : []),
      ],
    } : {}
    const linhas = await this.prisma.contaPortal.findMany({
      where: { AND: [{ ...(tipo ? { tipo } : {}), ...(termo ? { OR: [{ nome: termo }, { email: termo }, { numero: termo }] } : {}) }, doAno] },
      orderBy: { nome: 'asc' },
      take: 2000,
    })
    // pela ordem hierárquica (o posto, do mais alto para o mais baixo; no mesmo posto, o nome), como nas relações
    return ordenarPorHierarquia(linhas.map(paraConta))
  }

  // os anos lectivos em que o docente leccionou (do Pessoal): junta-os aos que já tinha (nunca tira)
  async guardarAnosDocente(id, anos) {
    const c = await this.prisma.contaPortal.findUnique({ where: { id }, select: { anosDocente: true } })
    if (!c) return
    const todos = [...new Set([...(c.anosDocente ?? []), ...anos.filter((a) => /^\d{4}\/\d{4}$/.test(a))])].sort()
    if (todos.length !== (c.anosDocente ?? []).length) await this.prisma.contaPortal.update({ where: { id }, data: { anosDocente: todos } })
  }

  // a conta pelo NIP (ou n.º de agente; sem o «I» e os zeros da frente), só se houver uma
  // a conta que veio de uma ficha do Sistema de Pessoal («pessoal-N»)
  async porPessoalRef(tipo, ref) {
    if (!ref) return null
    const c = await this.prisma.contaPortal.findFirst({ where: { tipo, dados: { path: ['pessoalRef'], equals: String(ref) } } })
    return c ? paraConta(c) : null
  }

  async porNip(tipo, nip) {
    const norm = (n) => String(n ?? '').toUpperCase().replace(/\s/g, '').replace(/^I/, '').replace(/^0+/, '')
    const alvo = norm(nip)
    if (!alvo) return null
    const l = (await this.prisma.contaPortal.findMany({ where: { tipo } })).map(paraConta).filter((c) => norm(c.dados?.nip) === alvo || norm(c.dados?.numeroAgente) === alvo)
    return l.length === 1 ? l[0] : null
  }

  // próximo número sequencial do ano (E2026-0001, …)
  async proximaSequencia(tipo, ano) {
    const prefixo = `${tipo === 'docente' ? 'D' : 'E'}${ano}-`
    const ultimo = await this.prisma.contaPortal.findFirst({ where: { numero: { startsWith: prefixo } }, orderBy: { numero: 'desc' }, select: { numero: true } })
    return ultimo ? Number(ultimo.numero.slice(prefixo.length)) + 1 : 1
  }

  async criar({ tipo, numero, nome, email, senha, dados, ativo = true }) {
    try {
      return paraConta(await this.prisma.contaPortal.create({ data: { tipo, numero, nome, email, senha, dados: dados || {}, deveMudarSenha: true, ativo } }))
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
