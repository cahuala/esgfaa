import { eDuplicado } from '../bd/prisma.js'

const iso = (d) => (d ? new Date(d).toISOString() : null)
const num = (d) => (d === null || d === undefined ? null : Number(d))
const conta = { select: { id: true, nome: true, numero: true, email: true, dados: true } }

const paraTfc = (t) => t && {
  id: t.id, estudanteId: t.estudanteId, turmaId: t.turmaId, tema: t.tema, orientador: t.orientador, juri: t.juri,
  dataDefesa: t.dataDefesa, nota: num(t.nota), observacao: t.observacao, atualizadoEm: iso(t.atualizadoEm),
}
const paraCertificado = (c) => c && {
  codigo: c.codigo, estudanteId: c.estudanteId, turmaId: c.turmaId, curso: c.curso, media: num(c.media), notaTfc: num(c.notaTfc), emitidoEm: iso(c.emitidoEm),
  ...(c.estudante ? { estudante: c.estudante } : {}), ...(c.turma ? { turma: { id: c.turma.id, nome: c.turma.nome, anoLetivo: c.turma.anoLetivo, curso: c.turma.curso } } : {}),
}

// trabalhos de fim de curso e certificados de conclusão do curso
export class RepositorioConclusao {
  constructor({ prisma }) {
    this.prisma = prisma
  }

  async tfcsDoEstudante(estudanteId) {
    return (await this.prisma.trabalhoFimCurso.findMany({ where: { estudanteId }, orderBy: { id: 'desc' } })).map(paraTfc)
  }

  async tfcsDaTurma(turmaId) {
    return (await this.prisma.trabalhoFimCurso.findMany({ where: { turmaId } })).map(paraTfc)
  }

  async gravarTfc(estudanteId, turmaId, dados, quando) {
    return paraTfc(await this.prisma.trabalhoFimCurso.upsert({
      where: { estudanteId_turmaId: { estudanteId, turmaId } },
      create: { estudanteId, turmaId, ...dados, atualizadoEm: quando }, update: { ...dados, atualizadoEm: quando },
    }))
  }

  async certificadosDoEstudante(estudanteId) {
    return (await this.prisma.certificadoCurso.findMany({ where: { estudanteId }, include: { turma: true }, orderBy: { emitidoEm: 'desc' } })).map(paraCertificado)
  }

  async certificadosDaTurma(turmaId) {
    return (await this.prisma.certificadoCurso.findMany({ where: { turmaId } })).map(paraCertificado)
  }

  // emite uma só vez: dois pedidos ao mesmo tempo devolvem o mesmo certificado
  async emitirCertificado(dados) {
    const onde = { estudanteId_turmaId: { estudanteId: dados.estudanteId, turmaId: dados.turmaId } }
    try {
      return paraCertificado(await this.prisma.certificadoCurso.upsert({ where: onde, create: dados, update: {}, include: { turma: true } }))
    } catch (e) {
      if (!eDuplicado(e)) throw e
      return paraCertificado(await this.prisma.certificadoCurso.findUnique({ where: onde, include: { turma: true } }))
    }
  }

  async certificado(codigo) {
    if (!/^[A-Z0-9]{8,16}$/.test(codigo)) return null
    return paraCertificado(await this.prisma.certificadoCurso.findUnique({ where: { codigo }, include: { estudante: conta, turma: true } }))
  }
}
