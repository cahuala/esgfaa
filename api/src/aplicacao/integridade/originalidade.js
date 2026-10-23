import { ErroValidacao, NaoEncontrado, SemPermissao } from '../../dominio/comum/erros.js'
import { limparTexto } from '../../dominio/comum/texto.js'
import { MINIMO_PALAVRAS, caracteresDisfarcados, comparar, impressoes, nivelDe, tokenizar } from '../../dominio/integridade/semelhanca.js'
import { verificarApa } from '../../dominio/integridade/apa.js'
import { frasesParaPesquisa, indicadoresIA } from '../../dominio/integridade/ia.js'
import { MIN_RAIZES, frase, frases, impressoesAproximadas, linguaDe, paraFrases } from '../../dominio/integridade/parafrase.js'
import { pareceDigitalizacao } from '../../infraestrutura/texto/ocr.js'
import { avaliarComClaude } from './avaliacaoIA.js'
import { instrucoesParaIA } from '../../dominio/seguranca/ataques.js'

export const ORIGENS = { entrega: 'Trabalho entregue', biblioteca: 'Biblioteca digital', repositorio: 'Repositório de referência', verificacao: 'Verificação avulsa', internet: 'Internet' }
const PADRAO = { excluirCitacoes: true, excluirReferencias: true, internet: true, ia: true, parafrase: true, traducao: true }
// tradução: o trabalho (em português) vai para estas línguas e compara-se com as fontes nelas
const LINGUAS_TRADUCAO = ['en', 'fr']
const MAX_FRASES_TRADUCAO = 300
const MAX_CARACTERES_TRADUCAO = 60_000
const MAX_PAGINAS = 15
const FORMATOS = 'PDF ou Word (.docx)'
// probabilidade de IA a mostrar: a do Claude, se houver; senão a dos indicadores locais
const pontuacaoIA = (ia) => ia?.claude?.probabilidade ?? ia?.local?.pontuacao ?? null

// normas APA (citações e referências) e letras disfarçadas (outro alfabeto, caracteres invisíveis)
export function normasDoTexto(texto) {
  const disfarces = caracteresDisfarcados(texto)
  return { apa: verificarApa(texto), disfarces: { total: disfarces.length, palavras: disfarces.slice(0, 40) } }
}

/*
  Integridade académica (anti-plágio): cada trabalho entregue, obra digital da biblioteca e documento
  de referência fica indexado; os trabalhos entregues (e os documentos verificados à parte) são comparados
  com tudo o resto. As análises correm em fila, uma de cada vez, sem atrasar quem entrega.
*/
export class ServicoOriginalidade {
  #fila = Promise.resolve()

  constructor({ integridade, academico, contas, biblioteca, privados, extrair, apoio, auditoria, relogio, registarErro, pesquisaWeb = null, obterPagina = null, claude = null, pesquisasPorDocumento = 8, tradutor = null, ocr = null }) {
    Object.assign(this, { integridade, academico, contas, biblioteca, privados, extrair, apoio, auditoria, relogio, registarErro, pesquisaWeb, obterPagina, claude, pesquisasPorDocumento, tradutor, ocr })
  }

  // texto de um ficheiro; um PDF digitalizado (quase sem texto) passa pelo OCR, se houver
  async #ler(caminho, tipo) {
    const texto = await this.extrair(caminho, tipo).catch(() => '')
    if (tipo !== 'application/pdf' || !pareceDigitalizacao(texto) || !this.ocr) return { texto, ocr: false }
    const lido = await this.ocr(caminho, tipo).catch(() => '')
    return lido.length > texto.length ? { texto: lido, ocr: true } : { texto, ocr: false }
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

  // análises que ficaram a meio (servidor reiniciado); e as fontes antigas ganham as impressões aproximadas
  async retomar() {
    for (const id of await this.integridade.pendentes()) this.#agendar('retomar', () => this.#analisar(id))
    this.#agendar('aproximadas', () => this.#completarAproximadas())
  }

  // fontes indexadas antes da paráfrase (aos lotes, até não haver mais)
  async #completarAproximadas() {
    for (let ids = await this.integridade.semAproximadas(100); ids.length; ids = await this.integridade.semAproximadas(100)) {
      for (const d of await this.integridade.documentosComTexto(ids)) {
        const ap = impressoesAproximadas(tokenizar(d.texto))
        // documento sem texto: uma impressão vazia, para não voltar a ele
        await this.integridade.gravarAproximadas(d.id, ap.length ? ap : [{ p: 0, h: 0 }])
      }
    }
  }

  async #textoDosFicheiros(ids) {
    const partes = []
    let ocr = false
    for (const id of ids) {
      const f = await this.academico.ficheiro(id)
      if (!f) continue
      const l = await this.#ler(this.privados.absoluto(f.caminho), f.tipo)
      partes.push(l.texto)
      ocr ||= l.ocr
    }
    return { texto: partes.filter(Boolean).join('\n\n'), ocr }
  }

  #indexar({ texto, fonte = true, ...dados }) {
    const tokens = tokenizar(texto)
    return this.integridade.gravarDocumento({ ...dados, texto, fonte, palavras: tokens.length, impressoes: fonte ? impressoes(tokens) : [], aproximadas: fonte ? impressoesAproximadas(tokens) : [] })
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
      const digitalizado = !doc.texto.trim() || pareceDigitalizacao(doc.texto)
      const semOcr = !this.ocr || !(await this.ocr.disponivel?.())
      await this.integridade.concluirAnalise(id, {
        estado: 'erro', concluidaEm: this.relogio.agora(),
        erro: !digitalizado ? 'O documento tem pouco texto para comparar.'
          : semOcr ? 'Não foi possível ler texto do documento: parece uma digitalização em imagem e o servidor não tem o reconhecimento de texto (OCR) instalado.'
            : 'Não foi possível ler texto do documento, nem com o reconhecimento de texto (OCR).',
      })
      return
    }
    const parafrase = a.opcoes.parafrase !== false
    const frasesA = parafrase ? frases(doc.texto, tokens) : []
    const traducao = await this.#traduzir(doc.texto, frasesA, a.opcoes)
    // fontes candidatas: pelas impressões exactas, pelas aproximadas (paráfrase) e pelas da tradução
    const ids = new Set(await this.integridade.candidatos(impressoes(tokens).map((x) => x.h), doc.id))
    if (parafrase) for (const x of await this.integridade.candidatos(impressoesAproximadas(tokens).map((y) => y.h), doc.id, { tipo: 1 })) ids.add(x)
    for (const t of traducao.versoes) for (const x of await this.integridade.candidatos(t.hashes, doc.id, { tipo: 1, limite: 8 })) ids.add(x)
    const docs = await this.integridade.documentosComTexto([...ids])
    const web = await this.#internet(doc.texto, a.opcoes)
    const fontes = [
      ...docs.map((f) => ({ id: f.id, texto: f.texto, tokens: tokenizar(f.texto) })),
      ...web.paginas.map((p) => ({ id: p.id, texto: p.texto, tokens: tokenizar(p.texto) })),
    ]
    const r = comparar({ texto: doc.texto, tokens }, fontes, { parecidas: parafrase ? this.#parecidas(frasesA, linguaDe(doc.texto), fontes, traducao.versoes) : [] })
    const info = Object.fromEntries([
      ...docs.map((f) => [f.id, { titulo: f.titulo, autor: f.autor, origem: f.origem, contexto: f.contexto }]),
      ...web.paginas.map((p) => [p.id, { titulo: p.titulo || new URL(p.url).hostname, autor: new URL(p.url).hostname, origem: 'internet', contexto: '', url: p.url }]),
    ])
    await this.integridade.concluirAnalise(id, {
      estado: 'concluida', percentagem: r.percentagem, concluidaEm: this.relogio.agora(),
      fontes: r.fontes.map((f) => ({ ...f, ...info[f.id] })), trechos: r.trechos,
      internet: web.info, ia: a.opcoes.ia === false ? {} : await this.#ia(doc.texto), normas: normasDoTexto(doc.texto),
      // o que se verificou (o relatório diz o que ficou de fora)
      verificacoes: {
        exacta: true, parafrase, traducao: traducao.info, ocr: Boolean(a.opcoes.lidoPorOcr), internet: web.info.estado,
        percentagens: { exacta: r.percentagemExacta, parafrase: r.percentagemParafrase, traducao: r.percentagemTraducao },
      },
    })
  }

  // frases parafraseadas (na mesma língua) e traduzidas (as versões noutra língua, contra as fontes nessa língua)
  #parecidas(frasesA, lingua, fontes, versoes) {
    const comFrases = fontes.map((f) => ({ id: f.id, texto: f.texto, lingua: linguaDe(f.texto), frases: frases(f.texto, f.tokens) }))
    const marcar = (lista, achadas, tipo) => achadas.map((x) => ({ inicio: lista[x.k].inicio, fim: lista[x.k].fim, fonte: x.fonte, excerto: x.b.texto, valor: x.valor, tipo }))
    const r = marcar(frasesA, paraFrases(frasesA, comFrases.filter((f) => !lingua || !f.lingua || f.lingua === lingua)), 'parafrase')
    for (const v of versoes) {
      const naLingua = comFrases.filter((f) => f.lingua === v.lingua)
      if (naLingua.length) r.push(...marcar(v.frases, paraFrases(v.frases, naLingua), 'traducao'))
    }
    return r
  }

  /*
    Tradução do trabalho (português) frase a frase para inglês e francês, pelo tradutor do servidor
    (LibreTranslate, ou o Claude se autorizado), para o comparar com fontes nessas línguas.
  */
  async #traduzir(texto, frasesA, opcoes) {
    const vazio = (estado, extra = {}) => ({ versoes: [], info: { estado, ...extra } })
    if (!this.tradutor) return vazio('sem-servico')
    if (opcoes.traducao === false || opcoes.parafrase === false) return vazio('desligada')
    if (linguaDe(texto) !== 'pt') return vazio('outra-lingua')
    const escolhidas = []
    let tam = 0
    for (const [k, f] of frasesA.entries()) {
      if (f.conjunto.size < MIN_RAIZES) continue
      if (escolhidas.length >= MAX_FRASES_TRADUCAO || tam + f.texto.length > MAX_CARACTERES_TRADUCAO) break
      escolhidas.push(k)
      tam += f.texto.length
    }
    if (!escolhidas.length) return vazio('feita', { linguas: [], frases: 0 })
    const versoes = []
    let erro = ''
    for (const lingua of LINGUAS_TRADUCAO) {
      try {
        const out = await this.tradutor.traduzirMapa(Object.fromEntries(escolhidas.map((k) => [String(k), frasesA[k].texto])), lingua)
        const lista = escolhidas.filter((k) => out[String(k)]).map((k) => frase(out[String(k)], frasesA[k].inicio, frasesA[k].fim, frasesA[k].palavras))
        if (lista.length) versoes.push({ lingua, frases: lista, hashes: impressoesAproximadas(lista.map((f) => f.texto).join('\n')).map((x) => x.h) })
      } catch (e) {
        erro = e.message
      }
    }
    return { versoes, info: { estado: versoes.length ? 'feita' : 'erro', linguas: versoes.map((v) => v.lingua), frases: escolhidas.length, erro, tradutor: this.tradutor.nome || '' } }
  }

  // pesquisa frases do documento na internet e lê as páginas encontradas (só com chave do Brave Search)
  async #internet(texto, opcoes) {
    if (!this.pesquisaWeb || !this.obterPagina) return { paginas: [], info: { estado: 'sem-servico' } }
    if (opcoes.internet === false) return { paginas: [], info: { estado: 'desligada' } }
    const frases = frasesParaPesquisa(texto, this.pesquisasPorDocumento)
    const urls = new Map()
    let erro = ''
    for (const f of frases) {
      try {
        for (const x of await this.pesquisaWeb.pesquisar(f, { resultados: 3 })) if (x.url && !urls.has(x.url)) urls.set(x.url, x)
      } catch (e) {
        erro = e.message
        break
      }
    }
    const lista = [...urls.values()].slice(0, MAX_PAGINAS)
    const paginas = []
    for (let k = 0; k < lista.length; k += 4) {
      const lidas = await Promise.all(lista.slice(k, k + 4).map((x) => this.obterPagina(x.url).catch(() => null)))
      lidas.forEach((p, j) => {
        if (p?.texto && p.texto.length > 200) paginas.push({ id: `web${k + j}`, url: p.url, titulo: p.titulo || lista[k + j].titulo, texto: p.texto.slice(0, 400_000) })
      })
    }
    return { paginas, info: { estado: erro && !frases.length ? 'erro' : 'feita', frases: frases.length, resultados: urls.size, paginas: paginas.length, erro } }
  }

  // utilização de IA: indicadores locais sempre; avaliação do Claude se houver chave
  async #ia(texto) {
    const local = indicadoresIA(texto)
    // o trabalho a tentar mandar no avaliador («ignora as instruções…»): fica no relatório e no Centro de segurança
    const manipulacao = instrucoesParaIA(texto)
    if (manipulacao) this.aoInstrucoesIA?.(manipulacao)
    let claude = null
    let erro = ''
    if (this.claude) {
      try {
        claude = await avaliarComClaude(this.claude, texto)
      } catch (e) {
        erro = e.message
      }
    }
    return { local, claude, erro, servico: Boolean(this.claude), manipulacao }
  }

  // ---------- ligações a outros contextos ----------

  // um trabalho foi entregue (ou substituído): indexa e analisa, sem atrasar a entrega
  entregaFeita(entregaId) {
    return this.#agendar('entrega', async () => {
      const e = await this.academico.entrega(entregaId)
      if (!e) return
      const [t, estudante] = await Promise.all([this.academico.trabalho(e.trabalhoId), this.contas.porId(e.estudanteId)])
      const cadeira = t && (await this.academico.cadeira(t.cadeiraId))
      const lido = await this.#textoDosFicheiros(e.ficheiros.map((f) => f.id))
      const texto = [e.texto, lido.texto].filter(Boolean).join('\n\n')
      const d = await this.#indexar({
        origem: 'entrega', origemId: e.id, titulo: t?.titulo || 'Trabalho', autor: estudante?.nome || '', texto,
        contexto: [cadeira && `${cadeira.codigo} ${cadeira.nome}`].filter(Boolean).join(' · '),
      })
      const a = await this.integridade.criarAnalise(d.id, { ...PADRAO, lidoPorOcr: lido.ocr })
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
      const { texto } = await this.#ler(this.privados.absoluto(f.caminho), f.tipo)
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
      const lido = await this.#ler(ficheiro.caminho, ficheiro.tipo)
      if (!lido.texto) throw new ErroValidacao(`Não foi possível ler texto deste ficheiro. Use ${FORMATOS} com texto (não uma digitalização).`, { campo: 'ficheiro' })
      return lido
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
      texto: d.texto, fontes: a.fontes, trechos: a.trechos, internet: a.internet, ia: a.ia, iaPontuacao: pontuacaoIA(a.ia), normas: a.normas, verificacoes: a.verificacoes,
    }
  }

  #resumoAnalise(a) {
    return { id: a.id, estado: a.estado, percentagem: a.percentagem, nivel: nivelDe(a.percentagem), erro: a.erro, criadaEm: a.criadaEm, documento: a.documento, fontes: (a.fontes || []).slice(0, 3), iaPontuacao: pontuacaoIA(a.ia), apaErros: a.normas?.apa?.erros ?? null, disfarces: a.normas?.disfarces?.total ?? 0 }
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
      return [e.id, a ? { id: a.id, estado: a.estado, percentagem: a.percentagem, nivel: nivelDe(a.percentagem), erro: a.erro, iaPontuacao: pontuacaoIA(a.ia) } : null]
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
    const { texto, ocr } = await this.#lerEnviado(ficheiro)
    const guardar = dados.guardar === true || dados.guardar === 'true'
    const d = await this.#indexar({ origem: 'verificacao', ...this.#dados(dados, ficheiro), contexto: 'Verificação de docente', texto, fonte: guardar, contaId: ctx.conta.id, pedidoPor: ctx.conta.nome })
    return this.#resumoAnalise({ ...(await this.#pedir(d.id, { lidoPorOcr: ocr })), documento: d })
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
    const { texto, ocr } = await this.#lerEnviado(ficheiro)
    const guardar = dados.guardar === true || dados.guardar === 'true'
    const d = await this.#indexar({ origem: 'verificacao', ...this.#dados(dados, ficheiro), contexto: 'Verificação da Administração Escolar', texto, fonte: guardar, pedidoPor: ctx.actor.nome || '' })
    await this.auditoria.registar(ctx, { acao: 'verificar_originalidade', colecao: 'integridade', alvoId: d.id, alvoTitulo: d.titulo })
    return this.#resumoAnalise({ ...(await this.#pedir(d.id, { lidoPorOcr: ocr })), documento: d })
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
    const { texto } = await this.#lerEnviado(ficheiro)
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
    this.#agendar('aproximadas', () => this.#completarAproximadas())
    return { obras: obras.length, entregas: entregas.length }
  }
}
