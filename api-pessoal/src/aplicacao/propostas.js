import { invalido, naoEncontrado } from '../erros.js'
import { MODALIDADES, verificarGraduacao, verificarNomeacao, verificarPromocao } from '../dominio/pessoal/carreira.js'
import { verificarProgressaoCivil } from '../dominio/pessoal/civis.js'
import { POSTOS, nomeDoPosto } from '../dominio/pessoal/hierarquia.js'
import { exigir } from './sessao.js'

export const TIPOS_PROPOSTA = {
  promocao: { nome: 'Promoção', pessoal: 'militar' },
  graduacao: { nome: 'Graduação', pessoal: 'militar' },
  nomeacao: { nome: 'Nomeação', pessoal: 'ambos' },
  exoneracao: { nome: 'Exoneração', pessoal: 'ambos' },
  progressao: { nome: 'Progressão na carreira (civis)', pessoal: 'civil' },
}
export const ESTADOS_PROPOSTA = { rascunho: 'Em preparação', submetida: 'Submetida a despacho', aprovada: 'Aprovada', rejeitada: 'Rejeitada', cancelada: 'Cancelada' }
const INCLUIR = { itens: { include: { pessoa: { include: { cursos: true, eventos: true, graduacoes: true, cargo: true } } }, orderBy: { id: 'asc' } } }
const dia = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null)

export class ServicoPropostas {
  constructor({ bd, auditoria, agora = () => new Date() }) {
    Object.assign(this, { bd, auditoria, agora })
  }

  async #ocupados(cargoId) {
    return this.bd.pessoa.count({ where: { cargoId, ativo: true } })
  }

  // aplica as regras da lei a uma pessoa da proposta; devolve o item já preenchido
  async #verificar(tipo, p, item) {
    const hoje = this.agora()
    const def = TIPOS_PROPOSTA[tipo]
    if (def.pessoal !== 'ambos' && p.tipo !== def.pessoal) throw invalido(`${p.nome}: a ${def.nome.toLowerCase()} é só para pessoal ${def.pessoal}.`)
    if (!p.ativo) throw invalido(`${p.nome} já não serve na Escola.`)
    const base = { pessoaId: p.id, postoAtual: p.posto, categoriaAtual: p.categoriaCivil, justificacao: item.justificacao ?? '', inicio: item.inicio ? new Date(item.inicio) : null, fim: item.fim ? new Date(item.fim) : null }
    if (tipo === 'promocao') {
      if (item.modalidade && !MODALIDADES[item.modalidade]) throw invalido('Modalidade desconhecida.', 'modalidade')
      const v = verificarPromocao({ ...p, historico: p.eventos }, { hoje, modalidade: item.modalidade || undefined })
      if (!v.postoProposto) throw invalido(`${p.nome}: não há posto a que possa ser promovido.`)
      return { ...base, postoProposto: v.postoProposto, modalidade: v.modalidade, verificacao: v }
    }
    if (tipo === 'graduacao') {
      if (!POSTOS[item.postoProposto]) throw invalido('Indique o posto da graduação.', 'postoProposto')
      const v = verificarGraduacao(p, item.postoProposto, { hoje })
      return { ...base, postoProposto: item.postoProposto, verificacao: { elegivel: v.possivel, condicoes: v.condicoes } }
    }
    if (tipo === 'nomeacao') {
      const cargo = item.cargoId && await this.bd.cargo.findUnique({ where: { id: item.cargoId } })
      if (!cargo) throw invalido('Indique o cargo.', 'cargoId')
      const ocupados = (await this.#ocupados(cargo.id)) - (p.cargoId === cargo.id ? 1 : 0)
      const v = verificarNomeacao(p, { ...cargo, ocupados }, { hoje, fim: item.fim })
      if (p.cargoId === cargo.id) v.condicoes.push({ id: 'mesmo', texto: 'Ainda não ocupa este cargo', artigo: '—', estado: 'falta', detalhe: '' })
      return { ...base, cargoId: cargo.id, verificacao: { elegivel: v.condicoes.every((c) => c.estado !== 'falta'), condicoes: v.condicoes } }
    }
    if (tipo === 'exoneracao') {
      const condicoes = [{ id: 'cargo', texto: 'Ocupa um cargo', artigo: 'art. 18.º', estado: p.cargoId ? 'ok' : 'falta', detalhe: p.cargo?.nome ?? '' }]
      return { ...base, cargoId: p.cargoId, verificacao: { elegivel: Boolean(p.cargoId), condicoes } }
    }
    const v = verificarProgressaoCivil(p, { hoje })
    if (!v.categoriaProposta) throw invalido(`${p.nome}: não há categoria acima na carreira.`)
    return { ...base, categoriaProposta: v.categoriaProposta, verificacao: v }
  }

  #apresentar(pr) {
    const itens = pr.itens.map((i) => ({
      id: i.id, pessoaId: i.pessoaId, nome: i.pessoa.nome, nip: i.pessoa.nip, numeroAgente: i.pessoa.numeroAgente, ramo: i.pessoa.ramo,
      postoAtual: i.postoAtual, postoAtualNome: i.postoAtual ? nomeDoPosto(i.postoAtual, i.pessoa.ramo) : '',
      postoProposto: i.postoProposto, postoPropostoNome: i.postoProposto ? nomeDoPosto(i.postoProposto, i.pessoa.ramo) : '',
      modalidade: i.modalidade, modalidadeNome: MODALIDADES[i.modalidade] ?? '', cargoId: i.cargoId, categoriaAtual: i.categoriaAtual, categoriaProposta: i.categoriaProposta,
      inicio: dia(i.inicio), fim: dia(i.fim), justificacao: i.justificacao, verificacao: i.verificacao, cumpre: i.verificacao?.condicoes?.every((c) => c.estado !== 'falta') ?? false,
    }))
    const { itens: _, ...resto } = pr
    void _
    return { ...resto, dataDocumento: dia(pr.dataDocumento), tipoNome: TIPOS_PROPOSTA[pr.tipo]?.nome, estadoNome: ESTADOS_PROPOSTA[pr.estado], total: itens.length, naoCumprem: itens.filter((i) => !i.cumpre).length, itens }
  }

  async #obter(id) {
    const pr = await this.bd.proposta.findUnique({ where: { id }, include: INCLUIR })
    if (!pr) throw naoEncontrado('Proposta não encontrada.')
    return pr
  }

  async listar(u, { estado, tipo, pessoaId } = {}) {
    exigir(u, 'ver')
    const where = { ...(estado ? { estado } : {}), ...(tipo ? { tipo } : {}), ...(pessoaId ? { itens: { some: { pessoaId: Number(pessoaId) } } } : {}) }
    const l = await this.bd.proposta.findMany({ where, include: { _count: { select: { itens: true } } }, orderBy: { criadoEm: 'desc' } })
    return l.map(({ _count, ...p }) => ({ ...p, dataDocumento: dia(p.dataDocumento), tipoNome: TIPOS_PROPOSTA[p.tipo]?.nome, estadoNome: ESTADOS_PROPOSTA[p.estado], total: _count.itens }))
  }

  async obter(u, id) {
    exigir(u, 'ver')
    return this.#apresentar(await this.#obter(id))
  }

  async criar(u, { tipo, titulo, fundamentacao = '', itens = [] }) {
    exigir(u, 'propor')
    if (!TIPOS_PROPOSTA[tipo]) throw invalido('Tipo de proposta desconhecido.', 'tipo')
    const pr = await this.bd.proposta.create({ data: { tipo, titulo, fundamentacao, criadoPor: u.email } })
    for (const i of itens) await this.adicionarItem(u, pr.id, i, { silencioso: true })
    await this.auditoria.registar(u, 'criar_proposta', `${TIPOS_PROPOSTA[tipo].nome}: ${titulo} (#${pr.id})`, { pessoas: itens.length })
    return this.obter(u, pr.id)
  }

  async #emPreparacao(id) {
    const pr = await this.#obter(id)
    if (pr.estado !== 'rascunho') throw invalido('Só se altera uma proposta em preparação.')
    return pr
  }

  async editar(u, id, { titulo, fundamentacao }) {
    exigir(u, 'propor')
    await this.#emPreparacao(id)
    await this.bd.proposta.update({ where: { id }, data: { ...(titulo !== undefined ? { titulo } : {}), ...(fundamentacao !== undefined ? { fundamentacao } : {}) } })
    return this.obter(u, id)
  }

  async adicionarItem(u, id, item, { silencioso = false } = {}) {
    exigir(u, 'propor')
    const pr = await this.#emPreparacao(id)
    if (pr.itens.some((i) => i.pessoaId === item.pessoaId)) throw invalido('Essa pessoa já está na proposta.', 'pessoaId')
    const p = await this.bd.pessoa.findUnique({ where: { id: item.pessoaId }, include: { cursos: true, eventos: true, graduacoes: true, cargo: true } })
    if (!p) throw naoEncontrado('Ficha não encontrada.')
    const aberta = await this.bd.itemProposta.findFirst({ where: { pessoaId: p.id, proposta: { tipo: pr.tipo, estado: { in: ['rascunho', 'submetida'] } } }, include: { proposta: { select: { id: true, titulo: true } } } })
    if (aberta) throw invalido(`${p.nome} já está noutra proposta em curso (#${aberta.proposta.id} — ${aberta.proposta.titulo}).`, 'pessoaId')
    const dados = await this.#verificar(pr.tipo, p, item)
    await this.bd.itemProposta.create({ data: { ...dados, propostaId: id } })
    if (!silencioso) await this.auditoria.registar(u, 'adicionar_a_proposta', `#${id}: ${p.nome}`)
    return silencioso ? null : this.obter(u, id)
  }

  async removerItem(u, id, itemId) {
    exigir(u, 'propor')
    await this.#emPreparacao(id)
    const r = await this.bd.itemProposta.deleteMany({ where: { id: itemId, propostaId: id } })
    if (!r.count) throw naoEncontrado('Essa pessoa não está na proposta.')
    return this.obter(u, id)
  }

  // volta a aplicar a lei a todos (os dados podem ter mudado desde que a proposta foi feita)
  async #reverificar(pr) {
    for (const i of pr.itens) {
      const d = await this.#verificar(pr.tipo, i.pessoa, { ...i, inicio: dia(i.inicio), fim: dia(i.fim), modalidade: ['distincao', 'excepcional'].includes(i.modalidade) ? i.modalidade : undefined })
      await this.bd.itemProposta.update({ where: { id: i.id }, data: { verificacao: d.verificacao, postoAtual: d.postoAtual, categoriaAtual: d.categoriaAtual } })
    }
    const nova = await this.#obter(pr.id)
    const falham = this.#apresentar(nova).itens.filter((i) => !i.cumpre)
    if (falham.length) throw invalido(`Não cumprem as condições da lei: ${falham.map((i) => i.nome).join(', ')}. Retire-os da proposta ou corrija as fichas.`)
    return nova
  }

  async submeter(u, id) {
    exigir(u, 'propor')
    const pr = await this.#emPreparacao(id)
    if (!pr.itens.length) throw invalido('A proposta não tem ninguém.')
    await this.#reverificar(pr)
    await this.bd.proposta.update({ where: { id }, data: { estado: 'submetida', submetidaEm: this.agora() } })
    await this.auditoria.registar(u, 'submeter_proposta', `#${id}: ${pr.titulo}`)
    return this.obter(u, id)
  }

  // despacho favorável: atualiza as fichas e regista no histórico de cada um
  async aprovar(u, id, { documento, dataDocumento, entidade = '' }) {
    exigir(u, 'decidir')
    const pr = await this.#obter(id)
    if (pr.estado !== 'submetida') throw invalido('Só se decide uma proposta submetida.')
    const atual = await this.#reverificar(pr)
    const data = new Date(dataDocumento)
    const doc = { documento, entidade, propostaId: id, criadoPor: u.email }
    await this.bd.$transaction(async (tx) => {
      for (const i of atual.itens) {
        const p = i.pessoa
        if (pr.tipo === 'promocao') {
          await tx.pessoa.update({ where: { id: p.id }, data: { posto: i.postoProposto, dataAntiguidadePosto: data } })
          // a promoção ao posto da graduação (ou acima) faz cessar a graduação (art. 67.º)
          for (const g of p.graduacoes.filter((g) => g.ativa && POSTOS[g.posto].grau <= POSTOS[i.postoProposto].grau)) await tx.graduacao.update({ where: { id: g.id }, data: { ativa: false, fim: data } })
          await tx.evento.create({ data: { ...doc, pessoaId: p.id, tipo: 'promocao', data, postoAnterior: i.postoAtual, postoNovo: i.postoProposto, descricao: `Por ${(MODALIDADES[i.modalidade] ?? '').toLowerCase()}` } })
        } else if (pr.tipo === 'graduacao') {
          await tx.graduacao.create({ data: { pessoaId: p.id, posto: i.postoProposto, inicio: i.inicio ?? data, fim: i.fim, motivo: i.justificacao, propostaId: id } })
          await tx.evento.create({ data: { ...doc, pessoaId: p.id, tipo: 'graduacao', data: i.inicio ?? data, postoAnterior: p.posto, postoNovo: i.postoProposto, descricao: i.justificacao } })
        } else if (pr.tipo === 'nomeacao') {
          const cargo = await tx.cargo.findUnique({ where: { id: i.cargoId } })
          await tx.pessoa.update({ where: { id: p.id }, data: { cargoId: cargo.id, dataCargo: i.inicio ?? data, ...(cargo.unidadeId ? { unidadeId: cargo.unidadeId } : {}) } })
          if (p.cargo) await tx.evento.create({ data: { ...doc, pessoaId: p.id, tipo: 'exoneracao', data: i.inicio ?? data, cargoNome: p.cargo.nome, descricao: 'Por nomeação para outro cargo.' } })
          await tx.evento.create({ data: { ...doc, pessoaId: p.id, tipo: 'nomeacao', data: i.inicio ?? data, cargoNome: cargo.nome, descricao: i.fim ? `Até ${dia(i.fim)}` : '' } })
        } else if (pr.tipo === 'exoneracao') {
          await tx.pessoa.update({ where: { id: p.id }, data: { cargoId: null, dataCargo: null } })
          await tx.evento.create({ data: { ...doc, pessoaId: p.id, tipo: 'exoneracao', data: i.inicio ?? data, cargoNome: p.cargo?.nome ?? '', descricao: i.justificacao } })
        } else {
          await tx.pessoa.update({ where: { id: p.id }, data: { categoriaCivil: i.categoriaProposta, dataCategoria: data } })
          await tx.evento.create({ data: { ...doc, pessoaId: p.id, tipo: 'progressao', data, descricao: `${i.categoriaAtual} → ${i.categoriaProposta}` } })
        }
      }
      await tx.proposta.update({ where: { id }, data: { estado: 'aprovada', documento, dataDocumento: data, entidade, decididoPor: u.email, decididaEm: this.agora() } })
    })
    await this.auditoria.registar(u, 'aprovar_proposta', `#${id}: ${pr.titulo}`, { documento, pessoas: atual.itens.length })
    return this.obter(u, id)
  }

  async rejeitar(u, id, { motivo }) {
    exigir(u, 'decidir')
    const pr = await this.#obter(id)
    if (pr.estado !== 'submetida') throw invalido('Só se decide uma proposta submetida.')
    await this.bd.proposta.update({ where: { id }, data: { estado: 'rejeitada', motivo, decididoPor: u.email, decididaEm: this.agora() } })
    await this.auditoria.registar(u, 'rejeitar_proposta', `#${id}: ${pr.titulo}`, { motivo })
    return this.obter(u, id)
  }

  // quem a preparou pode cancelá-la enquanto não tem despacho; volta à preparação se for devolvida
  async cancelar(u, id, { motivo = '' }) {
    exigir(u, 'propor')
    const pr = await this.#obter(id)
    if (!['rascunho', 'submetida'].includes(pr.estado)) throw invalido('Esta proposta já foi decidida.')
    await this.bd.proposta.update({ where: { id }, data: { estado: 'cancelada', motivo } })
    await this.auditoria.registar(u, 'cancelar_proposta', `#${id}: ${pr.titulo}`)
    return this.obter(u, id)
  }

  async devolver(u, id, { motivo = '' }) {
    exigir(u, 'decidir')
    const pr = await this.#obter(id)
    if (pr.estado !== 'submetida') throw invalido('Só se devolve uma proposta submetida.')
    await this.bd.proposta.update({ where: { id }, data: { estado: 'rascunho', motivo } })
    await this.auditoria.registar(u, 'devolver_proposta', `#${id}: ${pr.titulo}`, { motivo })
    return this.obter(u, id)
  }
}
