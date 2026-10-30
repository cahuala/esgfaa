import { Conflito, ErroValidacao, NaoEncontrado } from '../../../dominio/comum/erros.js'
import { texto } from '../../../dominio/academico/comum/validacao.js'

/*
  Avisos gerais do portal (Administração Escolar). Só chegam aos estudantes quando o Comandante aprova
  (permissão «publicacoes.aprovar»); quem a tem publica logo. Recusar pede o motivo, que fica no aviso.
*/
export class ServicoAvisosGerais {
  constructor(dependencias) {
    Object.assign(this, dependencias)
  }

  listarAvisos(ctx) {
    ctx.actor.exigir('academico.ver')
    return this.academico.todosAvisosGerais()
  }

  async criarAviso(ctx, { turmaId, titulo, texto: corpo }) {
    ctx.actor.exigir('academico.gerir')
    let turma = null
    if (turmaId) {
      turma = await this.academico.turma(turmaId)
      if (!turma) throw new ErroValidacao('Turma inválida.', { campo: 'turmaId' })
    }
    const aprova = ctx.actor.pode('publicacoes.aprovar')
    const a = await this.academico.criarAvisoGeral({
      turmaId: turma?.id ?? null,
      titulo: texto(titulo, 'titulo', 'Título', { min: 2, max: 200 }),
      texto: texto(corpo, 'texto', 'Texto', { min: 2, max: 5000 }),
      estado: aprova ? 'publicado' : 'pendente',
      aprovacao: aprova ? null : { pedidoPor: ctx.actor.nome ?? null, pedidoEm: this.relogio.agora().toISOString() },
    })
    await this.auditoria.registar(ctx, { acao: aprova ? 'aviso_geral' : 'pedir_aprovacao_aviso', colecao: 'avisos_gerais', alvoId: a.id, alvoTitulo: a.titulo })
    if (aprova) await this.#avisar(a)
    return { ...a, estado: aprova ? 'publicado' : 'pendente' }
  }

  // os estudantes da turma (ou todos) recebem a notificação
  async #avisar(a) {
    const para = a.turmaId ? (await this.academico.estudantesAtivosDaTurma(a.turmaId)).map((e) => e.id) : await this.academico.idsEstudantesAtivos()
    await this.notificacoes?.notificar(para, { tipo: 'aviso', titulo: `Administração Escolar: ${a.titulo}`, texto: a.texto.slice(0, 300), ligacao: '/avisos' })
  }

  // ---------- Comandante ----------

  async paraAprovar(ctx) {
    if (!ctx.actor.pode('publicacoes.aprovar')) return []
    return (await this.academico.avisosGeraisPendentes()).map((a) => ({
      colecao: 'avisos_gerais', id: String(a.id), titulo: a.titulo, tipo: 'publicar', pedidoPor: a.aprovacao?.pedidoPor, pedidoEm: a.aprovacao?.pedidoEm ?? a.criadoEm,
      resumo: a.texto, destino: a.turma ? `Turma ${a.turma}` : 'Todos os estudantes',
    }))
  }

  contarParaAprovar(ctx) {
    return ctx.actor.pode('publicacoes.aprovar') ? this.academico.contarAvisosGeraisPendentes() : 0
  }

  async decidir(ctx, id, { decisao, motivo }) {
    ctx.actor.exigir('publicacoes.aprovar')
    const a = await this.academico.avisoGeral(id)
    if (!a) throw new NaoEncontrado('Aviso não encontrado.')
    if (a.estado !== 'pendente') throw new Conflito('Este aviso não está à espera de aprovação.')
    const decidido = { ...a.aprovacao, decididoPor: ctx.actor.nome ?? '', decididoEm: this.relogio.agora().toISOString() }
    if (decisao === 'aprovar') {
      await this.academico.decidirAvisoGeral(a.id, 'publicado', decidido)
      await this.auditoria.registar(ctx, { acao: 'aprovar_publicacao', colecao: 'avisos_gerais', alvoId: a.id, alvoTitulo: a.titulo, detalhes: { pedidoPor: a.aprovacao?.pedidoPor } })
      await this.#avisar(a)
      return { aprovado: true }
    }
    const m = String(motivo ?? '').trim()
    if (m.length < 3) throw new ErroValidacao('Escreva o motivo da recusa.', { campo: 'motivo' })
    await this.academico.decidirAvisoGeral(a.id, 'recusado', { ...decidido, motivo: m.slice(0, 1000) })
    await this.auditoria.registar(ctx, { acao: 'recusar_publicacao', colecao: 'avisos_gerais', alvoId: a.id, alvoTitulo: a.titulo, detalhes: { motivo: m } })
    return { aprovado: false }
  }

  async apagarAviso(ctx, id) {
    ctx.actor.exigir('academico.gerir')
    await this.academico.apagarAvisoGeral(id)
  }
}
