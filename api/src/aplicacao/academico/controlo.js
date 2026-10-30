import { Conflito, ErroValidacao, NaoEncontrado } from '../../dominio/comum/erros.js'
import { texto } from '../../dominio/academico/comum/validacao.js'
import { COMPONENTES_NOTA, NOMES_COMPONENTES } from '../../dominio/academico/avaliacao/resultado.js'
import { quem } from './partilhado/autor.js'

// enunciados: PDF ou Word (a Repartição imprime a partir do ficheiro)
const TIPOS_ENUNCIADO = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
const DATA = /^\d{4}-\d{2}-\d{2}$/
const nota = (v) => (v === null || v === undefined || v === '' ? null : Number(v))

/*
  Controlo académico centralizado:
  - provas escritas: o docente envia o enunciado; a Repartição de Administração Escolar imprime uma cópia
    por estudante e marca como impressa (o docente é avisado). Os estudantes nunca veem o ficheiro;
  - alteração de notas já publicadas: o docente pede para um ou mais estudantes, com o motivo; o Comandante
    autoriza ou recusa cada um; com a autorização, o docente muda a nota desse estudante uma vez;
  - docentes: os que o Pessoal e Quadros regista chegam ao Comandante, que verifica a lista.
*/
export class ServicoControloAcademico {
  constructor(dependencias) {
    Object.assign(this, dependencias)
  }

  // ---------- provas escritas (docente) ----------

  async enunciadosDaCadeira(ctx, cadeiraId) {
    const c = await this.apoio.cadeiraDoDocente(ctx.conta, cadeiraId)
    return this.controlo.enunciados({ cadeiraId: c.id })
  }

  async enviarEnunciado(ctx, cadeiraId, dados, ficheiro) {
    try {
      const c = await this.apoio.cadeiraDoDocente(ctx.conta, cadeiraId)
      if (!ficheiro) throw new ErroValidacao('Escolha o ficheiro da prova (PDF ou Word).', { campo: 'ficheiro' })
      if (!TIPOS_ENUNCIADO.includes(ficheiro.tipo)) throw new ErroValidacao('A prova tem de ser um PDF ou um documento Word.', { campo: 'ficheiro' })
      const data = dados.data ? String(dados.data) : null
      if (data && !DATA.test(data)) throw new ErroValidacao('Data inválida.', { campo: 'data' })
      const estudantes = (await this.academico.estudantesDaPautaDaCadeira(c)).length
      const copias = dados.copias === undefined || dados.copias === '' ? estudantes : Math.round(Number(dados.copias))
      if (!Number.isFinite(copias) || copias < 1 || copias > 1000) throw new ErroValidacao('Indique quantas cópias (1 a 1000).', { campo: 'copias' })
      const e = await this.controlo.criarEnunciado({
        cadeiraId: c.id, enviadoPor: ctx.conta.id, data, copias,
        titulo: texto(dados.titulo, 'titulo', 'Prova', { min: 2, max: 200 }),
        observacoes: texto(dados.observacoes, 'observacoes', 'Observações', { max: 1000, obrigatorio: false }),
        ficheiroId: await this.apoio.registarFicheiro(ficheiro, ctx.conta.id),
      })
      await this.auditoria.registar(ctx, { acao: 'enviar_prova_escrita', colecao: 'provas', alvoId: c.id, alvoTitulo: `${e.titulo} — ${c.nome}`, detalhes: { copias }, utilizador: quem(ctx.conta) })
      return e
    } catch (erro) {
      if (ficheiro) this.privados.apagar(ficheiro.caminho)
      throw erro
    }
  }

  async apagarEnunciado(ctx, id) {
    const e = await this.controlo.enunciado(id)
    if (!e) throw new NaoEncontrado('Prova não encontrada.')
    const c = await this.apoio.cadeiraDoDocente(ctx.conta, e.cadeiraId)
    if (e.estado !== 'enviado') throw new Conflito('A prova já foi impressa pela Repartição: já não se retira.')
    await this.controlo.apagarEnunciado(e.id)
    await this.auditoria.registar(ctx, { acao: 'retirar_prova_escrita', colecao: 'provas', alvoId: c.id, alvoTitulo: `${e.titulo} — ${c.nome}`, utilizador: quem(ctx.conta) })
  }

  // ---------- provas escritas (Repartição de Administração Escolar, no painel) ----------

  paraImprimir(ctx, { estado } = {}) {
    ctx.actor.exigir('academico.ver')
    return this.controlo.enunciados({ estado: ['enviado', 'impresso'].includes(estado) ? estado : undefined })
  }

  async marcarImpresso(ctx, id, impresso = true) {
    ctx.actor.exigir('academico.gerir')
    const e = await this.controlo.enunciado(id)
    if (!e) throw new NaoEncontrado('Prova não encontrada.')
    const r = await this.controlo.atualizarEnunciado(e.id, impresso
      ? { estado: 'impresso', impressoPor: ctx.actor.nome ?? '', impressoEm: this.relogio.agora() }
      : { estado: 'enviado', impressoPor: '', impressoEm: null })
    const c = await this.academico.cadeira(e.cadeiraId)
    await this.auditoria.registar(ctx, { acao: impresso ? 'imprimir_prova_escrita' : 'reabrir_prova_escrita', colecao: 'provas', alvoId: e.cadeiraId, alvoTitulo: `${e.titulo} — ${c?.nome ?? ''}`, detalhes: { copias: e.copias } })
    if (impresso && e.enviadoPor) {
      await this.notificacoes?.notificar([e.enviadoPor], { tipo: 'prova', titulo: `Prova impressa: ${e.titulo}`, texto: `${e.copias} cópia(s) — ${c?.nome ?? ''}. Levante-as na Repartição de Administração Escolar.`, ligacao: `/cadeiras/${e.cadeiraId}?separador=avaliacoes` })
    }
    return r
  }

  // ---------- alteração de notas publicadas (docente) ----------

  // { avaliacaoId } (prova do plano de curso) ou { componente } (pauta clássica): tem de estar publicada
  async #alvo(cadeira, { avaliacaoId, componente }) {
    if (avaliacaoId) {
      const a = await this.planos.avaliacao(Number(avaliacaoId))
      if (!a || a.cadeiraId !== cadeira.id) throw new NaoEncontrado('Prova não encontrada.')
      if (!a.publicadaEm) throw new ErroValidacao('As notas desta prova ainda não foram publicadas: pode alterá-las sem pedir.')
      const notas = (await this.planos.notas([a.id]))[a.id] ?? {}
      return { chave: { avaliacaoId: a.id }, nome: `${a.tipo} ${a.titulo}`, atual: (id) => notas[id]?.nota ?? null }
    }
    if (!COMPONENTES_NOTA.includes(componente)) throw new ErroValidacao('Escolha a prova.', { campo: 'componente' })
    if (!(cadeira.notasPublicadas ?? []).includes(componente)) throw new ErroValidacao('As notas desta prova ainda não foram publicadas: pode alterá-las sem pedir.')
    const pauta = await this.academico.pautaDaCadeira(cadeira.id)
    return { chave: { componente }, nome: NOMES_COMPONENTES[componente], atual: (id) => nota(pauta[id]?.[componente]) }
  }

  async pedidosDaCadeira(ctx, cadeiraId) {
    const c = await this.apoio.cadeiraDoDocente(ctx.conta, cadeiraId)
    return this.controlo.pedidos({ cadeiraId: c.id })
  }

  async pedirAlteracao(ctx, cadeiraId, { avaliacaoId, componente, estudanteIds, motivo }) {
    const c = await this.apoio.cadeiraDoDocente(ctx.conta, cadeiraId)
    const alvo = await this.#alvo(c, { avaliacaoId, componente })
    const m = texto(motivo, 'motivo', 'Motivo', { min: 10, max: 1000 })
    const validos = new Set((await this.academico.estudantesDaPautaDaCadeira(c)).map((e) => e.id))
    const ids = [...new Set((Array.isArray(estudanteIds) ? estudanteIds : []).map(Number))]
    if (!ids.length) throw new ErroValidacao('Escolha o estudante ou os estudantes.', { campo: 'estudanteIds' })
    if (ids.some((id) => !validos.has(id))) throw new ErroValidacao('Um dos estudantes não pertence à pauta desta cadeira.')
    const novos = []
    for (const id of ids) {
      if (await this.controlo.pedidoAberto(c.id, alvo.chave, id)) continue // já pedido (ou já autorizado)
      novos.push({ cadeiraId: c.id, ...alvo.chave, estudanteId: id, notaAtual: alvo.atual(id), motivo: m, pedidoPor: ctx.conta.id, pedidoEm: this.relogio.agora() })
    }
    if (!novos.length) throw new Conflito('Já há um pedido em aberto para estes estudantes nesta prova.')
    await this.controlo.criarPedidos(novos)
    await this.auditoria.registar(ctx, { acao: 'pedir_alteracao_nota', colecao: 'pautas', alvoId: c.id, alvoTitulo: `${alvo.nome} — ${c.nome}`, detalhes: { estudantes: novos.length }, utilizador: quem(ctx.conta) })
    return this.controlo.pedidos({ cadeiraId: c.id })
  }

  /*
    Ao gravar notas publicadas (docente, no portal): cada nota que muda tem de ter uma autorização do
    Comandante para esse estudante; a autorização gasta-se. Devolve os pedidos a marcar como usados.
  */
  async exigirAutorizacoes(cadeira, chave, mudancas, nomeProva) {
    const usar = []
    const sem = []
    for (const m of mudancas) {
      const p = await this.controlo.pedidoAberto(cadeira.id, chave, m.estudanteId, ['autorizado'])
      if (p) usar.push({ id: p.id, notaNova: m.nota })
      else sem.push(m.estudanteId)
    }
    if (sem.length) {
      const nomes = (await this.academico.estudantesDaPautaDaCadeira(cadeira)).filter((e) => sem.includes(e.id)).map((e) => e.nome)
      throw new Conflito(`As notas de ${nomeProva} já foram publicadas: para mudar a de ${nomes.join(', ')} peça a alteração ao Comandante.`)
    }
    return usar
  }

  async gastarAutorizacoes(usar) {
    for (const u of usar) await this.controlo.atualizarPedido(u.id, { estado: 'usado', notaNova: u.notaNova, usadoEm: this.relogio.agora() })
  }

  // ---------- alteração de notas (Comandante, no painel) ----------

  pedidosParaDecidir(ctx, { estado } = {}) {
    ctx.actor.exigir('academico.ver')
    return this.controlo.pedidos({ estado: ['pendente', 'autorizado', 'recusado', 'usado'].includes(estado) ? estado : undefined })
  }

  async decidir(ctx, { ids, decisao, fundamento }) {
    ctx.actor.exigir('academico.homologar')
    if (!['autorizar', 'recusar'].includes(decisao)) throw new ErroValidacao('Decisão inválida.')
    const f = texto(fundamento, 'fundamento', 'Fundamento', { max: 1000, obrigatorio: decisao === 'recusar' })
    const lista = [...new Set((Array.isArray(ids) ? ids : []).map(Number))]
    if (!lista.length) throw new ErroValidacao('Escolha os pedidos.')
    const decididos = []
    for (const id of lista) {
      const p = await this.controlo.pedido(id)
      if (!p) throw new NaoEncontrado('Pedido não encontrado.')
      if (p.estado !== 'pendente') continue
      decididos.push(await this.controlo.atualizarPedido(p.id, { estado: decisao === 'autorizar' ? 'autorizado' : 'recusado', decididoPor: ctx.actor.nome ?? '', decididoEm: this.relogio.agora(), fundamento: f }))
    }
    // um aviso por docente e cadeira
    const porDocente = new Map()
    for (const p of decididos) (porDocente.get(`${p.pedidoPor}-${p.cadeiraId}`) ?? porDocente.set(`${p.pedidoPor}-${p.cadeiraId}`, []).get(`${p.pedidoPor}-${p.cadeiraId}`)).push(p)
    for (const l of porDocente.values()) {
      const c = await this.academico.cadeira(l[0].cadeiraId)
      await this.notificacoes?.notificar([l[0].pedidoPor], {
        tipo: 'notas',
        titulo: decisao === 'autorizar' ? `Alteração de nota autorizada (${l.length})` : `Alteração de nota recusada (${l.length})`,
        texto: `${c?.nome ?? ''}${f ? ` — ${f}` : ''}`,
        ligacao: `/cadeiras/${l[0].cadeiraId}?separador=avaliacoes`,
      })
    }
    await this.auditoria.registar(ctx, { acao: decisao === 'autorizar' ? 'autorizar_alteracao_nota' : 'recusar_alteracao_nota', colecao: 'pautas', alvoTitulo: `${decididos.length} pedido(s)`, detalhes: { ids: decididos.map((p) => p.id), fundamento: f } })
    return { decididos: decididos.length }
  }

  // ---------- docentes (Comandante) ----------

  docentes(ctx) {
    ctx.actor.exigir('academico.ver')
    return this.controlo.docentes()
  }

  async verificarDocentes(ctx, ids) {
    ctx.actor.exigir('academico.homologar')
    const lista = [...new Set((Array.isArray(ids) ? ids : []).map(Number))].filter(Boolean)
    if (!lista.length) throw new ErroValidacao('Escolha os docentes.')
    const r = await this.controlo.verificarDocentes(lista, ctx.actor.nome ?? '', this.relogio.agora())
    await this.auditoria.registar(ctx, { acao: 'verificar_docentes', colecao: 'contas_portal', alvoTitulo: `${r.count} docente(s)`, detalhes: { ids: lista } })
    return { verificados: r.count }
  }

  // ---------- o que espera por decisão (painel) ----------

  async pendentes(ctx) {
    const r = {}
    if (ctx.actor.pode('academico.ver')) {
      Object.assign(r, await this.controlo.resumoAcademico())
      r.provasPorImprimir = await this.controlo.contarEnunciados('enviado')
      r.alteracoesPendentes = await this.controlo.contarPedidos('pendente')
      r.docentesPorVerificar = await this.controlo.contarDocentesPorVerificar()
    }
    return r
  }
}
