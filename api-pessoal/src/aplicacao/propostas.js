import { invalido, naoEncontrado } from '../erros.js'
import { MODALIDADES, verificarGraduacao, verificarNomeacao, verificarPromocao } from '../dominio/pessoal/carreira.js'
import { verificarProgressaoCivil } from '../dominio/pessoal/civis.js'
import { POSTOS, nomeDoPosto } from '../dominio/pessoal/hierarquia.js'
import { exigir } from './sessao.js'
import { comparadorHierarquico } from '../dominio/pessoal/ordem.js'
import { posicoesUnidades } from './ordem.js'

export const TIPOS_PROPOSTA = {
  promocao: { nome: 'Promoção', pessoal: 'militar' },
  graduacao: { nome: 'Graduação', pessoal: 'militar' },
  nomeacao: { nome: 'Nomeação', pessoal: 'ambos' },
  exoneracao: { nome: 'Exoneração', pessoal: 'ambos' },
  progressao: { nome: 'Progressão na carreira (civis)', pessoal: 'civil' },
  curso: { nome: 'Nomeação para curso', pessoal: 'ambos' },
}
/*
  A Escola não faz despachos: prepara a proposta (com a ficha de proposta e a síntese biográfica de cada um),
  envia-a ao escalão superior e, quando chega o extracto, regista-o (Extractos) — é o extracto que muda as fichas.
*/
export const ESTADOS_PROPOSTA = { rascunho: 'Em preparação', enviada: 'Enviada ao escalão superior', concluida: 'Concluída (extracto recebido)', indeferida: 'Indeferida', cancelada: 'Cancelada' }
export const ABERTAS = ['rascunho', 'enviada']
const INCLUIR = { itens: { include: { pessoa: { include: { cursos: true, eventos: true, graduacoes: true, cargo: true } } }, orderBy: { id: 'asc' } } }
const dia = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null)
const sem = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

export class ServicoPropostas {
  constructor({ bd, auditoria, agora = () => new Date() }) {
    Object.assign(this, { bd, auditoria, agora })
  }

  // aplica as regras da lei a uma pessoa da proposta; devolve o item já preenchido
  // outros: as restantes pessoas da mesma proposta ({ pessoaId, cargoId }), para a regra dos cargos ocupados
  async #verificar(tipo, p, item, outros = []) {
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
      /*
        Um cargo ocupado só se pode propor se quem lá está também entrar nesta proposta,
        nomeado para outro cargo. Contam-se os que ficam no cargo e os outros desta proposta propostos para ele.
      */
      const ocupantes = await this.bd.pessoa.findMany({ where: { cargoId: cargo.id, ativo: true, id: { not: p.id } }, select: { id: true, nome: true, posto: true, ramo: true } })
      const saem = new Set(outros.filter((o) => o.cargoId && o.cargoId !== cargo.id).map((o) => o.pessoaId))
      const ficam = ocupantes.filter((o) => !saem.has(o.id))
      const entram = outros.filter((o) => o.cargoId === cargo.id && o.pessoaId !== p.id).length
      const ocupados = ficam.length + entram
      const v = verificarNomeacao(p, { ...cargo, ocupados }, { hoje, fim: item.fim })
      const vaga = v.condicoes.find((c) => c.id === 'vagas')
      if (vaga && ficam.length) {
        vaga.texto = 'O cargo fica livre nesta proposta'
        vaga.detalhe = `Ocupado por ${ficam.map((o) => `${o.posto ? `${nomeDoPosto(o.posto, o.ramo)} ` : ''}${o.nome}`).join(', ')}: tem de entrar nesta proposta, nomeado(a) para outro cargo.`
      }
      if (p.cargoId === cargo.id) v.condicoes.push({ id: 'mesmo', texto: 'Ainda não ocupa este cargo', artigo: '—', estado: 'falta', detalhe: '' })
      return { ...base, cargoId: cargo.id, verificacao: { elegivel: v.condicoes.every((c) => c.estado !== 'falta'), condicoes: v.condicoes } }
    }
    if (tipo === 'curso') {
      // não se propõe para um curso que já fez (mesmo nome, com aproveitamento ou ainda sem resultado)
      const curso = sem(item.curso)
      const feito = curso && (p.cursos ?? []).find((c) => sem(c.nome) === curso && c.aproveitamento !== false)
      const condicoes = [{ id: 'curso', texto: 'Ainda não fez este curso', artigo: '—', estado: feito ? 'falta' : 'ok', detalhe: feito ? `${feito.nome}${feito.fim ? ` (${dia(feito.fim)})` : ''}` : '' }]
      return { ...base, verificacao: { elegivel: !feito, condicoes } }
    }
    if (tipo === 'exoneracao') {
      const condicoes = [{ id: 'cargo', texto: 'Ocupa um cargo', artigo: 'art. 18.º', estado: p.cargoId ? 'ok' : 'falta', detalhe: p.cargo?.nome ?? '' }]
      return { ...base, cargoId: p.cargoId, verificacao: { elegivel: Boolean(p.cargoId), condicoes } }
    }
    const v = verificarProgressaoCivil(p, { hoje })
    if (!v.categoriaProposta) throw invalido(`${p.nome}: não há categoria acima na carreira.`)
    return { ...base, categoriaProposta: v.categoriaProposta, verificacao: v }
  }

  // ordem dos militares na proposta e nos documentos: a regra hierárquica de todas as listas (dominio/pessoal/ordem.js)
  async #ordenar(pr) {
    const cmp = comparadorHierarquico(await posicoesUnidades(this.bd))
    const como = (i) => ({ ...i.pessoa, posto: i.postoAtual || i.pessoa.posto })
    pr.itens.sort((a, b) => cmp(como(a), como(b)))
    return pr
  }

  #apresentar(pr) {
    const itens = pr.itens.map((i) => ({
      id: i.id, pessoaId: i.pessoaId, nome: i.pessoa.nome, fotoId: i.pessoa.fotoId, nip: i.pessoa.nip, numeroAgente: i.pessoa.numeroAgente, ramo: i.pessoa.ramo,
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

  // todas as pessoas propostas (para as listas impressas): uma linha por pessoa e proposta
  async itens(u, { tipo, estado } = {}) {
    exigir(u, 'ver')
    const where = { proposta: { ...(tipo ? { tipo } : {}), estado: estado ? estado : { in: ABERTAS } } }
    const l = await this.bd.itemProposta.findMany({
      where, orderBy: [{ propostaId: 'desc' }, { id: 'asc' }],
      include: { proposta: true, pessoa: { include: { unidade: { select: { nome: true } }, cargo: { select: { nome: true, funcao: true } } } } },
    })
    // pela ordem hierárquica (o posto da proposta, a unidade, a função, a antiguidade)
    const cmp = comparadorHierarquico(await posicoesUnidades(this.bd))
    l.sort((a, b) => cmp({ ...a.pessoa, posto: a.postoAtual || a.pessoa.posto }, { ...b.pessoa, posto: b.postoAtual || b.pessoa.posto }))
    const cargos = new Map((await this.bd.cargo.findMany({ where: { id: { in: [...new Set(l.map((i) => i.cargoId).filter(Boolean))] } }, select: { id: true, nome: true } })).map((c) => [c.id, c.nome]))
    return l.map((i, k) => ({
      hierarquia: k + 1,
      propostaId: i.propostaId, titulo: i.proposta.titulo, tipo: i.proposta.tipo, tipoNome: TIPOS_PROPOSTA[i.proposta.tipo]?.nome, estado: i.proposta.estado, estadoNome: ESTADOS_PROPOSTA[i.proposta.estado], curso: i.proposta.curso,
      pessoaId: i.pessoaId, nome: i.pessoa.nome, tipoPessoa: i.pessoa.tipo, nip: i.pessoa.nip, numeroAgente: i.pessoa.numeroAgente, ramo: i.pessoa.ramo, genero: i.pessoa.genero,
      postoAtualNome: i.postoAtual ? nomeDoPosto(i.postoAtual, i.pessoa.ramo) : '', grau: POSTOS[i.postoAtual]?.grau ?? 0, postoPropostoNome: i.postoProposto ? nomeDoPosto(i.postoProposto, i.pessoa.ramo) : '',
      categoriaAtual: i.categoriaAtual, categoriaProposta: i.categoriaProposta, cargoPropostoNome: cargos.get(i.cargoId) ?? '',
      unidadeNome: i.pessoa.unidade?.nome ?? '', cargoAtualNome: i.pessoa.cargo?.nome ?? '', inicio: dia(i.inicio), fim: dia(i.fim),
      cumpre: i.verificacao?.condicoes?.every((c) => c.estado !== 'falta') ?? false,
    }))
  }

  async obter(u, id) {
    exigir(u, 'ver')
    return this.#apresentar(await this.#ordenar(await this.#obter(id)))
  }

  async criar(u, { tipo, titulo, fundamentacao = '', curso = '', itens = [] }) {
    exigir(u, 'propor')
    if (!TIPOS_PROPOSTA[tipo]) throw invalido('Tipo de proposta desconhecido.', 'tipo')
    if (tipo === 'curso' && !curso.trim()) throw invalido('Indique o curso.', 'curso')
    const pr = await this.bd.proposta.create({ data: { tipo, titulo, fundamentacao, curso: tipo === 'curso' ? curso.trim() : '', criadoPor: u.email } })
    for (const i of itens) await this.adicionarItem(u, pr.id, i, { silencioso: true, semActualizar: true })
    await this.#actualizar(pr.id)
    await this.auditoria.registar(u, 'criar_proposta', `${TIPOS_PROPOSTA[tipo].nome}: ${titulo} (#${pr.id})`, { pessoas: itens.length })
    return this.obter(u, pr.id)
  }

  async #emPreparacao(id) {
    const pr = await this.#obter(id)
    if (pr.estado !== 'rascunho') throw invalido('Só se altera uma proposta em preparação.')
    return pr
  }

  async editar(u, id, { titulo, fundamentacao, curso }) {
    exigir(u, 'propor')
    const pr = await this.#emPreparacao(id)
    if (curso !== undefined && pr.tipo === 'curso' && !curso.trim()) throw invalido('Indique o curso.', 'curso')
    await this.bd.proposta.update({ where: { id }, data: { ...(titulo !== undefined ? { titulo } : {}), ...(fundamentacao !== undefined ? { fundamentacao } : {}), ...(curso !== undefined && pr.tipo === 'curso' ? { curso: curso.trim() } : {}) } })
    if (curso !== undefined) await this.#actualizar(id)
    return this.obter(u, id)
  }

  async adicionarItem(u, id, item, { silencioso = false, semActualizar = false } = {}) {
    exigir(u, 'propor')
    const pr = await this.#emPreparacao(id)
    if (pr.itens.some((i) => i.pessoaId === item.pessoaId)) throw invalido('Essa pessoa já está na proposta.', 'pessoaId')
    const p = await this.bd.pessoa.findUnique({ where: { id: item.pessoaId }, include: { cursos: true, eventos: true, graduacoes: true, cargo: true } })
    if (!p) throw naoEncontrado('Ficha não encontrada.')
    const aberta = await this.bd.itemProposta.findFirst({ where: { pessoaId: p.id, proposta: { tipo: pr.tipo, estado: { in: ABERTAS } } }, include: { proposta: { select: { id: true, titulo: true } } } })
    if (aberta) throw invalido(`${p.nome} já está noutra proposta em curso (#${aberta.proposta.id} — ${aberta.proposta.titulo}).`, 'pessoaId')
    const dados = await this.#verificar(pr.tipo, p, { ...item, curso: pr.curso }, pr.itens.map((i) => ({ pessoaId: i.pessoaId, cargoId: i.cargoId })))
    await this.bd.itemProposta.create({ data: { ...dados, propostaId: id } })
    if (!semActualizar) await this.#actualizar(id)
    if (!silencioso) await this.auditoria.registar(u, 'adicionar_a_proposta', `#${id}: ${p.nome}`)
    return silencioso ? null : this.obter(u, id)
  }

  async removerItem(u, id, itemId) {
    exigir(u, 'propor')
    await this.#emPreparacao(id)
    const r = await this.bd.itemProposta.deleteMany({ where: { id: itemId, propostaId: id } })
    if (!r.count) throw naoEncontrado('Essa pessoa não está na proposta.')
    await this.#actualizar(id)
    return this.obter(u, id)
  }

  // muda o que se propõe a uma pessoa (o cargo, o posto da graduação, as datas…)
  async editarItem(u, id, itemId, dados) {
    exigir(u, 'propor')
    const pr = await this.#emPreparacao(id)
    const i = pr.itens.find((x) => x.id === itemId)
    if (!i) throw naoEncontrado('Essa pessoa não está na proposta.')
    const outros = pr.itens.filter((x) => x.id !== itemId).map((x) => ({ pessoaId: x.pessoaId, cargoId: x.cargoId }))
    const d = await this.#verificar(pr.tipo, i.pessoa, { ...i, inicio: dia(i.inicio), fim: dia(i.fim), ...dados, curso: pr.curso }, outros)
    await this.bd.itemProposta.update({ where: { id: itemId }, data: d })
    await this.#actualizar(id)
    return this.obter(u, id)
  }

  // volta a verificar todos sem falhar (uns dependem dos outros: quem sai de um cargo liberta-o)
  async #actualizar(id) {
    const pr = await this.#obter(id)
    for (const i of pr.itens) {
      const outros = pr.itens.filter((x) => x.id !== i.id).map((x) => ({ pessoaId: x.pessoaId, cargoId: x.cargoId }))
      try {
        const d = await this.#verificar(pr.tipo, i.pessoa, { ...i, inicio: dia(i.inicio), fim: dia(i.fim), curso: pr.curso, modalidade: ['distincao', 'excepcional'].includes(i.modalidade) ? i.modalidade : undefined }, outros)
        await this.bd.itemProposta.update({ where: { id: i.id }, data: { verificacao: d.verificacao } })
      } catch {
        // ficha alterada entretanto: a submissão mostra o erro
      }
    }
  }

  // volta a aplicar a lei a todos (os dados podem ter mudado desde que a proposta foi feita)
  async #reverificar(pr) {
    for (const i of pr.itens) {
      const outros = pr.itens.filter((x) => x.id !== i.id).map((x) => ({ pessoaId: x.pessoaId, cargoId: x.cargoId }))
      const d = await this.#verificar(pr.tipo, i.pessoa, { ...i, inicio: dia(i.inicio), fim: dia(i.fim), curso: pr.curso, modalidade: ['distincao', 'excepcional'].includes(i.modalidade) ? i.modalidade : undefined }, outros)
      await this.bd.itemProposta.update({ where: { id: i.id }, data: { verificacao: d.verificacao, postoAtual: d.postoAtual, categoriaAtual: d.categoriaAtual } })
    }
    const nova = await this.#obter(pr.id)
    const falham = this.#apresentar(nova).itens.filter((i) => !i.cumpre)
    if (falham.length) throw invalido(`Não cumprem as condições da lei: ${falham.map((i) => i.nome).join(', ')}. Retire-os da proposta ou corrija as fichas.`)
    return nova
  }

  // enviada ao escalão superior (com as fichas de proposta impressas): fica à espera do extracto
  async submeter(u, id, { documento = '' } = {}) {
    exigir(u, 'propor')
    const pr = await this.#emPreparacao(id)
    if (!pr.itens.length) throw invalido('A proposta não tem ninguém.')
    await this.#reverificar(pr)
    await this.bd.proposta.update({ where: { id }, data: { estado: 'enviada', submetidaEm: this.agora(), ...(documento ? { documento } : {}) } })
    await this.auditoria.registar(u, 'enviar_proposta', `#${id}: ${pr.titulo}`)
    return this.obter(u, id)
  }

  // o escalão superior respondeu que não (fica o motivo e o documento da resposta)
  async indeferir(u, id, { motivo, documento = '', dataDocumento = null }) {
    exigir(u, 'decidir')
    const pr = await this.#obter(id)
    if (pr.estado !== 'enviada') throw invalido('Só se regista a resposta de uma proposta enviada.')
    await this.bd.proposta.update({ where: { id }, data: { estado: 'indeferida', motivo, documento, dataDocumento: dataDocumento ? new Date(dataDocumento) : null, decididoPor: u.email, decididaEm: this.agora() } })
    await this.auditoria.registar(u, 'indeferir_proposta', `#${id}: ${pr.titulo}`, { motivo })
    return this.obter(u, id)
  }

  // quem a preparou pode cancelá-la enquanto não tem resposta
  async cancelar(u, id, { motivo = '' }) {
    exigir(u, 'propor')
    const pr = await this.#obter(id)
    if (!ABERTAS.includes(pr.estado)) throw invalido('Esta proposta já teve resposta.')
    await this.bd.proposta.update({ where: { id }, data: { estado: 'cancelada', motivo } })
    await this.auditoria.registar(u, 'cancelar_proposta', `#${id}: ${pr.titulo}`)
    return this.obter(u, id)
  }

  async devolver(u, id, { motivo = '' }) {
    exigir(u, 'decidir')
    const pr = await this.#obter(id)
    if (pr.estado !== 'enviada') throw invalido('Só volta à preparação uma proposta enviada (ex.: devolvida para correção).')
    await this.bd.proposta.update({ where: { id }, data: { estado: 'rascunho', motivo } })
    await this.auditoria.registar(u, 'devolver_proposta', `#${id}: ${pr.titulo}`, { motivo })
    return this.obter(u, id)
  }
}
