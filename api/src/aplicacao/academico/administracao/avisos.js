import { ErroValidacao } from '../../../dominio/comum/erros.js'
import { texto } from '../../../dominio/academico/comum/validacao.js'

// Avisos gerais do portal (Administração Escolar).
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
    const a = await this.academico.criarAvisoGeral({
      turmaId: turma?.id ?? null,
      titulo: texto(titulo, 'titulo', 'Título', { min: 2, max: 200 }),
      texto: texto(corpo, 'texto', 'Texto', { min: 2, max: 5000 }),
    })
    await this.auditoria.registar(ctx, { acao: 'aviso_geral', colecao: 'avisos_gerais', alvoId: a.id, alvoTitulo: a.titulo })
    const para = turma ? (await this.academico.estudantesAtivosDaTurma(turma.id)).map((e) => e.id) : await this.academico.idsEstudantesAtivos()
    await this.notificacoes?.notificar(para, { tipo: 'aviso', titulo: `Administração Escolar: ${a.titulo}`, texto: a.texto.slice(0, 300), ligacao: '/avisos' })
    return a
  }

  async apagarAviso(ctx, id) {
    ctx.actor.exigir('academico.gerir')
    await this.academico.apagarAvisoGeral(id)
  }
}
