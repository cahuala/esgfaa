import { invalido } from '../erros.js'
import { exigir } from './sessao.js'
import { PERCENTAGENS, REPRESENTACAO_QP, VENCIMENTO_BASE, tabelaSalarial } from '../dominio/pessoal/tabelaSalarial.js'
import { CARREIRAS_CIVIS, remuneracaoDaCategoria } from '../dominio/pessoal/civis.js'

/*
  Tabela salarial dos militares (como no SIGP): altera-se só o vencimento base de cada posto; as outras
  componentes calculam-se. Os vencimentos base alterados ficam nas definições («tabela-salarial»).
*/
export class ServicoTabelaSalarial {
  constructor({ bd, auditoria }) {
    Object.assign(this, { bd, auditoria })
  }

  async bases(chave = 'tabela-salarial') {
    return (await this.bd.definicao.findUnique({ where: { chave } }))?.valor ?? {}
  }
  basesCivis() { return this.bases('tabela-salarial-civis') }

  async ver(u) {
    exigir(u, 'ver')
    return { percentagens: PERCENTAGENS, representacao: REPRESENTACAO_QP, grupos: tabelaSalarial(await this.bases()) }
  }

  async alterarBase(u, posto, valor) {
    exigir(u, 'administrar')
    if (!(posto in VENCIMENTO_BASE)) throw invalido('Posto desconhecido.')
    const bases = { ...(await this.bases()), [posto]: Math.round(valor * 100) / 100 }
    await this.bd.definicao.upsert({ where: { chave: 'tabela-salarial' }, create: { chave: 'tabela-salarial', valor: bases }, update: { valor: bases } })
    await this.auditoria.registar(u, 'alterar_tabela_salarial', `${posto}: ${bases[posto]} Kz`)
    return this.ver(u)
  }

  // tabela salarial dos civis (como no SIGP): por categoria, o vencimento base e o líquido de referência
  async verCivis(u) {
    exigir(u, 'ver')
    const bases = await this.basesCivis()
    return Object.entries(CARREIRAS_CIVIS).filter(([, c]) => c.vencimentoBase).sort(([, a], [, b]) => a.nivel - b.nivel)
      .map(([k, c]) => ({ categoria: k, nome: c.nome, nivel: c.nivel, descricao: c.descricao, classes: c.categorias, ...remuneracaoDaCategoria(k, bases) }))
  }

  async alterarBaseCivil(u, categoria, valor) {
    exigir(u, 'administrar')
    if (!CARREIRAS_CIVIS[categoria]?.vencimentoBase) throw invalido('Categoria desconhecida.')
    const bases = { ...(await this.basesCivis()), [categoria]: Math.round(valor * 100) / 100 }
    await this.bd.definicao.upsert({ where: { chave: 'tabela-salarial-civis' }, create: { chave: 'tabela-salarial-civis', valor: bases }, update: { valor: bases } })
    await this.auditoria.registar(u, 'alterar_tabela_salarial_civis', `${categoria}: ${bases[categoria]} Kz`)
    return this.verCivis(u)
  }

  /*
    Tabela salarial dos civis por cargo (como no SIGP): o vencimento líquido de cada cargo civil, usado nas
    declarações de serviço quando o funcionário não tem vencimento próprio. Os cargos com o mesmo nome em
    unidades diferentes têm o mesmo vencimento. Sem valor, vale o líquido da categoria do funcionário.
  */
  basesCargos() { return this.bases('tabela-salarial-civis-cargos') }

  async verCivisCargos(u) {
    exigir(u, 'ver')
    const bases = await this.basesCargos()
    const cargos = await this.bd.cargo.findMany({ where: { tipo: { in: ['civil', 'ambos'] } }, include: { _count: { select: { pessoas: true } } } })
    const porNome = new Map()
    for (const c of cargos) {
      const k = chaveCargo(c.nome)
      const l = porNome.get(k) ?? { chave: k, nome: c.nome.trim(), lugares: 0, ocupados: 0, unidades: 0 }
      l.lugares += c.vagas
      l.ocupados += c._count.pessoas
      l.unidades++
      porNome.set(k, l)
    }
    return [...porNome.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt')).map((l) => ({ ...l, vencimento: bases[l.chave] ?? null }))
  }

  async alterarCargoCivil(u, chave, valor) {
    exigir(u, 'administrar')
    const existe = (await this.bd.cargo.findMany({ where: { tipo: { in: ['civil', 'ambos'] } }, select: { nome: true } })).some((c) => chaveCargo(c.nome) === chave)
    if (!existe) throw invalido('Cargo civil desconhecido.')
    const bases = { ...(await this.basesCargos()) }
    if (valor === null) delete bases[chave]
    else bases[chave] = Math.round(valor * 100) / 100
    await this.bd.definicao.upsert({ where: { chave: 'tabela-salarial-civis-cargos' }, create: { chave: 'tabela-salarial-civis-cargos', valor: bases }, update: { valor: bases } })
    await this.auditoria.registar(u, 'alterar_tabela_salarial_cargos', `${chave}: ${valor ?? 'pela categoria'}`)
    return this.verCivisCargos(u)
  }
}

// «Auxiliar de Limpeza » e «auxiliar de limpeza» são o mesmo cargo
export const chaveCargo = (nome) => String(nome ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ')
