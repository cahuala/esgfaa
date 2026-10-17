import { invalido, naoEncontrado } from '../erros.js'
import { exigir } from './sessao.js'

export const TIPOS_PEDIDO = { rectificacao: 'Rectificação (corrigir dados)', acesso: 'Acesso aos meus dados', oposicao: 'Oposição a um tratamento', eliminacao: 'Eliminação de dados', outro: 'Outro assunto sobre dados pessoais' }
const MES = 30 * 86_400_000

/*
  Protecção de dados pessoais no sistema interno (Lei n.º 22/11): aviso na primeira entrada, cada pessoa
  descarrega a sua ficha e faz pedidos (respondidos pela Repartição de Pessoal e Quadros) e prazos de
  conservação do registo de auditoria. As fichas e os processos individuais fazem parte do arquivo e ficam.
*/
export class ServicoPrivacidade {
  constructor({ bd, pessoas, auditoria, agora = () => new Date(), conservacao = { auditoria: 120, recusados: 12 } }) {
    Object.assign(this, { bd, pessoas, auditoria, agora, conservacao })
  }

  aviso(u) {
    return { conhecimentoEm: u.privacidadeEm ?? null }
  }

  async aceitar(u) {
    const g = await this.bd.utilizador.update({ where: { id: u.id }, data: { privacidadeEm: this.agora() } })
    return { conhecimentoEm: g.privacidadeEm }
  }

  #pessoa(u) {
    if (!u.pessoaId) throw invalido('A sua conta não está ligada a uma ficha de pessoal.')
    return u.pessoaId
  }

  // direito de acesso: a ficha completa da própria pessoa (sem o que é de outras pessoas)
  async meusDados(u) {
    const id = this.#pessoa(u)
    const ficha = await this.pessoas.perfil(u, id)
    const pedidos = await this.bd.pedidoDados.findMany({ where: { pessoaId: id } })
    await this.auditoria.registar(u, 'exportar_meus_dados', `ficha #${id}`)
    return { geradoEm: this.agora().toISOString(), aviso: 'Dados pessoais da sua ficha no Sistema de Gestão de Pessoal da Escola Superior de Guerra (Lei n.º 22/11, direito de acesso).', ficha, pedidosSobreDados: pedidos }
  }

  async pedir(u, { tipo, texto }) {
    const pessoaId = this.#pessoa(u)
    if (!TIPOS_PEDIDO[tipo]) throw invalido('Tipo de pedido desconhecido.', 'tipo')
    const t = String(texto ?? '').trim()
    if (t.length < 5) throw invalido('Diga o que pretende.', 'texto')
    const p = await this.bd.pedidoDados.create({ data: { pessoaId, tipo, texto: t.slice(0, 3000) } })
    await this.auditoria.registar(u, 'pedido_dados', TIPOS_PEDIDO[tipo])
    return p
  }

  meusPedidos(u) {
    if (!u.pessoaId) return []
    return this.bd.pedidoDados.findMany({ where: { pessoaId: u.pessoaId }, orderBy: { criadoEm: 'desc' } })
  }

  async listar(u) {
    exigir(u, 'editar')
    const l = await this.bd.pedidoDados.findMany({ include: { pessoa: { select: { id: true, nome: true, nip: true, numeroAgente: true, fotoId: true } } }, orderBy: [{ estado: 'asc' }, { criadoEm: 'desc' }] })
    return l.map((x) => ({ ...x, tipoNome: TIPOS_PEDIDO[x.tipo] ?? x.tipo }))
  }

  async responder(u, id, { estado, resposta }) {
    exigir(u, 'editar')
    if (!['respondido', 'recusado'].includes(estado)) throw invalido('Estado inválido.', 'estado')
    if (String(resposta ?? '').trim().length < 3) throw invalido('Escreva a resposta.', 'resposta')
    const p = await this.bd.pedidoDados.findUnique({ where: { id } })
    if (!p) throw naoEncontrado('Pedido não encontrado.')
    const r = await this.bd.pedidoDados.update({ where: { id }, data: { estado, resposta: String(resposta).trim().slice(0, 3000), respondidoPor: u.email, respondidoEm: this.agora() } })
    await this.auditoria.registar(u, 'responder_pedido_dados', `#${id} (ficha #${p.pessoaId})`)
    return r
  }

  // auditoria: entradas antigas apagam-se (10 anos por omissão; os acessos recusados de fora da rede, 12 meses)
  async aplicarConservacao() {
    const agora = this.agora().getTime()
    const auditoria = (await this.bd.auditoria.deleteMany({ where: { quando: { lt: new Date(agora - this.conservacao.auditoria * MES) } } })).count
    const recusados = (await this.bd.auditoria.deleteMany({ where: { acao: 'acesso_recusado', quando: { lt: new Date(agora - this.conservacao.recusados * MES) } } })).count
    return { auditoria, recusados }
  }
}
