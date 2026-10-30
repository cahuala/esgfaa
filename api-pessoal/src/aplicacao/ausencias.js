import { invalido, naoEncontrado } from '../erros.js'
import { nomeDoPosto } from '../dominio/pessoal/hierarquia.js'
import { CARREIRAS_CIVIS } from '../dominio/pessoal/civis.js'
import { exigir } from './sessao.js'

const dia = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null)
// o que o Mapa de ausências temporárias conta e o sistema ainda não tinha (as licenças e o estado têm registo próprio)
export const TIPOS_AUSENCIA = { falta: 'Falta', sem_justificacao: 'Ausência sem justificação', hospital: 'Baixa hospitalar', detido: 'Detido' }

/*
  Faltas e ausências: cada registo tem o tipo, o início e o fim (vazio enquanto durar — internado, detido).
  Entram no Mapa de ausências temporárias do período em que estão. Quem regista fica na auditoria.
*/
export class ServicoAusencias {
  constructor({ bd, auditoria, agora = () => new Date() }) {
    Object.assign(this, { bd, auditoria, agora })
  }

  // de / ate: o período (AAAA-MM-DD); devolve as que tocam o período
  async listar(u, { pessoaId, tipo, de, ate, emCurso } = {}) {
    exigir(u, 'ver')
    const hoje = dia(this.agora())
    const where = { ...(pessoaId ? { pessoaId: Number(pessoaId) } : {}), ...(tipo ? { tipo } : {}) }
    const a = ate || (emCurso ? hoje : null)
    const d = de || (emCurso ? hoje : null)
    if (a) where.inicio = { lte: new Date(a) }
    if (d) where.OR = [{ fim: null }, { fim: { gte: new Date(d) } }]
    const l = await this.bd.ausencia.findMany({ where, include: { pessoa: { select: { id: true, nome: true, nip: true, numeroAgente: true, posto: true, ramo: true, fotoId: true, unidadeId: true } } }, orderBy: { inicio: 'desc' }, take: 5000 })
    return l.map((x) => ({
      id: x.id, pessoaId: x.pessoaId, tipo: x.tipo, tipoNome: TIPOS_AUSENCIA[x.tipo] ?? x.tipo, inicio: dia(x.inicio), fim: dia(x.fim), motivo: x.motivo, documento: x.documento,
      dias: Math.round((new Date(x.fim ?? hoje) - new Date(x.inicio)) / 86_400_000) + 1, emCurso: !x.fim || dia(x.fim) >= hoje,
      nome: x.pessoa.nome, fotoId: x.pessoa.fotoId, unidadeId: x.pessoa.unidadeId, identificacao: x.pessoa.nip || x.pessoa.numeroAgente || '', postoNome: x.pessoa.posto ? nomeDoPosto(x.pessoa.posto, x.pessoa.ramo) : 'Civil',
    }))
  }

  async criar(u, d) {
    exigir(u, 'editar')
    if (!TIPOS_AUSENCIA[d.tipo]) throw invalido('Tipo desconhecido.', 'tipo')
    if (d.fim && d.fim < d.inicio) throw invalido('O fim tem de ser depois do início.', 'fim')
    if (d.tipo !== 'hospital' && d.tipo !== 'detido' && !d.fim) throw invalido('Indique o último dia da falta.', 'fim')
    const p = await this.bd.pessoa.findUnique({ where: { id: d.pessoaId }, select: { id: true, nome: true } })
    if (!p) throw naoEncontrado('Ficha não encontrada.')
    const x = await this.bd.ausencia.create({ data: { pessoaId: p.id, tipo: d.tipo, inicio: new Date(d.inicio), fim: d.fim ? new Date(d.fim) : null, motivo: d.motivo ?? '', documento: d.documento ?? '', criadoPor: u.email } })
    await this.auditoria.registar(u, 'registar_ausencia', `${p.nome}: ${TIPOS_AUSENCIA[x.tipo]} ${dia(x.inicio)}${x.fim ? `–${dia(x.fim)}` : ' (em curso)'}`)
    return { ...x, inicio: dia(x.inicio), fim: dia(x.fim) }
  }

  // fechar (alta hospitalar, libertação) ou corrigir as datas
  async editar(u, id, d) {
    exigir(u, 'editar')
    const x = await this.bd.ausencia.findUnique({ where: { id } })
    if (!x) throw naoEncontrado('Registo não encontrado.')
    const fim = d.fim === undefined ? x.fim : d.fim ? new Date(d.fim) : null
    if (fim && fim < x.inicio) throw invalido('O fim tem de ser depois do início.', 'fim')
    const n = await this.bd.ausencia.update({ where: { id }, data: { fim, ...(d.motivo !== undefined ? { motivo: d.motivo } : {}), ...(d.documento !== undefined ? { documento: d.documento } : {}) } })
    await this.auditoria.registar(u, 'editar_ausencia', `#${id}: fim ${dia(n.fim) ?? 'em aberto'}`)
    return { ...n, inicio: dia(n.inicio), fim: dia(n.fim) }
  }

  async remover(u, id) {
    exigir(u, 'editar')
    const r = await this.bd.ausencia.deleteMany({ where: { id } })
    if (!r.count) throw naoEncontrado('Registo não encontrado.')
    await this.auditoria.registar(u, 'remover_ausencia', `#${id}`)
  }

  /*
    Mapa de efectividade (controlo de faltas) do pessoal civil, mês a mês, como o modelo da Escola: cada civil
    no activo (sem os domiciliares, que servem fora da Escola), a categoria e os dias com falta.
    mes: AAAA-MM. As faltas são as do registo «Faltas e ausências» (tipo falta) que tocam o mês.
  */
  async mapaCivis(u, { mes }) {
    exigir(u, 'ver')
    if (!/^\d{4}-\d{2}$/.test(String(mes ?? ''))) throw invalido('Indique o mês (AAAA-MM).', 'mes')
    const [a, m] = mes.split('-').map(Number)
    const nDias = new Date(Date.UTC(a, m, 0)).getUTCDate()
    const inicio = new Date(Date.UTC(a, m - 1, 1))
    const fim = new Date(Date.UTC(a, m - 1, nDias))
    const pessoas = await this.bd.pessoa.findMany({
      where: { tipo: 'civil', ativo: true, NOT: { vinculo: 'domiciliar' } },
      select: { id: true, nome: true, carreiraCivil: true, categoriaCivil: true },
    })
    const ordem = (p) => CARREIRAS_CIVIS[p.carreiraCivil]?.nivel ?? 99
    pessoas.sort((x, y) => ordem(x) - ordem(y) || x.nome.localeCompare(y.nome, 'pt'))
    const faltas = await this.bd.ausencia.findMany({ where: { tipo: 'falta', pessoaId: { in: pessoas.map((p) => p.id) }, inicio: { lte: fim }, OR: [{ fim: null }, { fim: { gte: inicio } }] } })
    const dias = {}
    for (const f of faltas) {
      const de = Math.max(f.inicio.getTime(), inicio.getTime())
      const ate = Math.min((f.fim ?? fim).getTime(), fim.getTime())
      for (let t = de; t <= ate; t += 86_400_000) (dias[f.pessoaId] ??= new Set()).add(new Date(t).getUTCDate())
    }
    const fimDeSemana = Array.from({ length: nDias }, (_, i) => i + 1).filter((d) => [0, 6].includes(new Date(Date.UTC(a, m - 1, d)).getUTCDay()))
    return {
      mes, dias: nDias, fimDeSemana,
      pessoas: pessoas.map((p) => ({ id: p.id, nome: p.nome, categoria: p.categoriaCivil || CARREIRAS_CIVIS[p.carreiraCivil]?.nome || '', faltas: [...(dias[p.id] ?? [])].sort((x, y) => x - y) })),
    }
  }

  // marca ou tira a falta de um dia (no mapa): um dia novo é uma falta de um dia; tirar um dia do meio de uma falta mais longa divide-a
  async marcarFalta(u, { pessoaId, data, falta }) {
    exigir(u, 'editar')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data ?? ''))) throw invalido('Data inválida.', 'data')
    const p = await this.bd.pessoa.findUnique({ where: { id: Number(pessoaId) }, select: { id: true, nome: true, tipo: true } })
    if (!p) throw naoEncontrado('Ficha não encontrada.')
    // o mapa de efectividade é só do pessoal civil; as faltas dos militares registam-se em «Faltas e ausências»
    if (p.tipo !== 'civil') throw invalido('O mapa de efectividade é só do pessoal civil.')
    const d = new Date(`${data}T00:00:00Z`)
    const existente = await this.bd.ausencia.findFirst({ where: { pessoaId: p.id, tipo: 'falta', inicio: { lte: d }, OR: [{ fim: null }, { fim: { gte: d } }] } })
    if (falta && !existente) {
      await this.bd.ausencia.create({ data: { pessoaId: p.id, tipo: 'falta', inicio: d, fim: d, motivo: 'Mapa de efectividade', criadoPor: u.email } })
      await this.auditoria.registar(u, 'registar_ausencia', `${p.nome}: Falta ${data}`)
    } else if (!falta && existente) {
      const antes = new Date(d.getTime() - 86_400_000)
      const depois = new Date(d.getTime() + 86_400_000)
      await this.bd.$transaction([
        this.bd.ausencia.delete({ where: { id: existente.id } }),
        ...(existente.inicio < d ? [this.bd.ausencia.create({ data: { pessoaId: p.id, tipo: 'falta', inicio: existente.inicio, fim: antes, motivo: existente.motivo, documento: existente.documento, criadoPor: existente.criadoPor } })] : []),
        ...(!existente.fim || existente.fim > d ? [this.bd.ausencia.create({ data: { pessoaId: p.id, tipo: 'falta', inicio: depois, fim: existente.fim, motivo: existente.motivo, documento: existente.documento, criadoPor: existente.criadoPor } })] : []),
      ])
      await this.auditoria.registar(u, 'remover_ausencia', `${p.nome}: sem falta ${data}`)
    }
    return { pessoaId: p.id, data, falta: Boolean(falta) }
  }
}
