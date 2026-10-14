import { Conflito, ErroValidacao, NaoEncontrado, SemPermissao } from '../../../dominio/comum/erros.js'
import { corrigir, dentroDoTempo, estadoQuestionario, estatisticas, limiteTentativa, limparRespostas, perguntasDaTentativa, sortearTentativa, TIPOS_COM_OPCOES, validarPergunta } from '../../../dominio/academico/atividades/questionarios.js'
import { texto } from '../../../dominio/academico/comum/validacao.js'
import { quem } from '../partilhado/autor.js'

const data = (v) => {
  if (v === null || v === undefined || v === '') return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) throw new ErroValidacao('Data inválida.', { campo: 'data' })
  return d
}

// Questionários: edição, banco de perguntas, tentativas com tempo, correção e estatísticas.
export class ServicoQuestionarios {
  constructor(dependencias) {
    Object.assign(this, dependencias)
  }

  #dadosQuestionario(d, atual = {}) {
    const r = {}
    if (d.titulo !== undefined || !atual.titulo) r.titulo = texto(d.titulo, 'titulo', 'Título', { min: 3, max: 200 })
    if (d.descricao !== undefined) r.descricao = texto(d.descricao, 'descricao', 'Instruções', { max: 3000, obrigatorio: false })
    if (d.abre !== undefined) r.abre = data(d.abre)
    if (d.fecha !== undefined) r.fecha = data(d.fecha)
    if (d.duracao !== undefined) {
      const n = Number(d.duracao || 0)
      if (!Number.isInteger(n) || n < 0 || n > 600) throw new ErroValidacao('Duração de 0 a 600 minutos (0 = sem limite).', { campo: 'duracao' })
      r.duracao = n
    }
    if (d.tentativas !== undefined) {
      const n = Number(d.tentativas)
      if (!Number.isInteger(n) || n < 1 || n > 10) throw new ErroValidacao('Tentativas de 1 a 10.', { campo: 'tentativas' })
      r.tentativas = n
    }
    if (d.mostrarRespostas !== undefined) r.mostrarRespostas = Boolean(d.mostrarRespostas)
    if (d.baralhar !== undefined) r.baralhar = Boolean(d.baralhar)
    if (d.perguntasPorTentativa !== undefined) {
      const n = Number(d.perguntasPorTentativa || 0)
      if (!Number.isInteger(n) || n < 0 || n > 200) throw new ErroValidacao('Perguntas por tentativa de 0 a 200 (0 = todas).', { campo: 'perguntasPorTentativa' })
      r.perguntasPorTentativa = n
    }
    const abre = r.abre !== undefined ? r.abre : atual.abre && new Date(atual.abre)
    const fecha = r.fecha !== undefined ? r.fecha : atual.fecha && new Date(atual.fecha)
    if (abre && fecha && abre >= fecha) throw new ErroValidacao('O fecho tem de ser depois da abertura.', { campo: 'fecha' })
    return r
  }

  async #questionarioDoDocente(ctx, id) {
    const q = await this.recursos.questionario(id)
    if (!q) throw new NaoEncontrado('Questionário não encontrado.')
    const cadeira = await this.acesso.doDocente(ctx.conta, q.cadeiraId)
    return { ...q, cadeira }
  }

  async #semTentativas(q) {
    if ((await this.recursos.tentativas(q.id)).length) {
      throw new Conflito('Já há tentativas neste questionário: as perguntas não podem mudar. Crie outro questionário.')
    }
  }

  // lista da cadeira: o docente vê todos; o estudante só os publicados, com o seu estado
  async questionarios(ctx, cadeiraId) {
    const c = await this.acesso.acessivel(ctx.conta, cadeiraId)
    const agora = this.relogio.agora()
    if (ctx.conta.tipo === 'docente') return this.recursos.questionarios(c.id)
    const lista = await this.recursos.questionarios(c.id, { soPublicados: true })
    const minhas = await this.recursos.tentativasDoEstudante(ctx.conta.id, lista.map((q) => q.id))
    return lista.map((q) => {
      const t = minhas.filter((x) => x.questionarioId === q.id && x.entregueEm)
      const notas = t.map((x) => x.nota).filter((n) => n !== null)
      return { ...q, estado: estadoQuestionario(q, agora), feitas: t.length, melhorNota: notas.length ? Math.max(...notas) : null, porCorrigir: t.some((x) => x.porCorrigir) }
    })
  }

  async criarQuestionario(ctx, cadeiraId, dados) {
    const c = await this.acesso.doDocente(ctx.conta, cadeiraId)
    return this.recursos.criarQuestionario({ cadeiraId: c.id, secaoId: await this.apoio.secaoDaCadeira(c.id, dados.secaoId), ...this.#dadosQuestionario(dados) })
  }

  async atualizarQuestionario(ctx, id, dados) {
    const q = await this.#questionarioDoDocente(ctx, id)
    const mudanca = this.#dadosQuestionario(dados, q)
    if (dados.publicado !== undefined) {
      if (dados.publicado && !q.perguntas.length) throw new ErroValidacao('Junte pelo menos uma pergunta antes de publicar.')
      mudanca.publicado = Boolean(dados.publicado)
    }
    const r = await this.recursos.atualizarQuestionario(q.id, mudanca)
    if (mudanca.publicado && !q.publicado) {
      await this.auditoria.registar(ctx, { acao: 'publicar_questionario', colecao: 'questionarios', alvoId: q.id, alvoTitulo: q.titulo, utilizador: quem(ctx.conta) })
      await this.apoio.avisarEstudantes(ctx, q.cadeira, q.secaoId, {
        tipo: 'questionario', titulo: `Novo questionário em ${q.cadeira.nome}: ${q.titulo}`, texto: r.fecha ? `Fecha em ${new Date(r.fecha).toLocaleString('pt-PT', { timeZone: 'Africa/Luanda', dateStyle: 'short', timeStyle: 'short' })}` : '',
        ligacao: `/cadeiras/${q.cadeira.id}?atividade=questionario-${q.id}`,
      })
    }
    return r
  }

  async apagarQuestionario(ctx, id) {
    const q = await this.#questionarioDoDocente(ctx, id)
    await this.recursos.apagarQuestionario(q.id)
    await this.auditoria.registar(ctx, { acao: 'apagar_questionario', colecao: 'questionarios', alvoId: q.id, alvoTitulo: q.titulo, utilizador: quem(ctx.conta) })
  }

  // o docente vê as perguntas com as respostas certas e os resultados
  async questionarioDocente(ctx, id) {
    const { cadeira, ...q } = await this.#questionarioDoDocente(ctx, id)
    void cadeira
    const tentativas = await this.recursos.tentativas(q.id)
    return {
      ...q,
      resultados: tentativas.filter((t) => t.entregueEm).map((t) => ({ id: t.id, estudante: t.estudante, numero: t.numero, nota: t.nota, entregueEm: t.entregueEm, porCorrigir: t.porCorrigir })),
    }
  }

  async criarPergunta(ctx, questionarioId, dados) {
    const q = await this.#questionarioDoDocente(ctx, questionarioId)
    await this.#semTentativas(q)
    await this.recursos.criarPergunta(q.id, validarPergunta(dados))
    return this.recursos.questionario(q.id)
  }

  async atualizarPergunta(ctx, id, dados) {
    const p = await this.recursos.pergunta(id)
    if (!p) throw new NaoEncontrado('Pergunta não encontrada.')
    const q = await this.#questionarioDoDocente(ctx, p.questionarioId)
    await this.#semTentativas(q)
    await this.recursos.atualizarPergunta(p.id, validarPergunta(dados))
    return this.recursos.questionario(q.id)
  }

  async apagarPergunta(ctx, id) {
    const p = await this.recursos.pergunta(id)
    if (!p) throw new NaoEncontrado('Pergunta não encontrada.')
    const q = await this.#questionarioDoDocente(ctx, p.questionarioId)
    await this.#semTentativas(q)
    await this.recursos.apagarPergunta(p.id)
    return this.recursos.questionario(q.id)
  }

  async #tentativaDoDocente(ctx, tentativaId) {
    const t = await this.recursos.tentativa(tentativaId)
    if (!t) throw new NaoEncontrado('Tentativa não encontrada.')
    const q = await this.#questionarioDoDocente(ctx, t.questionarioId)
    return { t, q }
  }

  // uma tentativa com as respostas e a correção automática (para corrigir as dissertações)
  async tentativaParaCorrigir(ctx, tentativaId) {
    const { t, q } = await this.#tentativaDoDocente(ctx, tentativaId)
    const perguntas = perguntasDaTentativa(q.perguntas, t)
    const estudante = (await this.recursos.tentativas(q.id)).find((x) => x.id === t.id)?.estudante
    return { tentativa: t, estudante, questionario: { id: q.id, titulo: q.titulo }, perguntas, ...corrigir(perguntas, t.respostas, t.manuais) }
  }

  async corrigirTentativa(ctx, tentativaId, { pontos, comentario }) {
    const { t, q } = await this.#tentativaDoDocente(ctx, tentativaId)
    if (!t.entregueEm) throw new Conflito('A tentativa ainda não foi entregue.')
    const perguntas = perguntasDaTentativa(q.perguntas, t)
    const manuais = { ...t.manuais }
    for (const [id, v] of Object.entries(pontos || {})) {
      const p = perguntas.find((x) => String(x.id) === String(id))
      if (!p || p.tipo !== 'dissertacao') throw new ErroValidacao('Só as dissertações se corrigem à mão.', { campo: 'pontos' })
      const n = Number(String(v).replace(',', '.'))
      if (!Number.isFinite(n) || n < 0 || n > p.pontos) throw new ErroValidacao(`Pontos de 0 a ${p.pontos}.`, { campo: 'pontos' })
      manuais[p.id] = Math.round(n * 100) / 100
    }
    const r = corrigir(perguntas, t.respostas, manuais)
    await this.recursos.corrigirTentativa(t.id, { manuais, nota: r.nota, porCorrigir: r.porCorrigir, comentario: texto(comentario, 'comentario', 'Comentário', { max: 3000, obrigatorio: false }) })
    await this.pautas?.sincronizar(q.cadeira)
    if (!r.porCorrigir) {
      await this.notificacoes?.notificar([t.estudanteId], {
        tipo: 'correcao', titulo: `Questionário corrigido: ${q.titulo}`, texto: `${q.cadeira.nome} — nota ${r.nota} valores`, ligacao: `/cadeiras/${q.cadeira.id}?atividade=questionario-${q.id}`,
      })
    }
    return this.tentativaParaCorrigir(ctx, t.id)
  }

  async estatisticas(ctx, questionarioId) {
    const q = await this.#questionarioDoDocente(ctx, questionarioId)
    return estatisticas(q.perguntas, await this.recursos.tentativas(q.id))
  }

  banco(ctx) {
    if (ctx.conta.tipo !== 'docente') throw new SemPermissao('O banco de perguntas é dos docentes.')
    return this.recursos.banco(ctx.conta.id)
  }

  #categoria(c) {
    return texto(c || 'Geral', 'categoria', 'Categoria', { min: 1, max: 80 })
  }

  async criarNoBanco(ctx, dados) {
    if (ctx.conta.tipo !== 'docente') throw new SemPermissao('O banco de perguntas é dos docentes.')
    return this.recursos.guardarNoBanco({ docenteId: ctx.conta.id, categoria: this.#categoria(dados.categoria), ...validarPergunta(dados) })
  }

  // guarda no banco uma pergunta de um questionário seu
  async guardarNoBanco(ctx, perguntaId, { categoria }) {
    const p = await this.recursos.pergunta(perguntaId)
    if (!p) throw new NaoEncontrado('Pergunta não encontrada.')
    await this.#questionarioDoDocente(ctx, p.questionarioId)
    return this.recursos.guardarNoBanco({ docenteId: ctx.conta.id, categoria: this.#categoria(categoria), tipo: p.tipo, enunciado: p.enunciado, opcoes: p.opcoes, pontos: p.pontos })
  }

  async apagarDoBanco(ctx, id) {
    const p = await this.recursos.perguntaDoBanco(id)
    if (!p || p.docenteId !== ctx.conta.id) throw new NaoEncontrado('Pergunta não encontrada.')
    await this.recursos.apagarDoBanco(p.id)
  }

  // junta ao questionário cópias de perguntas do banco
  async juntarDoBanco(ctx, questionarioId, { ids }) {
    const q = await this.#questionarioDoDocente(ctx, questionarioId)
    await this.#semTentativas(q)
    for (const id of ids || []) {
      const p = await this.recursos.perguntaDoBanco(id)
      if (!p || p.docenteId !== ctx.conta.id) throw new NaoEncontrado('Pergunta do banco não encontrada.')
      await this.recursos.criarPergunta(q.id, { tipo: p.tipo, enunciado: p.enunciado, opcoes: p.opcoes, pontos: p.pontos })
    }
    return this.recursos.questionario(q.id)
  }

  async #questionarioDoEstudante(ctx, id) {
    this.acesso.soEstudante(ctx.conta)
    const q = await this.recursos.questionario(id)
    if (!q || !q.publicado) throw new NaoEncontrado('Questionário não encontrado.')
    const cadeira = await this.acesso.acessivel(ctx.conta, q.cadeiraId).catch(() => { throw new NaoEncontrado('Questionário não encontrado.') })
    await this.disponibilidade?.exigir(cadeira.id, ctx.conta.id, 'questionario', q.id)
    return { ...q, cadeira }
  }

  /*
    Perguntas como o estudante as vê: sem as soluções, pela ordem sorteada, com as opções na ordem
    da tentativa mas com o índice original (as respostas usam sempre o índice original).
  */
  #semSolucao(q, t) {
    const perm = t?.permutacoes || {}
    const ordenar = (lista, id) => (perm[id] ? perm[id].map((i) => lista[i]) : lista)
    return perguntasDaTentativa(q.perguntas, t).map((p) => {
      const base = { id: p.id, enunciado: p.enunciado, tipo: p.tipo, pontos: p.pontos }
      if (TIPOS_COM_OPCOES.includes(p.tipo)) return { ...base, opcoes: ordenar(p.opcoes.map((o, i) => ({ i, texto: o.texto })), p.id) }
      // correspondência: as escolhas vão numeradas pela posição mostrada (o índice original revelaria a solução)
      if (p.tipo === 'correspondencia') return { ...base, itens: p.opcoes.pares.map((x) => x.a), escolhas: ordenar(p.opcoes.pares.map((x) => x.b), p.id).map((texto, j) => ({ i: j, texto })) }
      if (p.tipo === 'dissertacao') return { ...base, orientacao: p.opcoes.orientacao || '' }
      return base
    })
  }

  // correspondência: posição mostrada ⇄ índice original (com a permutação da tentativa)
  #paraOriginal(q, t, respostas) {
    const r = { ...(respostas || {}) }
    for (const p of q.perguntas) {
      const perm = t.permutacoes?.[p.id]
      if (p.tipo === 'correspondencia' && perm && Array.isArray(r[p.id])) r[p.id] = r[p.id].map((j) => (j === null || j === undefined ? null : perm[j] ?? null))
    }
    return r
  }

  #paraMostrado(q, t, respostas) {
    const r = { ...(respostas || {}) }
    for (const p of q.perguntas) {
      const perm = t.permutacoes?.[p.id]
      if (p.tipo === 'correspondencia' && perm && Array.isArray(r[p.id])) r[p.id] = r[p.id].map((i) => (i === null || i === undefined ? null : perm.indexOf(i)))
    }
    return r
  }

  #resultado(q, t) {
    const perguntas = perguntasDaTentativa(q.perguntas, t)
    const r = corrigir(perguntas, t.respostas, t.manuais)
    // na correspondência, a revisão mostra os textos (as escolhas apareciam baralhadas)
    const detalhe = r.detalhe.map((d) => {
      const p = perguntas.find((x) => x.id === d.perguntaId)
      if (p?.tipo !== 'correspondencia') return d
      return { ...d, textos: { certas: p.opcoes.pares.map((x) => x.b), dadas: (d.dada || []).map((i) => (i === null ? null : p.opcoes.pares[i]?.b ?? null)) } }
    })
    return {
      nota: r.nota, obtidos: r.obtidos, total: r.total, porCorrigir: r.porCorrigir, comentario: t.comentario || '',
      ...(q.mostrarRespostas && !r.porCorrigir ? { correcao: detalhe } : {}),
    }
  }

  // tentativas que passaram o tempo sem ser entregues fecham-se com as respostas guardadas
  async #fecharExpiradas(q, tentativas) {
    const agora = this.relogio.agora()
    for (const t of tentativas) {
      if (!t.entregueEm && !dentroDoTempo(t, agora)) {
        const r = corrigir(perguntasDaTentativa(q.perguntas, t), t.respostas)
        await this.recursos.entregarTentativa(t.id, { respostas: t.respostas, nota: r.nota, porCorrigir: r.porCorrigir, entregueEm: new Date(t.limite) })
      }
    }
  }

  async verQuestionario(ctx, id) {
    const q = await this.#questionarioDoEstudante(ctx, id)
    await this.registos?.registar(ctx.conta, q.cadeiraId, 'questionario', q.id)
    await this.#fecharExpiradas(q, await this.recursos.tentativas(q.id, ctx.conta.id))
    const tentativas = await this.recursos.tentativas(q.id, ctx.conta.id)
    const emCurso = tentativas.find((t) => !t.entregueEm)
    const feitas = tentativas.filter((t) => t.entregueEm)
    const nPerguntas = q.perguntasPorTentativa > 0 ? Math.min(q.perguntasPorTentativa, q.perguntas.length) : q.perguntas.length
    return {
      id: q.id, titulo: q.titulo, descricao: q.descricao, abre: q.abre, fecha: q.fecha, duracao: q.duracao, tentativas: q.tentativas,
      numeroPerguntas: nPerguntas, pontos: q.perguntasPorTentativa > 0 ? null : q.perguntas.reduce((s, p) => s + p.pontos, 0),
      estado: estadoQuestionario(q, this.relogio.agora()),
      feitas: feitas.map((t) => ({ id: t.id, numero: t.numero, nota: t.nota, entregueEm: t.entregueEm, porCorrigir: t.porCorrigir })),
      emCurso: emCurso ? { ...emCurso, respostas: this.#paraMostrado(q, emCurso, emCurso.respostas), perguntas: this.#semSolucao(q, emCurso) } : null,
    }
  }

  async iniciar(ctx, id) {
    const q = await this.#questionarioDoEstudante(ctx, id)
    const agora = this.relogio.agora()
    await this.#fecharExpiradas(q, await this.recursos.tentativas(q.id, ctx.conta.id))
    const tentativas = await this.recursos.tentativas(q.id, ctx.conta.id)
    const emCurso = tentativas.find((t) => !t.entregueEm)
    if (emCurso) return { ...emCurso, respostas: this.#paraMostrado(q, emCurso, emCurso.respostas), perguntas: this.#semSolucao(q, emCurso) }
    const estado = estadoQuestionario(q, agora)
    if (estado !== 'aberto') throw new Conflito(estado === 'em_breve' ? 'O questionário ainda não abriu.' : 'O questionário já fechou.')
    if (tentativas.length >= q.tentativas) throw new Conflito('Já usou todas as tentativas.')
    let t
    try {
      t = await this.recursos.iniciarTentativa({
        questionarioId: q.id, estudanteId: ctx.conta.id, numero: tentativas.length + 1, iniciadaEm: agora, limite: limiteTentativa(q, agora),
        ...sortearTentativa(q, q.perguntas),
      })
    } catch {
      throw new Conflito('A tentativa já foi iniciada noutra janela. Recarregue a página.')
    }
    return { ...t, perguntas: this.#semSolucao(q, t) }
  }

  async #minhaTentativa(ctx, tentativaId) {
    this.acesso.soEstudante(ctx.conta)
    const t = await this.recursos.tentativa(tentativaId)
    if (!t || t.estudanteId !== ctx.conta.id) throw new NaoEncontrado('Tentativa não encontrada.')
    const q = await this.#questionarioDoEstudante(ctx, t.questionarioId)
    return { t, q }
  }

  // gravação automática das respostas durante a tentativa
  async guardarRespostas(ctx, tentativaId, respostas) {
    const { t, q } = await this.#minhaTentativa(ctx, tentativaId)
    if (t.entregueEm) throw new Conflito('Esta tentativa já foi entregue.')
    if (!dentroDoTempo(t, this.relogio.agora())) throw new Conflito('O tempo terminou.')
    await this.recursos.guardarRespostas(t.id, limparRespostas(this.#paraOriginal(q, t, respostas), perguntasDaTentativa(q.perguntas, t)))
    return { guardado: true }
  }

  /*
    Entrega: dentro do tempo contam as respostas enviadas; fora do tempo só as que foram
    guardadas antes do fim (o servidor é que manda no relógio). Com dissertações, a nota
    espera pela correção do docente.
  */
  async entregar(ctx, tentativaId, respostas) {
    const { t, q } = await this.#minhaTentativa(ctx, tentativaId)
    if (t.entregueEm) throw new Conflito('Esta tentativa já foi entregue.')
    const agora = this.relogio.agora()
    const noTempo = dentroDoTempo(t, agora)
    const perguntas = perguntasDaTentativa(q.perguntas, t)
    const finais = noTempo && respostas ? limparRespostas(this.#paraOriginal(q, t, respostas), perguntas) : t.respostas
    const r = corrigir(perguntas, finais)
    const entregueEm = noTempo ? agora : new Date(t.limite)
    if (!(await this.recursos.entregarTentativa(t.id, { respostas: finais, nota: r.nota, porCorrigir: r.porCorrigir, entregueEm }))) throw new Conflito('Esta tentativa já foi entregue.')
    // se o questionário conta para uma componente da pauta, a pauta fica atualizada
    await this.pautas?.sincronizar(q.cadeira)
    await this.auditoria.registar(ctx, { acao: 'entregar_questionario', colecao: 'questionarios', alvoId: q.id, alvoTitulo: q.titulo, detalhes: { nota: r.nota, tentativa: t.numero }, utilizador: quem(ctx.conta) })
    if (r.porCorrigir) {
      await this.notificacoes?.notificar(q.cadeira.docentes.map((d) => d.id), {
        tipo: 'questionario', titulo: `Dissertação por corrigir: ${q.titulo}`, texto: `${ctx.conta.nome} entregou (${q.cadeira.nome}).`,
        ligacao: `/cadeiras/${q.cadeira.id}?atividade=questionario-${q.id}`,
      })
    }
    return { ...this.#resultado(q, { ...t, respostas: finais, nota: r.nota, manuais: {} }), foraDeTempo: !noTempo }
  }

  // revisão de uma tentativa entregue (com as corretas, se o docente o permitir)
  async revisao(ctx, tentativaId) {
    const { t, q } = await this.#minhaTentativa(ctx, tentativaId)
    if (!t.entregueEm) throw new Conflito('A tentativa ainda não foi entregue.')
    return { tentativa: { id: t.id, numero: t.numero, entregueEm: t.entregueEm, respostas: this.#paraMostrado(q, t, t.respostas) }, perguntas: this.#semSolucao(q, t), ...this.#resultado(q, t) }
  }
}
