import { conflito, invalido, naoEncontrado } from '../erros.js'
import { exigir, pode } from './sessao.js'

/*
  Casos que só valem depois do despacho do Comandante (Secretária digital):
    docente_novo       — alguém passa a docente (registado ou juntado): a ficha fica «a aguardar despacho»
    docente_categoria  — muda a categoria do docente
    docente_saida      — deixa de ser docente
    utilizador_novo    — conta do sistema com papel acima de utente (não entra até ser deferida)
    utilizador_papel   — muda o papel de uma conta
  O que se aplica ao deferir está em «dados». Quem pede é a Repartição; decide quem tem «despachar».
*/
export const TIPOS_PEDIDO = {
  docente_novo: 'Novo docente',
  docente_categoria: 'Mudança de categoria do docente',
  docente_saida: 'Deixa de ser docente',
  utilizador_novo: 'Nova conta do sistema',
  utilizador_papel: 'Mudança de papel no sistema',
}
export const ESTADOS_PEDIDO = { pendente: 'A aguardar despacho', deferido: 'Deferido', indeferido: 'Indeferido', anulado: 'Anulado' }
// quem decide: o Comandante (e só ele), sem passar pela conta de quem pediu
const SISTEMA = { email: 'despacho do Comandante', nome: 'Despacho do Comandante', papel: 'administrador' }

const linha = (x) => ({
  id: x.id, tipo: x.tipo, tipoNome: TIPOS_PEDIDO[x.tipo] ?? x.tipo, estado: x.estado, estadoNome: ESTADOS_PEDIDO[x.estado] ?? x.estado,
  resumo: x.resumo, dados: x.dados, pedidoPor: x.pedidoPor, pedidoEm: x.pedidoEm, decididoPor: x.decididoPor, decididoEm: x.decididoEm, despacho: x.despacho,
  pessoaId: x.pessoaId, utilizadorId: x.utilizadorId,
  pessoa: x.pessoa ? { id: x.pessoa.id, nome: x.pessoa.nome, nip: x.pessoa.nip, numeroAgente: x.pessoa.numeroAgente, fotoId: x.pessoa.fotoId } : null,
  utilizador: x.utilizador ? { id: x.utilizador.id, nome: x.utilizador.nome, email: x.utilizador.email, papel: x.utilizador.papel } : null,
})
const COM = { pessoa: { select: { id: true, nome: true, nip: true, numeroAgente: true, fotoId: true } }, utilizador: { select: { id: true, nome: true, email: true, papel: true } } }

export class ServicoDespachos {
  constructor({ bd, auditoria, tempoReal = null, agora = () => new Date() }) {
    Object.assign(this, { bd, auditoria, tempoReal, agora })
    // ligados depois (os serviços das pessoas e da sessão também pedem despachos)
    this.pessoas = null
    this.sessao = null
  }

  // regista um pedido (bd: a transacção de quem pede); um pedido igual ainda pendente é substituído
  async pedir(bd, u, { tipo, pessoaId = null, utilizadorId = null, dados = {}, resumo }) {
    const igual = await bd.pedidoDespacho.findFirst({ where: { tipo, estado: 'pendente', pessoaId, utilizadorId } })
    const r = igual
      ? await bd.pedidoDespacho.update({ where: { id: igual.id }, data: { dados, resumo, pedidoPor: u.email, pedidoEm: this.agora() } })
      : await bd.pedidoDespacho.create({ data: { tipo, pessoaId, utilizadorId, dados, resumo, pedidoPor: u.email } })
    this.tempoReal?.avisar('pessoal', { tipo: 'despacho' })
    return r
  }

  // anula os pedidos pendentes de um alvo (ex.: o docente novo que afinal não fica)
  async anular(bd, { tipo, pessoaId = null, utilizadorId = null }) {
    await bd.pedidoDespacho.updateMany({ where: { tipo, estado: 'pendente', pessoaId, utilizadorId }, data: { estado: 'anulado', decididoEm: this.agora() } })
  }

  async pendentesDe(filtro) {
    return (await this.bd.pedidoDespacho.findMany({ where: { estado: 'pendente', ...filtro }, include: COM, orderBy: { id: 'asc' } })).map(linha)
  }

  async contarPendentes(u) {
    return pode(u, 'despachar') ? this.bd.pedidoDespacho.count({ where: { estado: 'pendente' } }) : 0
  }

  // a lista (a Repartição vê o estado do que pediu; o Comandante decide)
  async listar(u, { estado } = {}) {
    exigir(u, 'ver')
    const where = estado ? { estado } : {}
    const l = await this.bd.pedidoDespacho.findMany({ where, include: COM, orderBy: { id: 'desc' }, take: 300 })
    return l.map(linha)
  }

  async decidir(u, id, { decisao, despacho = '' }) {
    exigir(u, 'despachar')
    if (!['deferido', 'indeferido'].includes(decisao)) throw invalido('Decida «deferido» ou «indeferido».', 'decisao')
    if (decisao === 'indeferido' && String(despacho).trim().length < 3) throw invalido('Ao indeferir, escreva o motivo no despacho.', 'despacho')
    const x = await this.bd.pedidoDespacho.findUnique({ where: { id } })
    if (!x) throw naoEncontrado('Pedido não encontrado.')
    if (x.estado !== 'pendente') throw conflito(`Este pedido já foi ${ESTADOS_PEDIDO[x.estado]?.toLowerCase() ?? x.estado}.`)
    if (decisao === 'deferido') await this.#deferir(x)
    else await this.#indeferir(x)
    const r = await this.bd.pedidoDespacho.update({ where: { id }, data: { estado: decisao, decididoPor: u.email, decididoEm: this.agora(), despacho: String(despacho).trim() }, include: COM })
    await this.auditoria.registar(u, decisao === 'deferido' ? 'deferir_pedido' : 'indeferir_pedido', `${TIPOS_PEDIDO[x.tipo]}: ${x.resumo}`)
    this.tempoReal?.avisar('pessoal', { tipo: 'despacho' })
    return linha(r)
  }

  async #deferir(x) {
    const d = x.dados ?? {}
    switch (x.tipo) {
      case 'docente_novo':
        await this.pessoas.aplicarDespacho(SISTEMA, x.pessoaId, { docentePendente: false })
        break
      case 'docente_categoria':
        await this.pessoas.aplicarDespacho(SISTEMA, x.pessoaId, { categoriaDocente: d.categoriaDocente ?? '' })
        break
      case 'docente_saida':
        await this.pessoas.aplicarDespacho(SISTEMA, x.pessoaId, d)
        break
      case 'utilizador_novo':
        await this.sessao.aplicarDespacho(x.utilizadorId, { ativo: true, aguardaDespacho: false })
        break
      case 'utilizador_papel':
        await this.sessao.aplicarDespacho(x.utilizadorId, { papel: d.papel })
        break
      default:
        throw invalido('Tipo de pedido desconhecido.')
    }
  }

  async #indeferir(x) {
    switch (x.tipo) {
      case 'docente_novo': {
        // registado só como docente: a ficha fica fora da Escola; juntado (já era da Escola): deixa só de ser docente
        const p = await this.bd.pessoa.findUnique({ where: { id: x.pessoaId } })
        if (!p) return
        if (p.vinculo === 'docente') await this.pessoas.aplicarDespacho(SISTEMA, p.id, { docentePendente: false, ativo: false, motivoSaida: 'Indeferido pelo Comandante' })
        else await this.pessoas.aplicarDespacho(SISTEMA, p.id, { docentePendente: false, outrosVinculos: (p.outrosVinculos ?? []).filter((v) => v !== 'docente') })
        break
      }
      case 'utilizador_novo':
        // a conta nunca chegou a entrar: apaga-se
        if (x.utilizadorId) await this.bd.utilizador.delete({ where: { id: x.utilizadorId } }).catch(() => {})
        break
      default:
        // mudança de categoria, saída e mudança de papel: fica tudo como estava
        break
    }
  }
}
