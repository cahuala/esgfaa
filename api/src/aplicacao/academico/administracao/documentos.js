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

  /*
    Documentos do ano lectivo (os que a Repartição de Administração Escolar tira no fim dos cursos): para cada curso
    do ano, os discentes (NIP, posto, ramo, órgão de origem), a classificação final e a menção — daqui saem os dados
    estatísticos, os dados por ramos, o resumo, a relação para a entrega dos diplomas e a lista para os diplomas.
  */
  async documentosDoAno(ctx, anoLetivo) {
    ctx.actor.exigir('academico.ver')
    const ano = await this.anosLetivos?.prisma.anoLetivo.findUnique({ where: { id: anoLetivo } })
    const turmas = (await this.academico.listarTurmas()).filter((t) => t.anoLetivo === anoLetivo && t.ativa !== false)
    const cursos = new Map((await this.conteudos.listar('cursos')).map((c) => [c.id, c]))
    const porCurso = new Map()
    for (const t of turmas) {
      const c = cursos.get(t.curso)
      const x = porCurso.get(t.curso) ?? { curso: t.curso, nome: c?.titulo || c?.dados?.nome || t.curso, sigla: c?.dados?.sigla || '', turmas: [], linhas: [] }
      porCurso.set(t.curso, x)
      x.turmas.push(t.nome)
      const matriculas = await this.academico.matriculasDaTurma(t.id)
      for (const m of matriculas.filter((y) => ['ativa', 'concluida'].includes(y.estado))) {
        const e = m.estudante
        const d = e.dados ?? {}
        const r = await Promise.resolve(this.esg?.resultadoDoEstudante(e.id, t)).catch(() => null)
        x.linhas.push({
          id: e.id, numero: e.numero, nome: e.nome, nip: d.nip || '', posto: d.posto || '', postoEquivalente: d.postoEquivalente || '', ramo: d.ramo || '', orgao: d.departamento || '',
          origem: d.origem || (d.ramo ? 'faa' : ''), pais: d.pais || '', turma: t.nome, final: r?.final ?? null, mencao: r?.distinto ? 'Distinto' : r?.mencao ?? null,
        })
      }
    }
    const { grauDe, ordenarPorHierarquia } = await import('../../../dominio/academico/pessoas/hierarquia.js')
    for (const c of porCurso.values()) for (const l of c.linhas) l.grau = grauDe({ nome: l.nome, dados: { posto: l.posto, postoEquivalente: l.postoEquivalente } })
    return {
      anoLetivo, inicio: ano?.inicio ? ano.inicio.toISOString().slice(0, 10) : null, fim: ano?.fim ? ano.fim.toISOString().slice(0, 10) : null,
      cursos: [...porCurso.values()].map((c) => ({ ...c, linhas: ordenarPorHierarquia(c.linhas, (l) => ({ nome: l.nome, dados: { posto: l.posto, postoEquivalente: l.postoEquivalente } })) })),
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
