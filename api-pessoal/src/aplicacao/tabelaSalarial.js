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
}
