import { Conflito, ErroValidacao, NaoEncontrado, SemPermissao } from '../../../dominio/comum/erros.js'
import { texto } from '../../../dominio/academico/comum/validacao.js'
import { quem } from '../partilhado/autor.js'

// Fórum da cadeira: tópicos, perguntas e respostas, anexos, resposta certa, subscrições e moderação.
export class ServicoForum {
  constructor(dependencias) {
    Object.assign(this, dependencias)
  }

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
}
