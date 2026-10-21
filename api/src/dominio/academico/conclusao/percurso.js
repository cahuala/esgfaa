import { classificacao } from '../avaliacao/nota.js'

/*
  Conclusão do curso (ajustável ao regulamento da Escola):
  - o curso conclui-se com todas as unidades curriculares aprovadas (aprovado ou dispensado)
    e o trabalho de fim de curso aprovado;
  - média final = média das classificações finais das unidades curriculares, contando o TFC
    com o peso de pesoTfc unidades curriculares; arredondada às décimas.
*/
export const CONCLUSAO_CURSO = { pesoTfc: 1 }

const aprovada = (l) => l.situacao === 'aprovado' || l.situacao === 'dispensado'
const media = (valores) => (valores.length ? Math.round((valores.reduce((s, v) => s + v, 0) / valores.length) * 10) / 10 : null)

/*
  Percurso académico de um estudante (agregado): anos (matrículas nas turmas) com as disciplinas,
  inscrições avulsas em cadeiras e o TFC. Uma cadeira reprovada e depois aprovada (repetição,
  inscrição noutra turma) conta como aprovada: vale o melhor resultado de cada código.
  Cada disciplina: { cadeira: { id, codigo, nome, horas, … }, p1, p2, mac, exame, recurso, final, situacao, classificacao }.
*/
export class PercursoAcademico {
  /*
    planoCurso: o resultado pelo plano de curso da ESG (blocos, coeficientes, menção), quando a turma o tem;
    nesse caso a conclusão, a média final e a classificação vêm do plano.
  */
  constructor({ estudante = null, anos = [], inscricoes = [], tfc = null, certificado = null, planoCurso = null }) {
    Object.assign(this, { estudante, anos, inscricoes, tfc, certificado, planoCurso })
  }

  static resumir(linhas) {
    const feitas = linhas.filter(aprovada)
    const reprovadas = linhas.filter((l) => l.situacao === 'reprovado').length
    return {
      disciplinas: linhas.length,
      aprovadas: feitas.length,
      reprovadas,
      emCurso: linhas.length - feitas.length - reprovadas,
      horas: linhas.reduce((s, l) => s + (l.cadeira.horas || 0), 0),
      horasAprovadas: feitas.reduce((s, l) => s + (l.cadeira.horas || 0), 0),
      media: media(feitas.map((l) => l.final)),
    }
  }

  get todasAsDisciplinas() {
    return [...this.anos.flatMap((a) => a.disciplinas), ...this.inscricoes]
  }

  // uma linha por código de cadeira, com o melhor resultado (a aprovação mais recente, se houver)
  get unidadesCurriculares() {
    const porCodigo = new Map()
    for (const l of this.todasAsDisciplinas) {
      const atual = porCodigo.get(l.cadeira.codigo)
      if (!atual || (aprovada(l) && (!aprovada(atual) || (l.final ?? 0) >= (atual.final ?? 0)))) porCodigo.set(l.cadeira.codigo, l)
      else if (!aprovada(atual) && l.situacao !== 'reprovado') porCodigo.set(l.cadeira.codigo, l)
    }
    return [...porCodigo.values()]
  }

  get resumo() {
    return PercursoAcademico.resumir(this.unidadesCurriculares)
  }

  get disciplinasConcluidas() {
    const ucs = this.unidadesCurriculares
    return ucs.length > 0 && ucs.every(aprovada)
  }

  // o que falta para concluir o curso
  get emFalta() {
    if (this.planoCurso) return this.planoCurso.emFalta
    const falta = this.unidadesCurriculares.filter((l) => !aprovada(l)).map((l) => `${l.cadeira.codigo} ${l.cadeira.nome}`)
    if (!this.tfc) falta.push('Trabalho de fim de curso (por lançar)')
    else if (!this.tfc.aprovado) falta.push(this.tfc.defendido ? 'Trabalho de fim de curso (reprovado)' : 'Trabalho de fim de curso (por defender)')
    return falta
  }

  get concluido() {
    if (this.planoCurso) return this.planoCurso.concluido
    return this.disciplinasConcluidas && Boolean(this.tfc?.aprovado)
  }

  get mediaFinal() {
    if (this.planoCurso) return this.planoCurso.concluido ? this.planoCurso.final : null
    if (!this.concluido) return null
    const notas = this.unidadesCurriculares.map((l) => Number(l.final))
    const soma = notas.reduce((s, v) => s + v, 0) + this.tfc.nota * CONCLUSAO_CURSO.pesoTfc
    return Math.round((soma / (notas.length + CONCLUSAO_CURSO.pesoTfc)) * 10) / 10
  }

  get classificacaoFinal() {
    if (this.planoCurso) return this.planoCurso.concluido ? this.planoCurso.mencao : null
    return this.mediaFinal === null ? null : classificacao(Math.round(this.mediaFinal))
  }

  paraJSON() {
    return {
      estudante: this.estudante,
      anos: this.anos.map((a) => ({ ...a, resumo: PercursoAcademico.resumir(a.disciplinas) })),
      inscricoes: this.inscricoes,
      resumo: this.resumo,
      tfc: this.tfc && { ...this.tfc, aprovado: this.tfc.aprovado, classificacao: this.tfc.classificacao },
      conclusao: { concluido: this.concluido, mediaFinal: this.mediaFinal, classificacaoFinal: this.classificacaoFinal, emFalta: this.emFalta },
      planoCurso: this.planoCurso && { nome: this.planoCurso.plano.nome, termo: this.planoCurso.plano.termo, formula: this.planoCurso.plano.formula, blocos: this.planoCurso.blocos, media: this.planoCurso.media, ajuste: this.planoCurso.ajuste, final: this.planoCurso.final, mencao: this.planoCurso.mencao, homologado: Boolean(this.planoCurso.homologado), distinto: Boolean(this.planoCurso.distinto && this.planoCurso.homologado), homologadaEm: this.planoCurso.conselho?.homologadaEm ?? null, estadoConselho: this.planoCurso.conselho?.estado ?? 'aberto' },
      certificado: this.certificado,
    }
  }
}
