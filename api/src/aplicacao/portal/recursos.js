import { Conflito, ErroValidacao, NaoEncontrado, SemPermissao } from '../../dominio/comum/erros.js'
import {
  TIPOS_EVENTO_CADEIRA, expandirAulas, intervaloCalendario, texto, validarEvento,
} from '../../dominio/academico/regras.js'
import {
  corrigir, dentroDoTempo, estadoQuestionario, limiteTentativa, limparRespostas, validarPergunta,
} from '../../dominio/academico/questionarios.js'

const quem = (c) => ({ id: null, nome: `${c.nome} (portal, ${c.numero})` })
const data = (v) => {
  if (v === null || v === undefined || v === '') return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) throw new ErroValidacao('Data inválida.', { campo: 'data' })
  return d
}

/*
  Recursos de cada cadeira ao estilo do Moodle, no portal:
  fórum, calendário académico, progresso das atividades e questionários online.
  O acesso segue a regra do portal (AcessoCadeiras).
*/
export class ServicoRecursos {
  constructor({ academico, recursos, acesso, notificacoes, auditoria, relogio }) {
    Object.assign(this, { academico, recursos, acesso, notificacoes, auditoria, relogio })
  }

  async #avisarEstudantes(ctx, cadeira, secaoId, dados) {
    if (!this.notificacoes) return
    if (secaoId && !(await this.academico.secao(secaoId))?.visivel) return
    await this.notificacoes.notificar(await this.notificacoes.estudantesDaCadeira(cadeira), dados, { excepto: ctx.conta.id })
  }

  // ======================= fórum =======================

  async topicos(ctx, cadeiraId) {
    const c = await this.acesso.acessivel(ctx.conta, cadeiraId)
    return this.recursos.topicos(c.id)
  }

  async #topico(ctx, id) {
    const t = await this.recursos.topico(id)
    if (!t) throw new NaoEncontrado('Tópico não encontrado.')
    const cadeira = await this.acesso.acessivel(ctx.conta, t.cadeiraId).catch(() => { throw new NaoEncontrado('Tópico não encontrado.') })
    return { t, cadeira, docente: ctx.conta.tipo === 'docente' }
  }

  async topico(ctx, id) {
    return (await this.#topico(ctx, id)).t
  }

  async criarTopico(ctx, cadeiraId, dados) {
    const c = await this.acesso.acessivel(ctx.conta, cadeiraId)
    const t = await this.recursos.criarTopico({
      cadeiraId: c.id, autorId: ctx.conta.id,
      titulo: texto(dados.titulo, 'titulo', 'Assunto', { min: 3, max: 200 }),
      texto: texto(dados.texto, 'texto', 'Mensagem', { min: 2, max: 10_000 }),
    })
    return this.recursos.topico(t.id)
  }

  async responder(ctx, topicoId, { texto: corpo }) {
    const { t, cadeira, docente } = await this.#topico(ctx, topicoId)
    if (t.fechado && !docente) throw new Conflito('Este tópico está fechado a novas respostas.')
    const resposta = texto(corpo, 'texto', 'Resposta', { min: 1, max: 10_000 })
    await this.recursos.responder({ topicoId: t.id, autorId: ctx.conta.id, texto: resposta })
    // avisa quem abriu o tópico e quem já respondeu (como a subscrição de discussões do Moodle)
    await this.notificacoes?.notificar([t.autor.id, ...t.respostas.map((r) => r.autor.id)], {
      tipo: 'forum', titulo: `${ctx.conta.nome} respondeu em "${t.titulo}"`, texto: `${cadeira.nome}: ${resposta.slice(0, 200)}`,
      ligacao: `/cadeiras/${cadeira.id}?separador=forum`,
    }, { excepto: ctx.conta.id })
    return this.recursos.topico(t.id)
  }

  // o docente fixa no topo ou fecha o tópico
  async moderar(ctx, topicoId, { fixado, fechado }) {
    const { t, docente } = await this.#topico(ctx, topicoId)
    if (!docente) throw new SemPermissao('Só os docentes da cadeira moderam o fórum.')
    await this.recursos.atualizarTopico(t.id, {
      ...(fixado !== undefined ? { fixado: Boolean(fixado) } : {}),
      ...(fechado !== undefined ? { fechado: Boolean(fechado) } : {}),
    })
    return this.recursos.topico(t.id)
  }

  async apagarTopico(ctx, topicoId) {
    const { t, docente } = await this.#topico(ctx, topicoId)
    if (!docente && t.autor.id !== ctx.conta.id) throw new SemPermissao('Só pode apagar os seus tópicos.')
    if (!docente && t.respostas.length) throw new Conflito('O tópico já tem respostas; peça ao docente para o apagar.')
    await this.recursos.apagarTopico(t.id)
    await this.auditoria.registar(ctx, { acao: 'apagar_topico', colecao: 'forum', alvoId: t.id, alvoTitulo: t.titulo, utilizador: quem(ctx.conta) })
  }

  async apagarResposta(ctx, id) {
    const r = await this.recursos.resposta(id)
    if (!r) throw new NaoEncontrado('Resposta não encontrada.')
    await this.acesso.acessivel(ctx.conta, r.topico.cadeiraId).catch(() => { throw new NaoEncontrado('Resposta não encontrada.') })
    if (ctx.conta.tipo !== 'docente' && r.autorId !== ctx.conta.id) throw new SemPermissao('Só pode apagar as suas respostas.')
    await this.recursos.apagarResposta(r.id)
  }

  // ======================= calendário =======================

  /*
    Calendário de quem pede, entre duas datas: eventos (provas, exames, eventos gerais e da turma),
    aulas do horário (sem os feriados), prazos dos trabalhos e fecho dos questionários.
  */
  async calendario(ctx, { de, ate }) {
    const intervalo = intervaloCalendario(de, ate)
    const cadeiras = await this.acesso.minhasCadeiras(ctx.conta)
    const ids = cadeiras.map((c) => c.id)
    const turmaIds = [...new Set(cadeiras.map((c) => c.turmaId))]
    const [eventos, horarios, trabalhos, questionarios] = await Promise.all([
      this.recursos.eventos({ cadeiraIds: ids, turmaIds, ...intervalo }),
      this.academico.horariosDasCadeiras(ids),
      Promise.all(ids.map((id) => this.academico.trabalhos(id))).then((l) => l.flat()),
      Promise.all(ids.map((id) => this.recursos.questionarios(id, { soPublicados: ctx.conta.tipo === 'estudante' }))).then((l) => l.flat()),
    ])
    const nomeDe = Object.fromEntries(cadeiras.map((c) => [c.id, c.nome]))
    const feriados = eventos.filter((e) => e.tipo === 'feriado').map((e) => e.data)
    const dia = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : null)
    const dentro = (d) => d && d >= intervalo.de && d <= intervalo.ate
    const hora = (iso) => new Date(iso).toISOString().slice(11, 16)
    return [
      ...eventos.map((e) => ({
        tipo: e.tipo, id: `e${e.id}`, eventoId: e.id, data: e.data, inicio: e.inicio, fim: e.fim, titulo: e.titulo, local: e.local, descricao: e.descricao,
        cadeiraId: e.cadeiraId, cadeira: e.cadeira?.nome || null, turma: e.turma?.nome || null,
      })),
      ...expandirAulas(horarios, intervalo.de, intervalo.ate, feriados).map((a) => ({
        tipo: 'aula', id: `a${a.id}-${a.data}`, data: a.data, inicio: a.inicio, fim: a.fim, titulo: a.cadeira, local: a.sala, cadeiraId: a.cadeiraId, cadeira: a.cadeira,
      })),
      ...trabalhos.filter((t) => dentro(dia(t.prazo))).map((t) => ({
        tipo: 'prazo', id: `t${t.id}`, data: dia(t.prazo), inicio: hora(t.prazo), fim: '', momento: t.prazo, titulo: `Entrega: ${t.titulo}`, cadeiraId: t.cadeiraId, cadeira: nomeDe[t.cadeiraId],
      })),
      ...questionarios.filter((q) => dentro(dia(q.fecha))).map((q) => ({
        tipo: 'questionario', id: `q${q.id}`, data: dia(q.fecha), inicio: hora(q.fecha), fim: '', momento: q.fecha, titulo: `Questionário: ${q.titulo}`, cadeiraId: q.cadeiraId, cadeira: nomeDe[q.cadeiraId],
      })),
    ].sort((a, b) => a.data.localeCompare(b.data) || (a.inicio || '').localeCompare(b.inicio || ''))
  }

  async eventosDaCadeira(ctx, cadeiraId) {
    const c = await this.acesso.acessivel(ctx.conta, cadeiraId)
    return this.recursos.eventosDaCadeira(c.id)
  }

  // o docente marca as provas, o exame e o recurso da sua cadeira
  async criarEvento(ctx, cadeiraId, dados) {
    const c = await this.acesso.doDocente(ctx.conta, cadeiraId)
    const e = await this.recursos.criarEvento({ cadeiraId: c.id, ...validarEvento(dados, TIPOS_EVENTO_CADEIRA) })
    await this.auditoria.registar(ctx, { acao: 'marcar_evento', colecao: 'calendario', alvoId: e.id, alvoTitulo: `${e.titulo} — ${c.nome} (${e.data})`, utilizador: quem(ctx.conta) })
    await this.#avisarEstudantes(ctx, c, null, {
      tipo: 'geral', titulo: `${e.titulo} de ${c.nome} marcada`, texto: `${e.data.split('-').reverse().join('/')}${e.inicio ? `, ${e.inicio}` : ''}${e.local ? ` · ${e.local}` : ''}`,
      ligacao: `/cadeiras/${c.id}?separador=horario`,
    })
    return e
  }

  async apagarEvento(ctx, id) {
    const e = await this.recursos.evento(id)
    if (!e || !e.cadeiraId) throw new NaoEncontrado('Evento não encontrado.')
    await this.acesso.doDocente(ctx.conta, e.cadeiraId)
    await this.recursos.apagarEvento(e.id)
  }

  // ======================= progresso =======================

  async marcarConclusao(ctx, materialId, { concluido = true }) {
    this.acesso.soEstudante(ctx.conta)
    const m = await this.academico.material(materialId)
    if (!m) throw new NaoEncontrado('Material não encontrado.')
    await this.acesso.acessivel(ctx.conta, m.cadeiraId).catch(() => { throw new NaoEncontrado('Material não encontrado.') })
    await this.recursos.marcarConclusao(m.id, ctx.conta.id, Boolean(concluido))
    return this.progresso(ctx, m.cadeiraId)
  }

  // atividades da cadeira que contam para o progresso: materiais, trabalhos e questionários publicados
  async #atividades(cadeiraId) {
    const [todos, trab, quest, secoes] = await Promise.all([
      this.academico.materiais(cadeiraId),
      this.academico.trabalhos(cadeiraId),
      this.recursos.questionarios(cadeiraId, { soPublicados: true }),
      this.academico.secoes(cadeiraId),
    ])
    // o que está em capítulos escondidos ainda não conta
    const escondidos = new Set(secoes.filter((x) => !x.visivel).map((x) => x.id))
    const [materiais, trabalhos, questionarios] = [todos, trab, quest].map((l) => l.filter((a) => !escondidos.has(a.secaoId)))
    return [
      ...materiais.map((m) => ({ tipo: 'material', id: m.id, titulo: m.titulo })),
      ...trabalhos.map((t) => ({ tipo: 'trabalho', id: t.id, titulo: t.titulo })),
      ...questionarios.map((q) => ({ tipo: 'questionario', id: q.id, titulo: q.titulo })),
    ]
  }

  async #feitasPor(estudanteId, atividades) {
    const ids = (tipo) => atividades.filter((a) => a.tipo === tipo).map((a) => a.id)
    const [materiais, entregas, tentativas] = await Promise.all([
      this.recursos.conclusoesDoEstudante(estudanteId, ids('material')),
      this.academico.entregasDoEstudante(estudanteId, ids('trabalho')),
      this.recursos.tentativasDoEstudante(estudanteId, ids('questionario')),
    ])
    const questionarios = new Set(tentativas.filter((t) => t.entregueEm).map((t) => t.questionarioId))
    return atividades.map((a) => ({
      ...a,
      feita: a.tipo === 'material' ? materiais.has(a.id) : a.tipo === 'trabalho' ? Boolean(entregas[a.id]) : questionarios.has(a.id),
    }))
  }

  /*
    Progresso: para o estudante, as suas atividades feitas; para o docente,
    o relatório da turma (estudantes × atividades), como o "Activity completion" do Moodle.
  */
  async progresso(ctx, cadeiraId) {
    const c = await this.acesso.acessivel(ctx.conta, cadeiraId)
    const atividades = await this.#atividades(c.id)
    const resumo = (itens) => {
      const feitas = itens.filter((i) => i.feita).length
      return { feitas, total: itens.length, percentagem: itens.length ? Math.round((feitas / itens.length) * 100) : null }
    }
    if (ctx.conta.tipo === 'estudante') {
      const itens = await this.#feitasPor(ctx.conta.id, atividades)
      return { itens, ...resumo(itens) }
    }
    const estudantes = await this.academico.estudantesAtivosDaTurma(c.turmaId)
    const linhas = await Promise.all(estudantes.map(async (e) => {
      const itens = await this.#feitasPor(e.id, atividades)
      return { estudante: e, concluidas: itens.filter((i) => i.feita).map((i) => `${i.tipo}-${i.id}`), ...resumo(itens) }
    }))
    return { atividades, linhas }
  }

  // percentagem de cada cadeira do estudante (para o painel e a lista de cadeiras)
  async progressoGeral(ctx) {
    this.acesso.soEstudante(ctx.conta)
    const cadeiras = await this.acesso.minhasCadeiras(ctx.conta)
    const pares = await Promise.all(cadeiras.map(async (c) => {
      const itens = await this.#feitasPor(ctx.conta.id, await this.#atividades(c.id))
      const feitas = itens.filter((i) => i.feita).length
      return [c.id, { feitas, total: itens.length, percentagem: itens.length ? Math.round((feitas / itens.length) * 100) : null }]
    }))
    return Object.fromEntries(pares)
  }

  // ======================= questionários =======================

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
    const abre = r.abre !== undefined ? r.abre : atual.abre && new Date(atual.abre)
    const fecha = r.fecha !== undefined ? r.fecha : atual.fecha && new Date(atual.fecha)
    if (abre && fecha && abre >= fecha) throw new ErroValidacao('O fecho tem de ser depois da abertura.', { campo: 'fecha' })
    return r
  }

  async #questionarioDoDocente(ctx, id) {
    const q = await this.recursos.questionario(id)
    if (!q) throw new NaoEncontrado('Questionário não encontrado.')
    await this.acesso.doDocente(ctx.conta, q.cadeiraId)
    return q
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
      return { ...q, estado: estadoQuestionario(q, agora), feitas: t.length, melhorNota: t.length ? Math.max(...t.map((x) => x.nota)) : null }
    })
  }

  async #secaoDe(cadeiraId, secaoId) {
    if (secaoId === undefined || secaoId === null || secaoId === '') return null
    const s = await this.academico.secao(secaoId)
    if (!s || s.cadeiraId !== cadeiraId) throw new ErroValidacao('Capítulo inválido.', { campo: 'secaoId' })
    return s.id
  }

  async criarQuestionario(ctx, cadeiraId, dados) {
    const c = await this.acesso.doDocente(ctx.conta, cadeiraId)
    return this.recursos.criarQuestionario({ cadeiraId: c.id, secaoId: await this.#secaoDe(c.id, dados.secaoId), ...this.#dadosQuestionario(dados) })
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
      const cadeira = await this.academico.cadeira(q.cadeiraId)
      await this.#avisarEstudantes(ctx, cadeira, q.secaoId, {
        tipo: 'questionario', titulo: `Novo questionário em ${cadeira.nome}: ${q.titulo}`, texto: r.fecha ? `Fecha em ${new Date(r.fecha).toLocaleString('pt-PT', { timeZone: 'Africa/Luanda', dateStyle: 'short', timeStyle: 'short' })}` : '',
        ligacao: `/cadeiras/${cadeira.id}?atividade=questionario-${q.id}`,
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
    const q = await this.#questionarioDoDocente(ctx, id)
    const tentativas = await this.recursos.tentativas(q.id)
    return { ...q, resultados: tentativas.filter((t) => t.entregueEm).map((t) => ({ id: t.id, estudante: t.estudante, numero: t.numero, nota: t.nota, entregueEm: t.entregueEm })) }
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

  // ---------- estudante ----------

  async #questionarioDoEstudante(ctx, id) {
    this.acesso.soEstudante(ctx.conta)
    const q = await this.recursos.questionario(id)
    if (!q || !q.publicado) throw new NaoEncontrado('Questionário não encontrado.')
    await this.acesso.acessivel(ctx.conta, q.cadeiraId).catch(() => { throw new NaoEncontrado('Questionário não encontrado.') })
    return q
  }

  // perguntas como o estudante as vê: sem dizer quais são as corretas
  #semSolucao(q) {
    return q.perguntas.map((p) => ({ id: p.id, enunciado: p.enunciado, tipo: p.tipo, pontos: p.pontos, opcoes: p.opcoes.map((o) => o.texto) }))
  }

  #resultado(q, t) {
    const r = corrigir(q.perguntas, t.respostas)
    return {
      nota: t.nota, obtidos: r.obtidos, total: r.total,
      ...(q.mostrarRespostas ? { correcao: r.detalhe } : {}),
    }
  }

  // tentativas que passaram o tempo sem ser entregues fecham-se com as respostas guardadas
  async #fecharExpiradas(q, tentativas) {
    const agora = this.relogio.agora()
    for (const t of tentativas) {
      if (!t.entregueEm && !dentroDoTempo(t, agora)) {
        const { nota } = corrigir(q.perguntas, t.respostas)
        await this.recursos.entregarTentativa(t.id, { respostas: t.respostas, nota, entregueEm: new Date(t.limite) })
      }
    }
  }

  async verQuestionario(ctx, id) {
    const q = await this.#questionarioDoEstudante(ctx, id)
    await this.#fecharExpiradas(q, await this.recursos.tentativas(q.id, ctx.conta.id))
    const tentativas = await this.recursos.tentativas(q.id, ctx.conta.id)
    const emCurso = tentativas.find((t) => !t.entregueEm)
    const feitas = tentativas.filter((t) => t.entregueEm)
    return {
      id: q.id, titulo: q.titulo, descricao: q.descricao, abre: q.abre, fecha: q.fecha, duracao: q.duracao, tentativas: q.tentativas,
      numeroPerguntas: q.perguntas.length, pontos: q.perguntas.reduce((s, p) => s + p.pontos, 0),
      estado: estadoQuestionario(q, this.relogio.agora()),
      feitas: feitas.map((t) => ({ id: t.id, numero: t.numero, nota: t.nota, entregueEm: t.entregueEm })),
      emCurso: emCurso ? { ...emCurso, perguntas: this.#semSolucao(q) } : null,
    }
  }

  async iniciar(ctx, id) {
    const q = await this.#questionarioDoEstudante(ctx, id)
    const agora = this.relogio.agora()
    await this.#fecharExpiradas(q, await this.recursos.tentativas(q.id, ctx.conta.id))
    const tentativas = await this.recursos.tentativas(q.id, ctx.conta.id)
    const emCurso = tentativas.find((t) => !t.entregueEm)
    if (emCurso) return { ...emCurso, perguntas: this.#semSolucao(q) }
    const estado = estadoQuestionario(q, agora)
    if (estado !== 'aberto') throw new Conflito(estado === 'em_breve' ? 'O questionário ainda não abriu.' : 'O questionário já fechou.')
    if (tentativas.length >= q.tentativas) throw new Conflito('Já usou todas as tentativas.')
    let t
    try {
      t = await this.recursos.iniciarTentativa({ questionarioId: q.id, estudanteId: ctx.conta.id, numero: tentativas.length + 1, iniciadaEm: agora, limite: limiteTentativa(q, agora) })
    } catch {
      throw new Conflito('A tentativa já foi iniciada noutra janela. Recarregue a página.')
    }
    return { ...t, perguntas: this.#semSolucao(q) }
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
    await this.recursos.guardarRespostas(t.id, limparRespostas(respostas, q.perguntas))
    return { guardado: true }
  }

  /*
    Entrega: dentro do tempo contam as respostas enviadas; fora do tempo só as que foram
    guardadas antes do fim (o servidor é que manda no relógio).
  */
  async entregar(ctx, tentativaId, respostas) {
    const { t, q } = await this.#minhaTentativa(ctx, tentativaId)
    if (t.entregueEm) throw new Conflito('Esta tentativa já foi entregue.')
    const agora = this.relogio.agora()
    const noTempo = dentroDoTempo(t, agora)
    const finais = noTempo && respostas ? limparRespostas(respostas, q.perguntas) : t.respostas
    const { nota } = corrigir(q.perguntas, finais)
    const entregueEm = noTempo ? agora : new Date(t.limite)
    if (!(await this.recursos.entregarTentativa(t.id, { respostas: finais, nota, entregueEm }))) throw new Conflito('Esta tentativa já foi entregue.')
    await this.auditoria.registar(ctx, { acao: 'entregar_questionario', colecao: 'questionarios', alvoId: q.id, alvoTitulo: q.titulo, detalhes: { nota, tentativa: t.numero }, utilizador: quem(ctx.conta) })
    return { ...this.#resultado(q, { ...t, respostas: finais, nota }), foraDeTempo: !noTempo }
  }

  // revisão de uma tentativa entregue (com as corretas, se o docente o permitir)
  async revisao(ctx, tentativaId) {
    const { t, q } = await this.#minhaTentativa(ctx, tentativaId)
    if (!t.entregueEm) throw new Conflito('A tentativa ainda não foi entregue.')
    return { tentativa: { id: t.id, numero: t.numero, entregueEm: t.entregueEm, respostas: t.respostas }, perguntas: this.#semSolucao(q), ...this.#resultado(q, t) }
  }
}
