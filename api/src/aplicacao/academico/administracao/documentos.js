import { NaoEncontrado } from '../../../dominio/comum/erros.js'
import { mediaDaPautaGeral } from '../../../dominio/academico/avaliacao/pautaGeral.js'

/*
  Documentos para imprimir ou exportar (Administração Escolar): pauta da turma (estudantes × cadeiras),
  folha de presenças de uma cadeira e lista de estudantes para assinar na prova.
*/
export class ServicoDocumentos {
  constructor(dependencias) {
    Object.assign(this, dependencias)
  }

  async #cadeira(id) {
    const c = await this.academico.cadeira(id)
    if (!c) throw new NaoEncontrado('Cadeira não encontrada.')
    return c
  }

  async #turma(id) {
    const t = await this.academico.turma(id)
    if (!t) throw new NaoEncontrado('Turma não encontrada.')
    return t
  }

  async #curso(slug) {
    return (await this.conteudos.listar('cursos')).find((c) => c.id === slug)?.titulo || slug
  }

  // pauta da turma: uma linha por estudante, uma coluna por cadeira (nota final e situação)
  async pautaDaTurma(ctx, turmaId) {
    ctx.actor.exigir('academico.ver')
    const turma = await this.#turma(turmaId)
    const cadeiras = await this.academico.cadeirasDasTurmas([turma.id])
    const pautas = await Promise.all(cadeiras.map((c) => this.pautas.pauta(c)))
    const estudantes = await this.academico.estudantesDaPauta(turma.id)
    const linhas = estudantes.map((e) => {
      const notas = Object.fromEntries(cadeiras.map((c, i) => {
        const l = pautas[i].linhas.find((x) => x.estudante.id === e.id)
        return [c.id, l ? { mac: l.mac, final: l.final, situacao: l.situacao, classificacao: l.classificacao } : null]
      }))
      return { estudante: e, notas, ...mediaDaPautaGeral(Object.values(notas)) }
    })
    return {
      turma: { id: turma.id, nome: turma.nome, anoLetivo: turma.anoLetivo, anoCurricular: turma.anoCurricular, curso: await this.#curso(turma.curso) },
      cadeiras: cadeiras.map((c) => ({ id: c.id, codigo: c.codigo, nome: c.nome, periodo: c.periodo, horas: c.horas, regente: c.docente?.nome || '' })),
      linhas,
    }
  }

  // folha de presenças: estudantes × aulas registadas (com P/F/J), mais colunas em branco se se pedir
  async folhaPresencas(ctx, cadeiraId) {
    ctx.actor.exigir('academico.ver')
    const c = await this.#cadeira(cadeiraId)
    const [estudantes, aulas] = await Promise.all([this.academico.estudantesDaCadeira(c), this.academico.aulas(c.id)])
    return { cadeira: this.#resumoCadeira(c), turma: await this.#resumoTurma(c.turmaId), estudantes, aulas: aulas.sort((a, b) => a.data.localeCompare(b.data)) }
  }

  // lista para assinar na prova: estudantes da cadeira (turma e inscritos), com as provas marcadas
  async listaProva(ctx, cadeiraId) {
    ctx.actor.exigir('academico.ver')
    const c = await this.#cadeira(cadeiraId)
    const [estudantes, eventos] = await Promise.all([this.academico.estudantesDaCadeira(c), this.recursos.eventosDaCadeira(c.id)])
    return {
      cadeira: this.#resumoCadeira(c), turma: await this.#resumoTurma(c.turmaId), estudantes,
      provas: eventos.filter((e) => ['p1', 'p2', 'exame', 'recurso'].includes(e.tipo)).map((e) => ({ tipo: e.tipo, titulo: e.titulo, data: e.data, inicio: e.inicio, local: e.local })),
    }
  }

  #resumoCadeira(c) {
    return { id: c.id, codigo: c.codigo, nome: c.nome, periodo: c.periodo, horas: c.horas, docentes: c.docentes.map((d) => ({ nome: d.nome, papel: d.papel })) }
  }

  async #resumoTurma(id) {
    const t = await this.#turma(id)
    return { id: t.id, nome: t.nome, anoLetivo: t.anoLetivo, anoCurricular: t.anoCurricular, curso: await this.#curso(t.curso) }
  }
}
