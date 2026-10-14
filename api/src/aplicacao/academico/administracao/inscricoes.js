import { NaoEncontrado } from '../../../dominio/comum/erros.js'
import { Inscricao, MOTIVOS_INSCRICAO } from '../../../dominio/academico/matriculas/inscricao.js'

// Inscrição de estudantes em cadeiras fora da sua turma (Administração Escolar).
export class ServicoInscricoes {
  constructor(dependencias) {
    Object.assign(this, dependencias)
  }

  async #cadeira(id) {
    const c = await this.academico.cadeira(id)
    if (!c) throw new NaoEncontrado('Cadeira não encontrada.')
    return c
  }

  // estudantes da turma e inscritos, para a página da cadeira no painel
  async daCadeira(ctx, cadeiraId) {
    ctx.actor.exigir('academico.ver')
    const c = await this.#cadeira(cadeiraId)
    const [daTurma, inscricoes] = await Promise.all([this.academico.estudantesAtivosDaTurma(c.turmaId), this.academico.inscricoesDaCadeira(c.id)])
    return { motivos: MOTIVOS_INSCRICAO, daTurma, inscricoes }
  }

  async inscrever(ctx, cadeiraId, { estudanteId, motivo, observacao }) {
    ctx.actor.exigir('academico.gerir')
    const cadeira = await this.#cadeira(cadeiraId)
    const estudante = await this.contas.porId(estudanteId)
    const [turmasDoEstudante, existente] = await Promise.all([
      estudante ? this.academico.turmasAtivas(estudante.id) : [],
      estudante ? this.academico.inscricaoDe(estudante.id, cadeira.id) : null,
    ])
    const i = Inscricao.nova({ estudante, cadeira, turmasDoEstudante, existente, motivo, observacao })
    const gravada = await this.academico.gravarInscricao(i)
    await this.auditoria.registar(ctx, { acao: 'inscrever_cadeira', colecao: 'inscricoes', alvoId: gravada.id, alvoTitulo: `${estudante.nome} → ${cadeira.codigo} ${cadeira.nome}`, detalhes: { motivo: i.motivo } })
    await this.notificacoes?.notificar([estudante.id], {
      tipo: 'geral', titulo: `Inscrito na cadeira ${cadeira.nome}`, texto: `${MOTIVOS_INSCRICAO[i.motivo]}. Já a encontra nas suas cadeiras.`, ligacao: `/cadeiras/${cadeira.id}`,
    })
    return this.daCadeira(ctx, cadeira.id)
  }

  async anular(ctx, id) {
    ctx.actor.exigir('academico.gerir')
    const linha = await this.academico.inscricao(id)
    if (!linha) throw new NaoEncontrado('Inscrição não encontrada.')
    const i = new Inscricao(linha).anular()
    await this.academico.gravarInscricao(i)
    await this.auditoria.registar(ctx, { acao: 'anular_inscricao', colecao: 'inscricoes', alvoId: i.id, alvoTitulo: `Inscrição ${i.id}` })
    return this.daCadeira(ctx, i.cadeiraId)
  }
}
