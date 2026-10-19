import { notasVisiveis, resultadoDisciplina, COMPONENTES_NOTA } from '../../../dominio/academico/avaliacao/resultado.js'
import { PercursoAcademico } from '../../../dominio/academico/conclusao/percurso.js'
import { assiduidade } from '../../../dominio/academico/atividades/presencas.js'
import { TrabalhoFimCurso } from '../../../dominio/academico/conclusao/tfc.js'

/*
  Monta o percurso académico de um estudante (matrículas, inscrições, notas, TFC e certificado).
  publicadas = true: só as notas publicadas (o que o estudante vê); false: todas (Administração Escolar).
*/
export class ServicoPercursos {
  constructor({ academico, conclusao }) {
    Object.assign(this, { academico, conclusao })
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
    const linha = (c) => {
      const a = assiduidade(presencas.filter((p) => p.cadeiraId === c.id))
      return {
        cadeira: { id: c.id, codigo: c.codigo, nome: c.nome, periodo: c.periodo, horas: c.horas, docente: c.docente?.nome || '', turma: c.turma?.nome, anoLetivo: c.turma?.anoLetivo },
        ...(publicadas ? notasVisiveis(notas[c.id], c.notasPublicadas, { assiduidade: a }) : this.#todas(notas[c.id], a)),
      }
    }
    const anos = matriculas.map((m) => ({ matricula: { id: m.id, estado: m.estado }, turma: m.turma, disciplinas: cadeiras.filter((c) => c.turmaId === m.turma.id).map(linha) }))
    const tfc = tfcs[0] ? new TrabalhoFimCurso(tfcs[0]) : null
    return new PercursoAcademico({ estudante, anos, inscricoes: extra.filter(Boolean).map(linha), tfc, certificado: certificados[0] || null })
  }

  #todas(n, a = null) {
    const notas = Object.fromEntries(COMPONENTES_NOTA.map((k) => [k, n?.[k] ?? null]))
    return { ...notas, ...resultadoDisciplina(notas, { assiduidade: a }), assiduidade: a, observacao: n?.observacao || '' }
  }
}
