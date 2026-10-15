import { Conflito, ErroValidacao, NaoEncontrado } from '../../dominio/comum/erros.js'
import {
  ACESSOS_DIGITAL, ESTADOS_EXEMPLAR, IDIOMAS, TIPOS_OBRA, dublinCore, exemplarEmprestavel, podeLerDigital, validarExemplar, validarObra,
} from '../../dominio/biblioteca/obra.js'
import { REGRAS_EMPRESTIMO } from '../../dominio/biblioteca/emprestimo.js'

/*
  Catálogo da biblioteca: o bibliotecário regista obras, exemplares e versões digitais;
  estudantes e docentes pesquisam no portal, veem o que está disponível e leem o digital.
*/
export class ServicoCatalogo {
  constructor({ biblioteca, academico, privados, auditoria, relogio, originalidade }) {
    Object.assign(this, { biblioteca, academico, privados, auditoria, relogio, originalidade })
  }

  async #obra(id) {
    const o = await this.biblioteca.obra(id)
    if (!o) throw new NaoEncontrado('Obra não encontrada.')
    return o
  }

  // guarda o PDF enviado como ficheiro privado; devolve o id (ou apaga-o e recusa)
  async #digital(ficheiro) {
    if (ficheiro.tipo !== 'application/pdf' || !this.privados.confirmarTipo(ficheiro.caminho, ficheiro.tipo)) {
      this.privados.apagar(ficheiro.caminho)
      throw new ErroValidacao('A versão digital tem de ser um PDF.', { campo: 'ficheiro' })
    }
    const id = ficheiro.caminho.split(/[\\/]/).pop().split('.')[0]
    await this.academico.criarFicheiro({ id, caminho: this.privados.relativo(ficheiro.caminho), nome: ficheiro.nome, tipo: ficheiro.tipo, tamanho: ficheiro.tamanho })
    return id
  }

  // ---------- painel (biblioteca) ----------

  async resumo(ctx) {
    ctx.actor.exigir('biblioteca.ver')
    return { ...(await this.biblioteca.resumo(this.relogio.agora())), tipos: TIPOS_OBRA, acessos: ACESSOS_DIGITAL, estados: ESTADOS_EXEMPLAR, idiomas: IDIOMAS, regras: REGRAS_EMPRESTIMO }
  }

  async listar(ctx, filtros = {}) {
    ctx.actor.exigir('biblioteca.ver')
    return this.biblioteca.pesquisarObras(filtros)
  }

  async obra(ctx, id) {
    ctx.actor.exigir('biblioteca.ver')
    return this.#obra(id)
  }

  async criar(ctx, dados, ficheiro = null) {
    try {
      ctx.actor.exigir('biblioteca.gerir')
      const limpo = validarObra(dados)
      if (ficheiro) limpo.ficheiroId = await this.#digital(ficheiro)
      const o = await this.biblioteca.criarObra(limpo)
      if (o.ficheiroId) this.originalidade?.obraMudou(o)
      await this.auditoria.registar(ctx, { acao: 'criar_obra', colecao: 'biblioteca', alvoId: o.id, alvoTitulo: o.titulo })
      return o
    } catch (e) {
      if (ficheiro) this.privados.apagar(ficheiro.caminho)
      throw e
    }
  }

  async atualizar(ctx, id, { removerDigital, ...dados }, ficheiro = null) {
    let o
    try {
      ctx.actor.exigir('biblioteca.gerir')
      o = await this.#obra(id)
    } catch (e) {
      if (ficheiro) this.privados.apagar(ficheiro.caminho)
      throw e
    }
    const mudanca = validarObra(dados, o)
    if (ficheiro) mudanca.ficheiroId = await this.#digital(ficheiro)
    else if (removerDigital === true || removerDigital === 'true') mudanca.ficheiroId = null
    const g = await this.biblioteca.guardarObra(o.id, mudanca)
    if (mudanca.ficheiroId !== undefined || mudanca.titulo !== undefined) this.originalidade?.obraMudou(g)
    await this.auditoria.registar(ctx, { acao: 'editar_obra', colecao: 'biblioteca', alvoId: o.id, alvoTitulo: g.titulo })
    return g
  }

  async apagar(ctx, id) {
    ctx.actor.exigir('biblioteca.gerir')
    const o = await this.#obra(id)
    if (await this.biblioteca.contarEmprestimosAtivosDaObra(o.id)) throw new Conflito('Há exemplares desta obra emprestados: registe primeiro a devolução.')
    await this.biblioteca.apagarObra(o.id)
    this.originalidade?.obraApagada(o.id)
    await this.auditoria.registar(ctx, { acao: 'apagar_obra', colecao: 'biblioteca', alvoId: o.id, alvoTitulo: o.titulo })
  }

  async adicionarExemplares(ctx, obraId, { quantidade = 1, ...dados }) {
    ctx.actor.exigir('biblioteca.gerir')
    const o = await this.#obra(obraId)
    const n = Number(quantidade)
    if (!Number.isInteger(n) || n < 1 || n > 50) throw new ErroValidacao('Quantidade: de 1 a 50 exemplares de cada vez.', { campo: 'quantidade' })
    if (dados.codigo && n > 1) throw new ErroValidacao('Com um código indicado, registe um exemplar de cada vez.', { campo: 'codigo' })
    for (let k = 0; k < n; k++) {
      const codigo = dados.codigo || (await this.biblioteca.proximoCodigo())
      await this.biblioteca.criarExemplar(o.id, validarExemplar({ ...dados, codigo }))
    }
    await this.auditoria.registar(ctx, { acao: 'adicionar_exemplares', colecao: 'biblioteca', alvoId: o.id, alvoTitulo: o.titulo, detalhes: { quantidade: n } })
    return this.#obra(o.id)
  }

  async editarExemplar(ctx, id, dados) {
    ctx.actor.exigir('biblioteca.gerir')
    const x = await this.biblioteca.exemplar(id)
    if (!x) throw new NaoEncontrado('Exemplar não encontrado.')
    const mudanca = validarExemplar(dados, x)
    if (x.emprestimos.length && mudanca.estado && !exemplarEmprestavel(mudanca) && mudanca.estado !== 'perdido') throw new Conflito('O exemplar está emprestado: registe primeiro a devolução.')
    await this.biblioteca.guardarExemplar(x.id, mudanca)
    return this.#obra(x.obraId)
  }

  async apagarExemplar(ctx, id) {
    ctx.actor.exigir('biblioteca.gerir')
    const x = await this.biblioteca.exemplar(id)
    if (!x) throw new NaoEncontrado('Exemplar não encontrado.')
    if (x.emprestimos.length) throw new Conflito('O exemplar está emprestado: registe primeiro a devolução.')
    await this.biblioteca.apagarExemplar(x.id)
    await this.auditoria.registar(ctx, { acao: 'apagar_exemplar', colecao: 'biblioteca', alvoId: x.obraId, alvoTitulo: `${x.codigo} — ${x.obra.titulo}` })
    return this.#obra(x.obraId)
  }

  async #ficheiro(o) {
    const f = o.ficheiroId && (await this.academico.ficheiro(o.ficheiroId))
    if (!f) throw new NaoEncontrado('Esta obra não tem versão digital.')
    return { caminho: this.privados.absoluto(f.caminho), nome: f.nome, tipo: f.tipo }
  }

  async digitalPainel(ctx, id) {
    ctx.actor.exigir('biblioteca.ver')
    return this.#ficheiro(await this.#obra(id))
  }

  // catálogo inteiro em Dublin Core (OAI-DC), para repositórios e catálogos coletivos
  async exportar(ctx) {
    ctx.actor.exigir('biblioteca.ver')
    const obras = await this.biblioteca.listarObras()
    return `<?xml version="1.0" encoding="UTF-8"?>\n<registos>\n${obras.map((o) => dublinCore(o)).join('\n')}\n</registos>\n`
  }

  // ---------- portal ----------

  // o que o leitor vê: sem quem tem o livro, só se está disponível e até quando
  #publica(o, conta) {
    const exemplares = o.exemplares.filter((x) => x.estado !== 'abatido' && x.estado !== 'perdido')
    const livres = exemplares.filter((x) => !x.emprestimo && exemplarEmprestavel(x)).length
    const proxima = exemplares.map((x) => x.emprestimo?.prazo).filter(Boolean).sort()[0] || null
    return {
      id: o.id, tipo: o.tipo, titulo: o.titulo, subtitulo: o.subtitulo, autores: o.autores, ano: o.ano, editora: o.editora, edicao: o.edicao, isbn: o.isbn,
      cota: o.cota, assuntos: o.assuntos, idioma: o.idioma, resumo: o.resumo, capa: o.capa, criadoEm: o.criadoEm,
      exemplares: exemplares.length, disponiveis: livres, devolucaoPrevista: livres ? null : proxima,
      localizacoes: [...new Set(exemplares.map((x) => x.localizacao).filter(Boolean))],
      digital: o.ficheiroId ? { podeLer: podeLerDigital(o, conta), acesso: o.acesso, tamanho: o.ficheiro?.tamanho ?? null } : null,
    }
  }

  async pesquisar(ctx, filtros = {}) {
    const l = await this.biblioteca.pesquisarObras({ ...filtros, limite: 200 })
    return { tipos: TIPOS_OBRA, idiomas: IDIOMAS, regras: REGRAS_EMPRESTIMO[ctx.conta.tipo], obras: l.map((o) => this.#publica(o, ctx.conta)) }
  }

  async obraPortal(ctx, id) {
    const o = await this.#obra(id)
    const [reserva, ativos] = await Promise.all([this.biblioteca.reservaAbertaDe(ctx.conta.id, o.id), this.biblioteca.ativosDoLeitor(ctx.conta.id)])
    const comigo = ativos.find((e) => e.exemplar.obra.id === o.id)
    return {
      ...this.#publica(o, ctx.conta), tipos: TIPOS_OBRA, idiomas: IDIOMAS,
      minhaReserva: reserva ? { id: reserva.id, estado: reserva.estado, levantarAte: reserva.levantarAte } : null,
      comigo: comigo ? { prazo: comigo.prazo } : null,
    }
  }

  async digitalPortal(ctx, id) {
    const o = await this.#obra(id)
    if (!podeLerDigital(o, ctx.conta)) throw new NaoEncontrado('Esta obra não tem versão digital disponível para si.')
    return this.#ficheiro(o)
  }
}
