import { Conflito, ErroValidacao, NaoEncontrado } from '../../dominio/comum/erros.js'
import { exemplarEmprestavel } from '../../dominio/biblioteca/obra.js'
import { REGRAS_EMPRESTIMO, prazoPara, verificarLeitor } from '../../dominio/biblioteca/emprestimo.js'

const dia = (d) => new Date(d).toLocaleDateString('pt-PT', { timeZone: 'Africa/Luanda' })

/*
  Circulação: empréstimos ao balcão (código do exemplar + leitor), devoluções, renovações
  (no balcão ou pelo próprio leitor no portal) e aviso a quem está em atraso.
*/
export class ServicoCirculacao {
  constructor({ biblioteca, contas, notificacoes, auditoria, relogio }) {
    Object.assign(this, { biblioteca, contas, notificacoes, auditoria, relogio })
  }

  #comEstado(e, agora = this.relogio.agora(), tipoLeitor = e.leitor?.tipo) {
    return { ...e, ativo: e.ativo, emAtraso: e.emAtraso(agora), diasAtraso: e.diasAtraso(agora), podeRenovar: e.podeRenovar(agora, tipoLeitor) }
  }

  async #emprestimo(id) {
    const e = await this.biblioteca.emprestimo(id)
    if (!e) throw new NaoEncontrado('Empréstimo não encontrado.')
    return e
  }

  // ---------- balcão (painel) ----------

  async listar(ctx, { estado = 'ativos' } = {}) {
    ctx.actor.exigir('biblioteca.ver')
    const agora = this.relogio.agora()
    const l = estado === 'historico'
      ? await this.biblioteca.listarEmprestimos({ ativos: false, limite: 500 })
      : await this.biblioteca.listarEmprestimos({ ativos: true, ate: estado === 'atrasados' ? agora : null })
    return l.map((e) => this.#comEstado(e, agora))
  }

  // leitores (contas do portal) para escolher ao balcão, com o que têm emprestado
  async leitores(ctx, { q = '' } = {}) {
    ctx.actor.exigir('biblioteca.gerir')
    if (q.trim().length < 2) return []
    const l = (await this.contas.listar({ q: q.trim() })).slice(0, 15)
    const agora = this.relogio.agora()
    return Promise.all(l.map(async (c) => {
      const ativos = await this.biblioteca.ativosDoLeitor(c.id)
      return { id: c.id, nome: c.nome, numero: c.numero, tipo: c.tipo, ativo: c.ativo, emprestados: ativos.length, atrasados: ativos.filter((e) => e.emAtraso(agora)).length, maximo: REGRAS_EMPRESTIMO[c.tipo]?.maximo }
    }))
  }

  async leitor(ctx, contaId) {
    ctx.actor.exigir('biblioteca.ver')
    const c = await this.contas.porId(contaId)
    if (!c) throw new NaoEncontrado('Leitor não encontrado.')
    const agora = this.relogio.agora()
    return { id: c.id, nome: c.nome, numero: c.numero, tipo: c.tipo, email: c.email, emprestimos: (await this.biblioteca.doLeitor(c.id)).map((e) => this.#comEstado(e, agora, c.tipo)) }
  }

  async emprestar(ctx, { codigo, contaId }) {
    ctx.actor.exigir('biblioteca.gerir')
    if (!String(codigo || '').trim()) throw new ErroValidacao('Indique o código do exemplar.', { campo: 'codigo' })
    const x = await this.biblioteca.exemplarPorCodigo(codigo)
    if (!x) throw new NaoEncontrado(`Não há nenhum exemplar com o código ${String(codigo).trim().toUpperCase()}.`)
    if (!exemplarEmprestavel(x)) throw new Conflito(`O exemplar ${x.codigo} está marcado como ${x.estado}: não se empresta.`)
    if (x.emprestimos.length) throw new Conflito(`O exemplar ${x.codigo} já está emprestado.`)
    const conta = await this.contas.porId(contaId)
    if (!conta) throw new NaoEncontrado('Leitor não encontrado.')
    const agora = this.relogio.agora()
    verificarLeitor(conta, await this.biblioteca.ativosDoLeitor(conta.id), agora)
    const e = await this.biblioteca.emprestar({ exemplarId: x.id, contaId: conta.id, emprestadoEm: agora, prazo: prazoPara(conta.tipo, agora), registadoPor: ctx.actor.nome || '' })
    await this.auditoria.registar(ctx, { acao: 'emprestar_livro', colecao: 'biblioteca', alvoId: e.id, alvoTitulo: `${x.obra.titulo} → ${conta.nome}` })
    await this.notificacoes?.notificar([conta.id], { tipo: 'biblioteca', titulo: `Empréstimo: ${x.obra.titulo}`, texto: `Devolva até ${dia(e.prazo)}. Pode renovar no portal.`, ligacao: '/biblioteca/emprestimos' })
    return this.#comEstado(e, agora)
  }

  // devolução pelo código do exemplar (ou pelo id do empréstimo)
  async devolver(ctx, { codigo, id }) {
    ctx.actor.exigir('biblioteca.gerir')
    let emprestimoId = id
    if (!emprestimoId) {
      const x = codigo && (await this.biblioteca.exemplarPorCodigo(codigo))
      if (!x) throw new NaoEncontrado(`Não há nenhum exemplar com o código ${String(codigo || '').trim().toUpperCase()}.`)
      if (!x.emprestimos.length) throw new Conflito(`O exemplar ${x.codigo} não está emprestado.`)
      emprestimoId = x.emprestimos[0].id
    }
    const e = await this.#emprestimo(emprestimoId)
    const agora = this.relogio.agora()
    const atraso = e.diasAtraso(agora)
    const g = await this.biblioteca.devolver(e.id, agora)
    await this.auditoria.registar(ctx, { acao: 'devolver_livro', colecao: 'biblioteca', alvoId: e.id, alvoTitulo: `${e.exemplar.obra.titulo} ← ${e.leitor.nome}`, detalhes: atraso ? { diasAtraso: atraso } : undefined })
    return { ...this.#comEstado(g, agora), diasAtrasoNaDevolucao: atraso }
  }

  async renovar(ctx, id) {
    ctx.actor.exigir('biblioteca.gerir')
    const e = await this.#emprestimo(id)
    const agora = this.relogio.agora()
    return this.#comEstado(await this.biblioteca.renovar(e.id, e.renovar(agora, e.leitor.tipo)), agora)
  }

  // avisa no portal (e por e-mail, se o leitor quiser) quem está em atraso
  async avisarAtrasados(ctx) {
    ctx.actor.exigir('biblioteca.gerir')
    const agora = this.relogio.agora()
    const l = await this.biblioteca.listarEmprestimos({ ativos: true, ate: agora })
    const porLeitor = Map.groupBy(l, (e) => e.contaId)
    for (const [contaId, es] of porLeitor) {
      await this.notificacoes?.notificar([contaId], {
        tipo: 'biblioteca', titulo: `Biblioteca: ${es.length} livro(s) fora do prazo`,
        texto: `${es.map((e) => e.exemplar.obra.titulo).join('; ')}. Devolva na biblioteca o mais depressa possível.`, ligacao: '/biblioteca/emprestimos',
      })
    }
    await this.auditoria.registar(ctx, { acao: 'avisar_atrasos_biblioteca', colecao: 'biblioteca', alvoTitulo: `${porLeitor.size} leitor(es)` })
    return { leitores: porLeitor.size, emprestimos: l.length }
  }

  // ---------- portal (o próprio leitor) ----------

  async meus(ctx) {
    const agora = this.relogio.agora()
    const l = (await this.biblioteca.doLeitor(ctx.conta.id, { limite: 50 })).map((e) => this.#comEstado(e, agora, ctx.conta.tipo))
    return { regras: { ...REGRAS_EMPRESTIMO[ctx.conta.tipo], renovacoes: REGRAS_EMPRESTIMO.renovacoes }, ativos: l.filter((e) => e.ativo), historico: l.filter((e) => !e.ativo) }
  }

  async renovarMeu(ctx, id) {
    const e = await this.biblioteca.emprestimo(id)
    if (!e || e.contaId !== ctx.conta.id) throw new NaoEncontrado('Empréstimo não encontrado.')
    await this.biblioteca.renovar(e.id, e.renovar(this.relogio.agora(), ctx.conta.tipo))
    return this.meus(ctx)
  }
}
