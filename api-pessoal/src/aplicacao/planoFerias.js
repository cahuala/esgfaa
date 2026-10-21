import { invalido, naoEncontrado } from '../erros.js'
import { tempoServico } from '../dominio/pessoal/carreira.js'
import { exigir } from './sessao.js'

/*
  Plano de férias (como no SIGP, no Planeamento): por unidade e ano, o mês de férias de cada militar e
  funcionário civil. As guias de férias saem do plano (início no dia 1 do mês planeado); fora do plano
  escreve-se o início e o fim conta-se pelos dias a que tem direito (Lei n.º 13/18, art. 32.º: 30 dias,
  mais 15 com mais de 20 anos de serviço).
*/
export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
// 30 dias por ano; os militares com mais de 20 anos de serviço têm mais 15 (férias adicionais, guia à parte)
export const diasDeFerias = () => 30
export const feriasAdicionais = (p, hoje = new Date()) => (p.tipo === 'militar' && (tempoServico(p, hoje) || 0) > 20 ? 15 : 0)

// «Julho», «jul», «7» → 7
export function mesDe(texto) {
  const t = String(texto ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (/^\d{1,2}$/.test(t)) return Number(t) >= 1 && Number(t) <= 12 ? Number(t) : null
  const i = MESES.findIndex((m) => m.normalize('NFD').replace(/[̀-ͯ]/g, '').startsWith(t.slice(0, 3)) && t.length >= 3)
  return i >= 0 ? i + 1 : null
}

export class ServicoPlanoFerias {
  constructor({ bd, auditoria, pessoas, agora = () => new Date() }) {
    Object.assign(this, { bd, auditoria, pessoas, agora })
  }

  async ver(u, { ano, unidadeId, tipo }) {
    exigir(u, 'ver')
    const lista = await this.pessoas.listar(u, { unidadeId: unidadeId || undefined, tipo: tipo || undefined })
    const plano = await this.bd.planoFerias.findMany({ where: { ano, pessoaId: { in: lista.map((p) => p.id) } } })
    const mes = new Map(plano.map((x) => [x.pessoaId, x.mes]))
    const hoje = this.agora()
    const linhas = lista.map((p) => ({
      id: p.id, nome: p.nome, tipo: p.tipo, nip: p.nip, numeroAgente: p.numeroAgente, postoNome: p.postoNome, postoAbreviatura: p.postoAbreviatura, grau: p.grau ?? 0,
      categoriaCivil: p.categoriaCivil, unidadeNome: p.unidadeNome, fotoId: p.fotoId, mes: mes.get(p.id) ?? null, dias: diasDeFerias(p, hoje), adicionais: feriasAdicionais(p, hoje), hierarquia: p.hierarquia,
    })) // a lista vem já pela ordem hierárquica (posto, unidade, função, antiguidade)
    return { ano, linhas, planeados: linhas.filter((l) => l.mes).length }
  }

  async definir(u, { ano, pessoaId, mes }) {
    exigir(u, 'editar')
    const p = await this.bd.pessoa.findUnique({ where: { id: pessoaId }, select: { id: true, nome: true, ativo: true } })
    if (!p) throw naoEncontrado('Ficha não encontrada.')
    if (mes === null) await this.bd.planoFerias.deleteMany({ where: { ano, pessoaId } })
    else {
      if (!p.ativo) throw invalido('Já não está na Escola: não entra no plano de férias.')
      await this.bd.planoFerias.upsert({ where: { ano_pessoaId: { ano, pessoaId } }, create: { ano, pessoaId, mes, criadoPor: u.email }, update: { mes, criadoPor: u.email } })
    }
    await this.auditoria.registar(u, 'plano_ferias', `${p.nome}: ${mes ? MESES[mes - 1] : 'retirado'} de ${ano}`)
    return { pessoaId, ano, mes }
  }

  // linhas de um Excel/CSV: [{ identificador (NIP ou n.º de agente), mes }]
  async importar(u, { ano, linhas }) {
    exigir(u, 'editar')
    const ids = [...new Set(linhas.map((l) => String(l.identificador ?? '').trim()).filter(Boolean))]
    const pessoas = await this.bd.pessoa.findMany({ where: { ativo: true, OR: [{ nip: { in: ids } }, { numeroAgente: { in: ids } }] }, select: { id: true, nip: true, numeroAgente: true } })
    const porId = new Map(pessoas.flatMap((p) => [[p.nip, p.id], [p.numeroAgente, p.id]]).filter(([k]) => k))
    let feitos = 0
    const avisos = []
    for (const [i, l] of linhas.entries()) {
      const id = porId.get(String(l.identificador ?? '').trim())
      const mes = mesDe(l.mes)
      if (!id) { avisos.push(`Linha ${i + 2}: «${l.identificador}» não está registado.`); continue }
      if (!mes) { avisos.push(`Linha ${i + 2}: mês «${l.mes}» inválido.`); continue }
      await this.bd.planoFerias.upsert({ where: { ano_pessoaId: { ano, pessoaId: id } }, create: { ano, pessoaId: id, mes, criadoPor: u.email }, update: { mes, criadoPor: u.email } })
      feitos++
    }
    await this.auditoria.registar(u, 'plano_ferias_importar', `${feitos} linha(s) de ${ano}`)
    return { feitos, avisos }
  }
}
