import { invalido } from '../erros.js'
import { exigir } from './sessao.js'
import { PERCENTAGENS, REPRESENTACAO_QP, VENCIMENTO_BASE, tabelaSalarial } from '../dominio/pessoal/tabelaSalarial.js'

/*
  Tabela salarial dos militares (como no SIGP): altera-se só o vencimento base de cada posto; as outras
  componentes calculam-se. Os vencimentos base alterados ficam nas definições («tabela-salarial»).
*/
export class ServicoTabelaSalarial {
  constructor({ bd, auditoria }) {
    Object.assign(this, { bd, auditoria })
  }

  async bases() {
    return (await this.bd.definicao.findUnique({ where: { chave: 'tabela-salarial' } }))?.valor ?? {}
  }

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
}
