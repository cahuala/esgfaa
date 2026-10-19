import { assiduidade } from '../../../dominio/academico/atividades/presencas.js'
import { media, motivosDeRisco, pautasEmAtraso, taxaAprovacao } from '../../../dominio/academico/acompanhamento/indicadores.js'

/*
  Painel de indicadores da Administração Escolar: por turma e por cadeira (aprovação, médias,
  assiduidade), estudantes em risco (faltas, negativas, sem acesso) e pautas por lançar.
*/
export class ServicoIndicadores {
  constructor({ academico, recursos, pautas, relogio }) {
    Object.assign(this, { academico, recursos, pautas, relogio })
  }

  async indicadores(ctx, { anoLetivo } = {}) {
    ctx.actor.exigir('academico.ver')
    const agora = this.relogio.agora()
    const todas = (await this.academico.listarTurmas()).filter((t) => t.ativa !== false)
    const anos = [...new Set(todas.map((t) => t.anoLetivo))]
    const ano = anoLetivo && anos.includes(anoLetivo) ? anoLetivo : anos[0]
    const turmas = todas.filter((t) => t.anoLetivo === ano)

    const linhasTurmas = []
    const linhasCadeiras = []
    const risco = []
    const atrasos = []
    for (const t of turmas) {
      const [estudantes, cadeiras] = await Promise.all([this.academico.estudantesAtivosDaTurma(t.id), this.academico.cadeirasDasTurmas([t.id])])
      const ids = estudantes.map((e) => e.id)
      const [presencas, acessos] = await Promise.all([this.academico.presencasDasCadeiras(cadeiras.map((c) => c.id)), this.academico.ultimosAcessos(ids)])
      const porEstudante = Object.fromEntries(ids.map((id) => [id, { assiduidades: [], notas: [] }]))
      const todasLinhas = []
      for (const c of cadeiras) {
        const [pauta, eventos] = await Promise.all([this.pautas.pauta(c), this.recursos.eventosDaCadeira(c.id)])
        const linhas = pauta.linhas.filter((l) => porEstudante[l.estudante.id])
        todasLinhas.push(...linhas)
        const assid = []
        for (const id of ids) {
          const a = assiduidade(presencas.filter((p) => p.cadeiraId === c.id && p.estudanteId === id))
          if (a !== null) assid.push(a)
          porEstudante[id].assiduidades.push({ cadeira: c.codigo, valor: a })
        }
        for (const l of linhas) porEstudante[l.estudante.id].notas.push({ cadeira: c.codigo, ...l })
        const contar = (s) => linhas.filter((l) => l.situacao === s).length
        linhasCadeiras.push({
          id: c.id, codigo: c.codigo, nome: c.nome, turma: t.nome, turmaId: t.id,
          docentes: c.docentes.map((d) => d.nome), semDocente: c.docentes.length === 0,
          estudantes: linhas.length, aprovados: contar('aprovado') + contar('dispensado'), reprovados: contar('reprovado'),
          exame: contar('exame'), recurso: contar('recurso'), emCurso: contar('em_curso'), excluidos: contar('excluido'),
          taxaAprovacao: taxaAprovacao(linhas), media: media(linhas.map((l) => l.final)), assiduidade: media(assid),
        })
        for (const a of pautasEmAtraso(eventos, linhas, agora)) {
          atrasos.push({ ...a, cadeira: { id: c.id, codigo: c.codigo, nome: c.nome }, turma: t.nome, docentes: c.docentes.map((d) => d.nome) })
        }
      }
      let emRisco = 0
      for (const e of estudantes) {
        const motivos = motivosDeRisco({ ...porEstudante[e.id], ultimoAcesso: acessos[e.id], agora })
        if (motivos.length) {
          emRisco += 1
          risco.push({ estudante: e, turma: { id: t.id, nome: t.nome }, motivos })
        }
      }
      const doAno = linhasCadeiras.filter((c) => c.turmaId === t.id)
      linhasTurmas.push({
        id: t.id, nome: t.nome, curso: t.curso, anoCurricular: t.anoCurricular, estudantes: estudantes.length, cadeiras: cadeiras.length, emRisco,
        taxaAprovacao: taxaAprovacao(todasLinhas), media: media(todasLinhas.map((l) => l.final)), assiduidade: media(doAno.map((c) => c.assiduidade)),
      })
    }
    // os casos mais graves primeiro
    risco.sort((a, b) => b.motivos.length - a.motivos.length || a.estudante.nome.localeCompare(b.estudante.nome, 'pt'))
    atrasos.sort((a, b) => b.diasAtraso - a.diasAtraso)
    const estudantes = linhasTurmas.reduce((s, t) => s + t.estudantes, 0)
    return {
      anoLetivo: ano, anos,
      geral: {
        turmas: linhasTurmas.length, estudantes, cadeiras: linhasCadeiras.length,
        cadeirasSemDocente: linhasCadeiras.filter((c) => c.semDocente).length, emRisco: risco.length, pautasEmAtraso: atrasos.length,
        taxaAprovacao: media(linhasCadeiras.map((c) => c.taxaAprovacao)), assiduidade: media(linhasCadeiras.map((c) => c.assiduidade)),
      },
      turmas: linhasTurmas, cadeiras: linhasCadeiras, risco, atrasos,
    }
  }
}
