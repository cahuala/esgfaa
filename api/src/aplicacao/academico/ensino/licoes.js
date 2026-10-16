import { Conflito, ErroValidacao, NaoEncontrado } from '../../../dominio/comum/erros.js'
import { destino, licaoSemRespostas, notaLicao } from '../../../dominio/academico/atividades/livroLicao.js'
import { quem } from '../partilhado/autor.js'

/*
  Lições: o servidor guarda onde vai cada estudante e decide a página seguinte
  (as respostas certas e os saltos nunca vão para o navegador). Ao chegar ao fim
  a lição fica concluída, com a nota da primeira resposta a cada pergunta.
*/
export class ServicoLicoes {
  constructor(dependencias) {
    Object.assign(this, dependencias)
  }

  async #licaoDoEstudante(ctx, materialId) {
    this.acesso.soEstudante(ctx.conta)
    const m = await this.academico.material(materialId)
    if (!m || m.tipo !== 'licao') throw new NaoEncontrado('Lição não encontrada.')
    await this.acesso.acessivel(ctx.conta, m.cadeiraId).catch(() => { throw new NaoEncontrado('Lição não encontrada.') })
    await this.disponibilidade?.exigir(m.cadeiraId, ctx.conta.id, 'material', m.id)
    return m
  }

  #estado(m, p) {
    const paginas = m.estrutura || []
    const pagina = p?.concluida ? null : paginas.find((x) => x.id === p?.pagina)?.id ?? paginas[0]?.id ?? null
    const respondidas = Object.fromEntries(Object.entries(p?.respostas || {}).map(([k, v]) => [k, { certa: v.certa }]))
    return {
      pagina, concluida: Boolean(p?.concluida), nota: p?.nota ?? null, melhorNota: p?.melhorNota ?? null, visitas: p?.visitas ?? 0,
      respondidas, total: paginas.length, perguntas: paginas.filter((x) => x.pergunta).length,
    }
  }

  // estado do estudante (e a lição sem as respostas, pela ordem do docente)
  async estado(ctx, materialId) {
    const m = await this.#licaoDoEstudante(ctx, materialId)
    await this.registos?.registar(ctx.conta, m.cadeiraId, 'material', m.id)
    const p = await this.recursos.progressoLicao(m.id, ctx.conta.id)
    return { ...this.#estado(m, p), paginas: licaoSemRespostas(m.estrutura) }
  }

  // ir para outro sítio: a página seguinte (páginas sem pergunta), ou chegar ao fim
  async #ir(ctx, m, p, para, respostas = p?.respostas || {}) {
    const paginas = m.estrutura || []
    if (para === null) {
      const nota = notaLicao(paginas, respostas)
      const melhorNota = Math.max(nota, p?.melhorNota ?? 0)
      const r = await this.recursos.guardarProgressoLicao(m.id, ctx.conta.id, { pagina: '', respostas, concluida: true, nota, melhorNota })
      await this.recursos.marcarConclusao(m.id, ctx.conta.id, true) // conta para o progresso e para as restrições
      await this.auditoria?.registar(ctx, { acao: 'concluir_licao', colecao: 'materiais', alvoId: m.id, alvoTitulo: m.titulo, detalhes: { nota }, utilizador: quem(ctx.conta) })
      return r
    }
    return this.recursos.guardarProgressoLicao(m.id, ctx.conta.id, { pagina: para, respostas, concluida: false })
  }

  async avancar(ctx, materialId, { paginaId }) {
    const m = await this.#licaoDoEstudante(ctx, materialId)
    const p = await this.recursos.progressoLicao(m.id, ctx.conta.id)
    const atual = this.#estado(m, p).pagina
    if (!atual) throw new Conflito('A lição já terminou. Pode recomeçá-la.')
    if (paginaId !== atual) throw new Conflito('A lição avançou noutra janela. Recarregue a página.')
    const pagina = m.estrutura.find((x) => x.id === atual)
    if (pagina.pergunta) throw new ErroValidacao('Responda à pergunta para continuar.', { campo: 'opcao' })
    const r = await this.#ir(ctx, m, p, destino(m.estrutura, atual, 'seguinte'))
    return { ...this.#estado(m, r) }
  }

  // resposta a uma pergunta: diz se está certa, o comentário do docente e para onde vai
  async responder(ctx, materialId, { paginaId, opcao }) {
    const m = await this.#licaoDoEstudante(ctx, materialId)
    const p = await this.recursos.progressoLicao(m.id, ctx.conta.id)
    const atual = this.#estado(m, p).pagina
    if (!atual) throw new Conflito('A lição já terminou. Pode recomeçá-la.')
    if (paginaId !== atual) throw new Conflito('A lição avançou noutra janela. Recarregue a página.')
    const pagina = m.estrutura.find((x) => x.id === atual)
    const o = pagina.pergunta?.opcoes[Number(opcao)]
    if (!o) throw new ErroValidacao('Escolha uma das opções.', { campo: 'opcao' })
    // só a primeira resposta a cada pergunta conta para a nota
    const respostas = { ...(p?.respostas || {}) }
    if (!respostas[pagina.id]) respostas[pagina.id] = { opcao: Number(opcao), certa: o.correta }
    const para = destino(m.estrutura, atual, o.salto)
    const r = await this.#ir(ctx, m, p, para, respostas)
    return { certa: o.correta, resposta: o.resposta, ...this.#estado(m, r) }
  }

  async recomecar(ctx, materialId) {
    const m = await this.#licaoDoEstudante(ctx, materialId)
    const p = await this.recursos.progressoLicao(m.id, ctx.conta.id)
    const r = await this.recursos.guardarProgressoLicao(m.id, ctx.conta.id, { pagina: m.estrutura[0]?.id ?? '', respostas: {}, concluida: false, nota: p?.nota ?? null, visitas: (p?.visitas ?? 0) + 1 })
    return this.#estado(m, r)
  }

  // docente: quem fez, a nota e por onde vai cada um
  async resultados(ctx, materialId) {
    const m = await this.academico.material(materialId)
    if (!m || m.tipo !== 'licao') throw new NaoEncontrado('Lição não encontrada.')
    const cadeira = await this.apoio.cadeiraDoDocente(ctx.conta, m.cadeiraId)
    const [estudantes, progressos] = await Promise.all([this.academico.estudantesDaCadeira(cadeira), this.recursos.progressosLicao(m.id)])
    const titulo = (id) => m.estrutura.find((x) => x.id === id)?.titulo || ''
    return estudantes.map((e) => {
      const p = progressos.find((x) => x.estudanteId === e.id)
      return {
        estudante: { id: e.id, nome: e.nome, numero: e.numero }, comecou: Boolean(p), concluida: Boolean(p?.concluida),
        nota: p?.nota ?? null, melhorNota: p?.melhorNota ?? null, visitas: p?.visitas ?? 0, pagina: p && !p.concluida ? titulo(p.pagina) || titulo(m.estrutura[0]?.id) : '',
        acertos: p ? Object.values(p.respostas).filter((x) => x.certa).length : 0, perguntas: m.estrutura.filter((x) => x.pergunta).length,
      }
    })
  }
}
