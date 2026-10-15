import { ErroValidacao, NaoEncontrado, SemPermissao } from '../../dominio/comum/erros.js'
import { limparTexto } from '../../dominio/comum/texto.js'
import { MINIMO_PALAVRAS, comparar, impressoes, nivelDe, tokenizar } from '../../dominio/integridade/semelhanca.js'

export const ORIGENS = { entrega: 'Trabalho entregue', biblioteca: 'Biblioteca digital', repositorio: 'Repositório de referência', verificacao: 'Verificação avulsa' }
const PADRAO = { excluirCitacoes: true, excluirReferencias: true }
const FORMATOS = 'PDF ou Word (.docx)'

/*
  Integridade académica (anti-plágio): cada trabalho entregue, obra digital da biblioteca e documento
  de referência fica indexado; os trabalhos entregues (e os documentos verificados à parte) são comparados
  com tudo o resto. As análises correm em fila, uma de cada vez, sem atrasar quem entrega.
*/
export class ServicoOriginalidade {
  #fila = Promise.resolve()

  constructor({ integridade, academico, contas, biblioteca, privados, extrair, apoio, auditoria, relogio, registarErro }) {
    Object.assign(this, { integridade, academico, contas, biblioteca, privados, extrair, apoio, auditoria, relogio, registarErro })
  }

  #agendar(nome, f) {
    const p = this.#fila.then(f).catch((e) => this.registarErro?.({ nivel: 'erro', mensagem: `Integridade: ${nome}`, erro: e.message }))
    this.#fila = p
    return p
  }

  // espera que a fila acabe (testes e encerramento)
  esvaziar() {
    return this.#fila
  }

  // análises que ficaram a meio (servidor reiniciado)
  async retomar() {
    for (const id of await this.integridade.pendentes()) this.#agendar('retomar', () => this.#analisar(id))
  }

  async #textoDosFicheiros(ids) {
    const partes = []
    for (const id of ids) {
      const f = await this.academico.ficheiro(id)
      if (f) partes.push(await this.extrair(this.privados.absoluto(f.caminho), f.tipo).catch(() => ''))
    }
    return partes.filter(Boolean).join('\n\n')
  }

  #indexar({ texto, fonte = true, ...dados }) {
    const tokens = tokenizar(texto)
    return this.integridade.gravarDocumento({ ...dados, texto, fonte, palavras: tokens.length, impressoes: fonte ? impressoes(tokens) : [] })
  }

  async #pedir(documentoId, opcoes = {}) {
    const a = await this.integridade.criarAnalise(documentoId, { ...PADRAO, ...opcoes })
    this.#agendar('análise', () => this.#analisar(a.id))
    return a
  }

  async #analisar(id) {
    const a = await this.integridade.analise(id)
    if (!a || a.estado !== 'pendente') return
    const doc = a.documento
    const tokens = tokenizar(doc.texto, a.opcoes)
    if (tokens.length < MINIMO_PALAVRAS) {
      await this.integridade.concluirAnalise(id, {
        estado: 'erro', concluidaEm: this.relogio.agora(),
        erro: doc.texto.trim() ? 'O documento tem pouco texto para comparar.' : 'Não foi possível ler texto do documento (pode ser uma digitalização em imagem).',
      })
      return
    }
    const ids = await this.integridade.candidatos(impressoes(tokens).map((x) => x.h), doc.id)
    const docs = await this.integridade.documentosComTexto(ids)
    const r = comparar({ texto: doc.texto, tokens }, docs.map((f) => ({ id: f.id, texto: f.texto, tokens: tokenizar(f.texto) })))
    const info = Object.fromEntries(docs.map((f) => [f.id, { titulo: f.titulo, autor: f.autor, origem: f.origem, contexto: f.contexto }]))
    await this.integridade.concluirAnalise(id, {
      estado: 'concluida', percentagem: r.percentagem, concluidaEm: this.relogio.agora(),
      fontes: r.fontes.map((f) => ({ ...f, ...info[f.id] })), trechos: r.trechos,
    })
  }

  // ---------- ligações a outros contextos ----------

  // um trabalho foi entregue (ou substituído): indexa e analisa, sem atrasar a entrega
  entregaFeita(entregaId) {
    return this.#agendar('entrega', async () => {
      const e = await this.academico.entrega(entregaId)
      if (!e) return
      const [t, estudante] = await Promise.all([this.academico.trabalho(e.trabalhoId), this.contas.porId(e.estudanteId)])
      const cadeira = t && (await this.academico.cadeira(t.cadeiraId))
      const texto = [e.texto, await this.#textoDosFicheiros(e.ficheiros.map((f) => f.id))].filter(Boolean).join('\n\n')
      const d = await this.#indexar({
        origem: 'entrega', origemId: e.id, titulo: t?.titulo || 'Trabalho', autor: estudante?.nome || '', texto,
        contexto: [cadeira && `${cadeira.codigo} ${cadeira.nome}`].filter(Boolean).join(' · '),
      })
      const a = await this.integridade.criarAnalise(d.id, PADRAO)
      await this.#analisar(a.id)
    })
  }

  // obra da biblioteca com (ou sem) versão digital
  obraMudou(obra) {
    return this.#agendar('biblioteca', async () => {
      const f = obra?.ficheiroId && (await this.academico.ficheiro(obra.ficheiroId))
      if (!f) {
        if (obra) await this.integridade.apagarDocumentoDe('biblioteca', obra.id)
        return
      }
      const texto = await this.extrair(this.privados.absoluto(f.caminho), f.tipo).catch(() => '')
      await this.#indexar({ origem: 'biblioteca', origemId: obra.id, titulo: obra.titulo, autor: obra.autores.join('; '), contexto: `Biblioteca${obra.cota ? ` · ${obra.cota}` : ''}`, texto })
    })
  }

  obraApagada(obraId) {
    return this.#agendar('biblioteca', () => this.integridade.apagarDocumentoDe('biblioteca', obraId))
  }

  // ---------- comum ----------

  // lê o ficheiro enviado (que não fica guardado: só o texto)
  async #lerEnviado(ficheiro) {
    if (!ficheiro) throw new ErroValidacao(`Escolha o documento (${FORMATOS}).`, { campo: 'ficheiro' })
    try {
      if (!this.privados.confirmarTipo(ficheiro.caminho, ficheiro.tipo)) throw new ErroValidacao('O ficheiro não corresponde ao tipo indicado.', { campo: 'ficheiro' })
      const texto = await this.extrair(ficheiro.caminho, ficheiro.tipo).catch(() => '')
      if (!texto) throw new ErroValidacao(`Não foi possível ler texto deste ficheiro. Use ${FORMATOS} com texto (não uma digitalização).`, { campo: 'ficheiro' })
      return texto
    } finally {
      this.privados.apagar(ficheiro.caminho)
    }
  }

  #dados({ titulo, autor }, ficheiro) {
    return {
      titulo: limparTexto(titulo || ficheiro?.nome?.replace(/\.[^.]+$/, '') || 'Documento').slice(0, 300),
      autor: limparTexto(autor || '').slice(0, 300),
    }
  }

  #relatorio(a) {
    const d = a.documento
    return {
      id: a.id, estado: a.estado, percentagem: a.percentagem, nivel: nivelDe(a.percentagem), erro: a.erro, opcoes: a.opcoes,
      criadaEm: a.criadaEm, concluidaEm: a.concluidaEm, origens: ORIGENS,
      documento: { id: d.id, titulo: d.titulo, autor: d.autor, contexto: d.contexto, origem: d.origem, palavras: d.palavras, pedidoPor: d.pedidoPor },
      texto: d.texto, fontes: a.fontes, trechos: a.trechos,
    }
  }

  #resumoAnalise(a) {
    return { id: a.id, estado: a.estado, percentagem: a.percentagem, nivel: nivelDe(a.percentagem), erro: a.erro, criadaEm: a.criadaEm, documento: a.documento, fontes: (a.fontes || []).slice(0, 3) }
  }

  async #analise(id) {
    const a = await this.integridade.analise(id)
    if (!a) throw new NaoEncontrado('Análise não encontrada.')
    return a
  }

  // ---------- portal (docentes) ----------

  #soDocente(conta) {
    if (conta?.tipo !== 'docente') throw new SemPermissao('Só os docentes verificam a originalidade.')
  }

  // estado da verificação de cada entrega de um trabalho
  async doTrabalho(ctx, trabalhoId) {
    const t = await this.academico.trabalho(trabalhoId)
    if (!t) throw new NaoEncontrado('Trabalho não encontrado.')
    await this.apoio.cadeiraDoDocente(ctx.conta, t.cadeiraId)
    const entregas = await this.academico.entregasDoTrabalho(t.id)
    const ultimas = await this.integridade.ultimasAnalises('entrega', entregas.map((e) => e.id))
    return Object.fromEntries(entregas.map((e) => {
      const a = ultimas[e.id]
      return [e.id, a ? { id: a.id, estado: a.estado, percentagem: a.percentagem, nivel: nivelDe(a.percentagem), erro: a.erro } : null]
    }))
  }

  async reanalisarEntrega(ctx, entregaId) {
    const e = await this.academico.entrega(entregaId)
    const t = e && (await this.academico.trabalho(e.trabalhoId))
    if (!t) throw new NaoEncontrado('Entrega não encontrada.')
    await this.apoio.cadeiraDoDocente(ctx.conta, t.cadeiraId)
    const d = await this.integridade.documentoDe('entrega', e.id)
    if (d) await this.#pedir(d.id)
    else this.entregaFeita(e.id)
    return { estado: 'pendente' }
  }

  async verificarPortal(ctx, ficheiro, dados) {
    try {
      this.#soDocente(ctx.conta)
    } catch (e) {
      if (ficheiro) this.privados.apagar(ficheiro.caminho)
      throw e
    }
    const texto = await this.#lerEnviado(ficheiro)
    const guardar = dados.guardar === true || dados.guardar === 'true'
    const d = await this.#indexar({ origem: 'verificacao', ...this.#dados(dados, ficheiro), contexto: 'Verificação de docente', texto, fonte: guardar, contaId: ctx.conta.id, pedidoPor: ctx.conta.nome })
    return this.#resumoAnalise({ ...(await this.#pedir(d.id)), documento: d })
  }

  async minhas(ctx) {
    this.#soDocente(ctx.conta)
    return (await this.integridade.listarAnalises({ origens: ['verificacao'], contaId: ctx.conta.id })).map((a) => this.#resumoAnalise(a))
  }

  async relatorioPortal(ctx, id) {
    this.#soDocente(ctx.conta)
    const a = await this.#analise(id)
    const d = a.documento
    if (d.origem === 'verificacao' && d.contaId === ctx.conta.id) return this.#relatorio(a)
    if (d.origem === 'entrega') {
      const e = await this.academico.entrega(d.origemId)
      const t = e && (await this.academico.trabalho(e.trabalhoId))
      if (t) {
        await this.apoio.cadeiraDoDocente(ctx.conta, t.cadeiraId)
        return { ...this.#relatorio(a), trabalho: { id: t.id, cadeiraId: t.cadeiraId, titulo: t.titulo } }
      }
    }
    throw new NaoEncontrado('Análise não encontrada.')
  }

  // ---------- painel (Administração Escolar) ----------

  async resumo(ctx) {
    ctx.actor.exigir('integridade.ver')
    const [r, analises] = await Promise.all([this.integridade.resumo(), this.integridade.listarAnalises({ limite: 300 })])
    return { ...r, total: r.analises, origens: ORIGENS, analises: analises.map((a) => this.#resumoAnalise(a)) }
  }

  async relatorioPainel(ctx, id) {
    ctx.actor.exigir('integridade.ver')
    return this.#relatorio(await this.#analise(id))
  }

  async verificarPainel(ctx, ficheiro, dados) {
    try {
      ctx.actor.exigir('integridade.gerir')
    } catch (e) {
      if (ficheiro) this.privados.apagar(ficheiro.caminho)
      throw e
    }
    const texto = await this.#lerEnviado(ficheiro)
    const guardar = dados.guardar === true || dados.guardar === 'true'
    const d = await this.#indexar({ origem: 'verificacao', ...this.#dados(dados, ficheiro), contexto: 'Verificação da Administração Escolar', texto, fonte: guardar, pedidoPor: ctx.actor.nome || '' })
    await this.auditoria.registar(ctx, { acao: 'verificar_originalidade', colecao: 'integridade', alvoId: d.id, alvoTitulo: d.titulo })
    return this.#resumoAnalise({ ...(await this.#pedir(d.id)), documento: d })
  }

  async repositorio(ctx) {
    ctx.actor.exigir('integridade.ver')
    return this.integridade.listarDocumentos({ origens: ['repositorio', 'biblioteca'] })
  }

  // documento de referência (tese antiga, TFC de anos anteriores, …): passa a servir de comparação
  async adicionarReferencia(ctx, ficheiro, dados) {
    try {
      ctx.actor.exigir('integridade.gerir')
    } catch (e) {
      if (ficheiro) this.privados.apagar(ficheiro.caminho)
      throw e
    }
    const texto = await this.#lerEnviado(ficheiro)
    const d = await this.#indexar({ origem: 'repositorio', ...this.#dados(dados, ficheiro), contexto: limparTexto(dados.contexto || '').slice(0, 200), texto, pedidoPor: ctx.actor.nome || '' })
    await this.auditoria.registar(ctx, { acao: 'adicionar_referencia', colecao: 'integridade', alvoId: d.id, alvoTitulo: d.titulo })
    return d
  }

  async apagarDocumento(ctx, id) {
    ctx.actor.exigir('integridade.gerir')
    const d = await this.integridade.documento(id)
    if (!d) throw new NaoEncontrado('Documento não encontrado.')
    await this.integridade.apagarDocumento(d.id)
    await this.auditoria.registar(ctx, { acao: 'apagar_referencia', colecao: 'integridade', alvoId: d.id, alvoTitulo: d.titulo })
  }

  // indexa o que ainda não está: obras digitais da biblioteca e entregas anteriores ao anti-plágio
  async reindexar(ctx) {
    ctx.actor.exigir('integridade.gerir')
    const obras = (await this.biblioteca.listarObras({ soDigital: true }))
    const entregas = await this.integridade.entregasPorIndexar()
    for (const o of obras) this.obraMudou(o)
    for (const id of entregas) this.entregaFeita(id)
    return { obras: obras.length, entregas: entregas.length }
  }
}
