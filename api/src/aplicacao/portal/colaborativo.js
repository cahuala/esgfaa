import { Conflito, ErroValidacao, NaoEncontrado, SemPermissao } from '../../dominio/comum/erros.js'
import { texto } from '../../dominio/academico/regras.js'

/*
  Glossário e wiki da cadeira (escritos em conjunto, como no Moodle).
  Glossário: o estudante propõe e o docente aprova; os termos do docente ficam logo aprovados.
  Wiki: qualquer participante edita; cada gravação é uma versão; o docente repõe versões e apaga páginas.
*/
export class ServicoColaborativo {
  constructor({ colaborativo, acesso, notificacoes, filtroHtml = (h) => h, relogio }) {
    Object.assign(this, { colaborativo, acesso, notificacoes, filtroHtml, relogio })
  }

  // ---------- glossário ----------

  async termos(ctx, cadeiraId, { q } = {}) {
    const c = await this.acesso.acessivel(ctx.conta, cadeiraId)
    const termo = String(q || '').trim().slice(0, 100)
    return this.colaborativo.termos(c.id, { q: termo.length >= 1 ? termo : null, contaId: ctx.conta.id, todos: ctx.conta.tipo === 'docente' })
  }

  #campos(d, atual = null) {
    const r = {}
    if (d.termo !== undefined || !atual) r.termo = texto(d.termo, 'termo', 'Termo', { min: 1, max: 120 })
    if (d.definicao !== undefined || !atual) r.definicao = texto(d.definicao, 'definicao', 'Definição', { min: 3, max: 5000 })
    return r
  }

  async criarTermo(ctx, cadeiraId, dados) {
    const c = await this.acesso.acessivel(ctx.conta, cadeiraId)
    const campos = this.#campos(dados)
    if (await this.colaborativo.termoExiste(c.id, campos.termo)) throw new Conflito(`"${campos.termo}" já está no glossário.`)
    const docente = ctx.conta.tipo === 'docente'
    const t = await this.colaborativo.criarTermo({ cadeiraId: c.id, autorId: ctx.conta.id, aprovado: docente, ...campos, criadoEm: this.relogio.agora(), atualizadoEm: this.relogio.agora() })
    if (!docente) {
      await this.notificacoes?.notificar(c.docentes.map((d) => d.id), {
        tipo: 'forum', titulo: `Termo proposto para o glossário de ${c.nome}: ${t.termo}`, texto: `${ctx.conta.nome} propôs um termo à espera de aprovação.`,
        ligacao: `/cadeiras/${c.id}?separador=glossario`,
      })
    }
    return t
  }

  async #termo(ctx, id) {
    const t = await this.colaborativo.termo(id)
    if (!t) throw new NaoEncontrado('Termo não encontrado.')
    await this.acesso.acessivel(ctx.conta, t.cadeiraId).catch(() => { throw new NaoEncontrado('Termo não encontrado.') })
    return t
  }

  // o docente edita e aprova; o autor só edita enquanto não estiver aprovado
  async atualizarTermo(ctx, id, dados) {
    const t = await this.#termo(ctx, id)
    const docente = ctx.conta.tipo === 'docente'
    if (!docente && (t.autor.id !== ctx.conta.id || t.aprovado)) throw new SemPermissao('Só pode mudar os seus termos ainda por aprovar.')
    const campos = this.#campos(dados, t)
    if (campos.termo && await this.colaborativo.termoExiste(t.cadeiraId, campos.termo, t.id)) throw new Conflito(`"${campos.termo}" já está no glossário.`)
    if (dados.aprovado !== undefined) {
      if (!docente) throw new SemPermissao('Só o docente aprova termos.')
      campos.aprovado = Boolean(dados.aprovado)
    }
    const r = await this.colaborativo.atualizarTermo(t.id, { ...campos, atualizadoEm: this.relogio.agora() })
    if (campos.aprovado && !t.aprovado && t.autor.id !== ctx.conta.id) {
      await this.notificacoes?.notificar([t.autor.id], { tipo: 'forum', titulo: `O seu termo "${r.termo}" foi aprovado no glossário`, texto: '', ligacao: `/cadeiras/${t.cadeiraId}?separador=glossario` })
    }
    return r
  }

  async apagarTermo(ctx, id) {
    const t = await this.#termo(ctx, id)
    if (ctx.conta.tipo !== 'docente' && (t.autor.id !== ctx.conta.id || t.aprovado)) throw new SemPermissao('Só pode apagar os seus termos ainda por aprovar.')
    await this.colaborativo.apagarTermo(t.id)
  }

  // ---------- wiki ----------

  async paginas(ctx, cadeiraId) {
    const c = await this.acesso.acessivel(ctx.conta, cadeiraId)
    return this.colaborativo.paginas(c.id)
  }

  #conteudo(html) {
    const h = String(html ?? '')
    if (h.length > 200_000) throw new ErroValidacao('A página é demasiado longa.', { campo: 'conteudo' })
    const limpo = this.filtroHtml(h)
    if (!limpo.replace(/<[^>]*>/g, '').trim()) throw new ErroValidacao('Escreva o conteúdo da página.', { campo: 'conteudo' })
    return limpo
  }

  async criarPagina(ctx, cadeiraId, { titulo, conteudo }) {
    const c = await this.acesso.acessivel(ctx.conta, cadeiraId)
    const id = await this.colaborativo.criarPagina({
      cadeiraId: c.id, titulo: texto(titulo, 'titulo', 'Título', { min: 2, max: 120 }), conteudo: this.#conteudo(conteudo), autorId: ctx.conta.id, quando: this.relogio.agora(),
    })
    return this.colaborativo.pagina(id)
  }

  async #pagina(ctx, id) {
    const p = await this.colaborativo.pagina(id)
    if (!p) throw new NaoEncontrado('Página não encontrada.')
    await this.acesso.acessivel(ctx.conta, p.cadeiraId).catch(() => { throw new NaoEncontrado('Página não encontrada.') })
    return p
  }

  // a página com a versão atual (ou uma antiga) e a lista das versões, sem o conteúdo das antigas
  async pagina(ctx, id, { versao } = {}) {
    const p = await this.#pagina(ctx, id)
    const atual = p.versoes[0]
    const vista = versao ? p.versoes.find((v) => v.id === Number(versao)) : atual
    if (!vista) throw new NaoEncontrado('Versão não encontrada.')
    return { ...p, atual: atual.id, versao: vista, versoes: p.versoes.map((v) => ({ id: v.id, resumo: v.resumo, autor: v.autor, criadaEm: v.criadaEm })) }
  }

  async editarPagina(ctx, id, { conteudo, base, resumo }) {
    const p = await this.#pagina(ctx, id)
    await this.colaborativo.novaVersao({
      paginaId: p.id, base, conteudo: this.#conteudo(conteudo), autorId: ctx.conta.id, quando: this.relogio.agora(),
      resumo: texto(resumo, 'resumo', 'Resumo da mudança', { max: 200, obrigatorio: false }),
    })
    return this.pagina(ctx, p.id)
  }

  // o docente repõe uma versão antiga (fica como versão nova; nada se perde)
  async restaurar(ctx, id, { versaoId }) {
    const p = await this.#pagina(ctx, id)
    if (ctx.conta.tipo !== 'docente') throw new SemPermissao('Só o docente repõe versões.')
    const v = p.versoes.find((x) => x.id === Number(versaoId))
    if (!v) throw new NaoEncontrado('Versão não encontrada.')
    await this.colaborativo.novaVersao({ paginaId: p.id, conteudo: v.conteudo, resumo: `Reposta a versão de ${v.criadaEm.slice(0, 10)}`, autorId: ctx.conta.id, quando: this.relogio.agora() })
    return this.pagina(ctx, p.id)
  }

  async apagarPagina(ctx, id) {
    const p = await this.#pagina(ctx, id)
    if (ctx.conta.tipo !== 'docente') throw new SemPermissao('Só o docente apaga páginas da wiki.')
    await this.colaborativo.apagarPagina(p.id)
  }
}
