import { notasVisiveis, resultadoDisciplina, COMPONENTES_NOTA } from '../../../dominio/academico/avaliacao/resultado.js'
import { PercursoAcademico } from '../../../dominio/academico/conclusao/percurso.js'
import { assiduidade } from '../../../dominio/academico/atividades/presencas.js'
import { TrabalhoFimCurso } from '../../../dominio/academico/conclusao/tfc.js'

/*
  Monta o percurso académico de um estudante (matrículas, inscrições, notas, TFC e certificado).
  publicadas = true: só as notas publicadas (o que o estudante vê); false: todas (Administração Escolar).
*/
export class ServicoPercursos {
  constructor({ academico, conclusao, esg = null }) {
    Object.assign(this, { academico, conclusao, esg })
  }

  async de(estudanteId, { publicadas = true, estudante = null } = {}) {
    const [matriculas, inscricoes, tfcs, certificados] = await Promise.all([
      this.academico.percursoDoEstudante(estudanteId),
      this.academico.inscricoesDoEstudante(estudanteId),
      this.conclusao.tfcsDoEstudante(estudanteId),
      this.conclusao.certificadosDoEstudante(estudanteId),
    ])
    const ativas = inscricoes.filter((i) => i.estado === 'ativa')
    const cadeiras = await this.academico.cadeirasDasTurmas(matriculas.map((m) => m.turma.id))
    const extra = await Promise.all(ativas.map((i) => this.academico.cadeira(i.cadeiraId)))
    const ids = [...cadeiras, ...extra].filter(Boolean).map((c) => c.id)
    const [notas, presencas] = await Promise.all([this.academico.notasDoEstudante(estudanteId, ids), this.academico.presencasDoEstudante(estudanteId, ids)])
    // as turmas com plano de curso da ESG: as UC pelas provas TAI/TAG; o curso pelos blocos e coeficientes
    const comPlano = new Map()
    if (this.esg) for (const m of matriculas) if (await this.esg.planos.daTurma(m.turma)) comPlano.set(m.turma.id, true)
    const linha = async (c) => {
      const a = assiduidade(presencas.filter((p) => p.cadeiraId === c.id))
      const base = { id: c.id, codigo: c.codigo, nome: c.nome, periodo: c.periodo, horas: c.horas, docente: c.docente?.nome || '', turma: c.turma?.nome, anoLetivo: c.turma?.anoLetivo, bloco: c.bloco, creditos: c.creditos, tii: c.tii }
      if (comPlano.has(c.turmaId)) {
        const r = await this.esg.doEstudante(estudanteId, c, { todas: !publicadas })
        return { cadeira: base, ...r, situacao: r.situacao === 'sem_provas' ? 'em_curso' : r.situacao, assiduidade: a }
      }
      return { cadeira: base, ...(publicadas ? notasVisiveis(notas[c.id], c.notasPublicadas, { assiduidade: a }) : this.#todas(notas[c.id], a)) }
    }
    const anos = []
    for (const m of matriculas) {
      const disciplinas = []
      for (const c of cadeiras.filter((x) => x.turmaId === m.turma.id)) disciplinas.push(await linha(c))
      anos.push({ matricula: { id: m.id, estado: m.estado }, turma: m.turma, disciplinas })
    }
    const avulsas = []
    for (const c of extra.filter(Boolean)) avulsas.push(await linha(c))
    const tfc = tfcs[0] ? new TrabalhoFimCurso(tfcs[0]) : null
    // o curso pelo plano da ESG: a turma mais recente com plano
    const ultima = [...matriculas].reverse().find((m) => comPlano.has(m.turma.id))
    const planoCurso = ultima ? await this.esg.resultadoDoEstudante(estudanteId, ultima.turma, { publicadas }) : null
    return new PercursoAcademico({ estudante, anos, inscricoes: avulsas, tfc, certificado: certificados[0] || null, planoCurso })
  }

  #todas(n, a = null) {
    const notas = Object.fromEntries(COMPONENTES_NOTA.map((k) => [k, n?.[k] ?? null]))
    return { ...notas, ...resultadoDisciplina(notas, { assiduidade: a }), assiduidade: a, observacao: n?.observacao || '' }
  }
}
