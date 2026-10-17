const num = (v) => (v === null || v === undefined ? null : Number(v))
const paraProgresso = (p) => p && { ...p, nota: num(p.nota), criadoEm: p.criadoEm.toISOString(), atualizadoEm: p.atualizadoEm.toISOString() }

// progresso dos estudantes nos pacotes SCORM e H5P
export class RepositorioPacotes {
  constructor({ prisma }) {
    this.prisma = prisma
  }

  async progresso(materialId, estudanteId) {
    return paraProgresso(await this.prisma.progressoPacote.findUnique({ where: { materialId_estudanteId: { materialId, estudanteId } } }))
  }

  async guardar(materialId, estudanteId, dados) {
    return paraProgresso(await this.prisma.progressoPacote.upsert({
      where: { materialId_estudanteId: { materialId, estudanteId } },
      create: { materialId, estudanteId, ...dados },
      update: dados,
    }))
  }

  async doMaterial(materialId) {
    return (await this.prisma.progressoPacote.findMany({ where: { materialId } })).map(paraProgresso)
  }

  atualizarEstrutura(materialId, estrutura) {
    return this.prisma.material.update({ where: { id: materialId }, data: { estrutura } })
  }
}
