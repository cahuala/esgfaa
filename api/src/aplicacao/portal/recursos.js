import { Conflito, ErroValidacao, NaoEncontrado, SemPermissao } from '../../dominio/comum/erros.js'
import {
  TIPOS_EVENTO_CADEIRA, expandirAulas, intervaloCalendario, texto, validarEvento,
} from '../../dominio/academico/regras.js'
import {
  TIPOS_COM_OPCOES, corrigir, dentroDoTempo, estadoQuestionario, estatisticas, limiteTentativa, limparRespostas, perguntasDaTentativa,
  sortearTentativa, validarPergunta,
} from '../../dominio/academico/questionarios.js'

// código de verificação legível (sem letras que se confundem: 0/O, 1/I)
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const novoCodigo = () => [...crypto.getRandomValues(new Uint8Array(12))].map((b) => ALFABETO[b % ALFABETO.length]).join('')

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
  constructor({ academico, recursos, inqueritos, workshops, registos, privados, acesso, notificacoes, pautas, disponibilidade, auditoria, relogio }) {
    Object.assign(this, { academico, recursos, inqueritos, workshops, registos, privados, acesso, notificacoes, pautas, disponibilidade, auditoria, relogio })
  }

  async #avisarEstudantes(ctx, cadeira, secaoId, dados) {
    if (!this.notificacoes) return
    if (secaoId && !(await this.academico.secao(secaoId))?.visivel) return
    await this.notificacoes.notificar(await this.notificacoes.estudantesDaCadeira(cadeira), dados, { excepto: ctx.conta.id })
  }

  // ======================= fórum =======================

  async topicos(ctx, cadeiraId, { q } = {}) {
    const c = await this.acesso.acessivel(ctx.conta, cadeiraId)
    const termo = String(q || '').trim().slice(0, 100)
    return this.recursos.topicos(c.id, termo.length >= 2 ? { q: termo } : {})
  }

  async #topico(ctx, id) {
    const t = await this.recursos.topico(id)
    if (!t) throw new NaoEncontrado('Tópico não encontrado.')
    const cadeira = await this.acesso.acessivel(ctx.conta, t.cadeiraId).catch(() => { throw new NaoEncontrado('Tópico não encontrado.') })
    return { t, cadeira, docente: ctx.conta.tipo === 'docente' }
  }

  // quem recebe avisos de um tópico: quem o segue, quem escreveu nele (se não deixou de seguir) e quem segue o fórum
  async #seguidores(t) {
    const [{ ativas, inativas }, doForum] = await Promise.all([this.recursos.subscricoesDoTopico(t.id), this.recursos.subscritoresDoForum(t.cadeiraId)])
    const fora = new Set(inativas)
    const implicitos = [t.autor.id, ...t.respostas.map((r) => r.autor.id)].filter((id) => !fora.has(id))
    return [...new Set([...ativas, ...implicitos, ...doForum.filter((id) => !fora.has(id))])]
  }

  /*
    Tópico com as respostas. Em "perguntas e respostas", o estudante só vê as respostas dos colegas
    depois de responder (como no Moodle). Diz também se quem pede segue o tópico.
  */
  async topico(ctx, id) {
    const { t, docente } = await this.#topico(ctx, id)
    await this.registos?.registar(ctx.conta, t.cadeiraId, 'forum', t.id)
    const seguidores = await this.#seguidores(t)
    const r = { ...t, seguido: seguidores.includes(ctx.conta.id), podeEditar: this.#podeEditar(ctx, t) }
    r.respostas = t.respostas.map((x) => ({ ...x, podeEditar: this.#podeEditar(ctx, x) }))
    if (t.tipo === 'pergunta' && !docente && t.autor.id !== ctx.conta.id && !t.respostas.some((x) => x.autor.id === ctx.conta.id)) {
      return { ...r, respostas: [], respostasEscondidas: t.respostas.length }
    }
    return r
  }

  // o autor edita durante 30 minutos; o docente da cadeira sempre
  #podeEditar(ctx, mensagem) {
    if (ctx.conta.tipo === 'docente') return true
    return mensagem.autor.id === ctx.conta.id && this.relogio.agora() - new Date(mensagem.criadoEm) < 30 * 60_000
  }

  async #anexos(ficheiros, contaId) {
    if (ficheiros.length > 3) throw new ErroValidacao('No máximo 3 anexos por mensagem.', { campo: 'ficheiros' })
    const ids = []
    for (const f of ficheiros) {
      if (!this.privados.confirmarTipo(f.caminho, f.tipo)) throw new ErroValidacao(`O ficheiro "${f.nome}" não corresponde ao tipo indicado.`, { campo: 'ficheiros' })
      const id = f.caminho.split(/[\\/]/).pop().split('.')[0]
      await this.academico.criarFicheiro({ id, caminho: this.privados.relativo(f.caminho), nome: f.nome, tipo: f.tipo, tamanho: f.tamanho, donoId: contaId })
      ids.push(id)
    }
    return ids
  }

  #largar(ficheiros) {
    for (const f of ficheiros) this.privados?.apagar(f.caminho)
  }

  async criarTopico(ctx, cadeiraId, dados, ficheiros = []) {
    try {
      const c = await this.acesso.acessivel(ctx.conta, cadeiraId)
      const tipo = dados.tipo === 'pergunta' ? 'pergunta' : 'discussao'
      if (tipo === 'pergunta' && ctx.conta.tipo !== 'docente') throw new SemPermissao('Só o docente abre tópicos de perguntas e respostas.')
      const campos = {
        cadeiraId: c.id, autorId: ctx.conta.id, tipo, criadoEm: this.relogio.agora(), atividadeEm: this.relogio.agora(),
        titulo: texto(dados.titulo, 'titulo', 'Assunto', { min: 3, max: 200 }),
        texto: texto(dados.texto, 'texto', 'Mensagem', { min: 2, max: 10_000 }),
      }
      const t = await this.recursos.criarTopico(campos, await this.#anexos(ficheiros, ctx.conta.id))
      const avisar = ctx.conta.tipo === 'docente' ? await this.notificacoes?.estudantesDaCadeira(c) ?? [] : await this.recursos.subscritoresDoForum(c.id)
      await this.notificacoes?.notificar([...new Set([...avisar, ...(await this.recursos.subscritoresDoForum(c.id))])], {
        tipo: 'forum', titulo: `${tipo === 'pergunta' ? 'Pergunta' : 'Novo tópico'} no fórum de ${c.nome}: ${campos.titulo}`, texto: `${ctx.conta.nome}: ${campos.texto.slice(0, 200)}`,
        ligacao: `/cadeiras/${c.id}?separador=forum&topico=${t.id}`,
      }, { excepto: ctx.conta.id })
      return this.recursos.topico(t.id)
    } catch (e) {
      this.#largar(ficheiros)
      throw e
    }
  }

  async responder(ctx, topicoId, { texto: corpo }, ficheiros = []) {
    try {
      const { t, cadeira, docente } = await this.#topico(ctx, topicoId)
      if (t.fechado && !docente) throw new Conflito('Este tópico está fechado a novas respostas.')
      const resposta = texto(corpo, 'texto', 'Resposta', { min: 1, max: 10_000 })
      const seguidores = await this.#seguidores(t)
      await this.recursos.responder({ topicoId: t.id, autorId: ctx.conta.id, texto: resposta, criadoEm: this.relogio.agora() }, await this.#anexos(ficheiros, ctx.conta.id))
      await this.notificacoes?.notificar(seguidores, {
        tipo: 'forum', titulo: `${ctx.conta.nome} respondeu em "${t.titulo}"`, texto: `${cadeira.nome}: ${resposta.slice(0, 200)}`,
        ligacao: `/cadeiras/${cadeira.id}?separador=forum&topico=${t.id}`,
      }, { excepto: ctx.conta.id })
      return this.topico(ctx, t.id)
    } catch (e) {
      this.#largar(ficheiros)
      throw e
    }
  }

  async editarTopico(ctx, topicoId, dados) {
    const { t } = await this.#topico(ctx, topicoId)
    if (!this.#podeEditar(ctx, t)) throw new SemPermissao('Só pode editar as suas mensagens nos primeiros 30 minutos.')
    await this.recursos.atualizarTopico(t.id, {
      ...(dados.titulo !== undefined ? { titulo: texto(dados.titulo, 'titulo', 'Assunto', { min: 3, max: 200 }) } : {}),
      ...(dados.texto !== undefined ? { texto: texto(dados.texto, 'texto', 'Mensagem', { min: 2, max: 10_000 }) } : {}),
      editadoEm: this.relogio.agora(),
    })
    return this.topico(ctx, t.id)
  }

  async editarResposta(ctx, id, { texto: corpo }) {
    const r = await this.recursos.resposta(id)
    if (!r) throw new NaoEncontrado('Resposta não encontrada.')
    await this.acesso.acessivel(ctx.conta, r.topico.cadeiraId).catch(() => { throw new NaoEncontrado('Resposta não encontrada.') })
    if (!this.#podeEditar(ctx, { autor: { id: r.autorId }, criadoEm: r.criadoEm })) throw new SemPermissao('Só pode editar as suas mensagens nos primeiros 30 minutos.')
    await this.recursos.editarResposta(r.id, texto(corpo, 'texto', 'Resposta', { min: 1, max: 10_000 }))
    return this.topico(ctx, r.topico.id)
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

  // resposta certa: quem abriu o tópico ou o docente (null retira)
  async marcarCerta(ctx, topicoId, { respostaId }) {
    const { t, docente } = await this.#topico(ctx, topicoId)
    if (!docente && t.autor.id !== ctx.conta.id) throw new SemPermissao('Só quem abriu o tópico ou o docente marca a resposta certa.')
    const id = respostaId === null || respostaId === undefined ? null : Number(respostaId)
    if (id !== null && !t.respostas.some((r) => r.id === id)) throw new ErroValidacao('A resposta não é deste tópico.', { campo: 'respostaId' })
    await this.recursos.atualizarTopico(t.id, { respostaCertaId: id })
    const certa = t.respostas.find((r) => r.id === id)
    if (certa) {
      await this.notificacoes?.notificar([certa.autor.id], {
        tipo: 'forum', titulo: `A sua resposta em "${t.titulo}" foi marcada como certa`, texto: '', ligacao: `/cadeiras/${t.cadeiraId}?separador=forum&topico=${t.id}`,
      }, { excepto: ctx.conta.id })
    }
    return this.topico(ctx, t.id)
  }

  async seguirTopico(ctx, topicoId, { ativa }) {
    const { t } = await this.#topico(ctx, topicoId)
    await this.recursos.definirSubscricaoTopico(t.id, ctx.conta.id, Boolean(ativa))
    return { seguido: Boolean(ativa) }
  }

  async subscricaoForum(ctx, cadeiraId) {
    const c = await this.acesso.acessivel(ctx.conta, cadeiraId)
    return { seguido: await this.recursos.subscritoForum(c.id, ctx.conta.id) }
  }

  async seguirForum(ctx, cadeiraId, { ativa }) {
    const c = await this.acesso.acessivel(ctx.conta, cadeiraId)
    await this.recursos.definirSubscricaoForum(c.id, ctx.conta.id, Boolean(ativa))
    return { seguido: Boolean(ativa) }
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
    await this.disponibilidade?.exigir(m.cadeiraId, ctx.conta.id, 'material', m.id)
    await this.recursos.marcarConclusao(m.id, ctx.conta.id, Boolean(concluido))
    if (concluido) await this.registos?.registar(ctx.conta, m.cadeiraId, 'material', m.id)
    return this.progresso(ctx, m.cadeiraId)
  }

  // atividades da cadeira que contam para o progresso: materiais, trabalhos e questionários publicados
  async #atividades(cadeiraId) {
    const [todos, trab, quest, inq, ws, secoes] = await Promise.all([
      this.academico.materiais(cadeiraId),
      this.academico.trabalhos(cadeiraId),
      this.recursos.questionarios(cadeiraId, { soPublicados: true }),
      this.inqueritos ? this.inqueritos.inqueritos(cadeiraId) : [],
      this.workshops ? this.workshops.workshops(cadeiraId) : [],
      this.academico.secoes(cadeiraId),
    ])
    // o que está em capítulos escondidos ainda não conta
    const escondidos = new Set(secoes.filter((x) => !x.visivel).map((x) => x.id))
    const [materiais, trabalhos, questionarios, inqueritos, workshops] = [todos, trab, quest, inq, ws].map((l) => l.filter((a) => !escondidos.has(a.secaoId) && a.visivel !== false))
    return [
      ...materiais.map((m) => ({ tipo: 'material', id: m.id, titulo: m.titulo })),
      ...trabalhos.map((t) => ({ tipo: 'trabalho', id: t.id, titulo: t.titulo })),
      ...questionarios.map((q) => ({ tipo: 'questionario', id: q.id, titulo: q.titulo })),
      ...inqueritos.map((i) => ({ tipo: 'inquerito', id: i.id, titulo: i.titulo })),
      ...workshops.map((w) => ({ tipo: 'workshop', id: w.id, titulo: w.titulo })),
    ]
  }

  async #feitasPor(estudanteId, atividades) {
    const ids = (tipo) => atividades.filter((a) => a.tipo === tipo).map((a) => a.id)
    const [materiais, entregas, tentativas, respondidos, submetidos] = await Promise.all([
      this.recursos.conclusoesDoEstudante(estudanteId, ids('material')),
      this.academico.entregasDoEstudante(estudanteId, ids('trabalho')),
      this.recursos.tentativasDoEstudante(estudanteId, ids('questionario')),
      this.inqueritos ? this.inqueritos.respondidos(estudanteId, ids('inquerito')) : new Set(),
      this.workshops ? this.workshops.estadoDoEstudante(estudanteId, ids('workshop')) : {},
    ])
    const questionarios = new Set(tentativas.filter((t) => t.entregueEm).map((t) => t.questionarioId))
    return atividades.map((a) => ({
      ...a,
      feita: a.tipo === 'material' ? materiais.has(a.id) : a.tipo === 'trabalho' ? Boolean(entregas[a.id]) : a.tipo === 'inquerito' ? respondidos.has(a.id) : a.tipo === 'workshop' ? Boolean(submetidos[a.id]) : questionarios.has(a.id),
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

  // ---------- conclusão da cadeira e certificado ----------

  // a cadeira está concluída quando todas as atividades que contam para o progresso estão feitas
  async conclusao(ctx, cadeiraId) {
    this.acesso.soEstudante(ctx.conta)
    const p = await this.progresso(ctx, cadeiraId)
    const certificado = await this.recursos.certificadoDe(ctx.conta.id, Number(cadeiraId))
    return { feitas: p.feitas, total: p.total, percentagem: p.percentagem, concluida: p.total > 0 && p.feitas === p.total, certificado }
  }

  async emitirCertificado(ctx, cadeiraId) {
    const c = await this.conclusao(ctx, cadeiraId)
    if (c.certificado) return c.certificado
    if (!c.concluida) throw new Conflito(`Ainda faltam atividades: ${c.feitas} de ${c.total} concluídas.`)
    const cadeira = await this.academico.cadeira(cadeiraId)
    const cert = await this.recursos.emitirCertificado({ estudanteId: ctx.conta.id, cadeiraId: cadeira.id, codigo: novoCodigo() })
    await this.auditoria.registar(ctx, { acao: 'emitir_certificado', colecao: 'certificados', alvoId: cadeira.id, alvoTitulo: `${cert.codigo} — ${cadeira.nome}`, utilizador: quem(ctx.conta) })
    return cert
  }

  // verificação pública de um certificado pelo código (sem sessão)
  async verificarCertificado(codigo) {
    const c = await this.recursos.certificado(String(codigo || '').toUpperCase().replace(/[^A-Z0-9]/g, ''))
    if (!c) throw new NaoEncontrado('Certificado não encontrado. Confirme o código.')
    return c
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
      await this.#avisarEstudantes(ctx, q.cadeira, q.secaoId, {
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

  // ---------- docente: correção manual e estatísticas ----------

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

  // ---------- banco de perguntas do docente ----------

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

  // ---------- estudante ----------

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
