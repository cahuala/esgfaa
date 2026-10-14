import { assiduidade } from '../../../dominio/academico/atividades/presencas.js'
import { notasVisiveis } from '../../../dominio/academico/avaliacao/resultado.js'
import { escolha, texto } from '../../../dominio/academico/comum/validacao.js'
import { TIPOS_PEDIDO } from '../../../dominio/academico/secretaria/pedidos.js'
import { quem } from '../partilhado/autor.js'

// O que o estudante consulta: notas, percurso, horário, presenças, pedidos de documentos e avisos gerais.
export class ServicoEstudante {
  constructor(dependencias) {
    Object.assign(this, dependencias)
  }

  async notas(ctx) {
    this.apoio.soEstudante(ctx.conta)
    const cadeiras = await this.apoio.minhasCadeiras(ctx.conta)
    for (const c of cadeiras) await this.pautas.sincronizar(c) // componentes calculadas em dia
    const notas = await this.academico.notasDoEstudante(ctx.conta.id, cadeiras.map((c) => c.id))
    // boletim em matriz: uma linha por disciplina, uma coluna por componente
    return cadeiras.map((c) => ({
      cadeira: { id: c.id, codigo: c.codigo, nome: c.nome, periodo: c.periodo, horas: c.horas, docente: c.docente?.nome || '' },
      publicadas: c.notasPublicadas,
      ...notasVisiveis(notas[c.id], c.notasPublicadas),
    }))
  }

  /*
    Percurso académico: todas as matrículas do estudante (ano a ano), com as disciplinas de cada uma,
    as notas publicadas, a situação e um resumo (aprovadas, horas concluídas, média das aprovadas).
  */
  async percurso(ctx) {
    this.apoio.soEstudante(ctx.conta)
    const matriculas = await this.academico.percursoDoEstudante(ctx.conta.id)
    const cadeiras = await this.academico.cadeirasDasTurmas(matriculas.map((m) => m.turma.id))
    const notas = await this.academico.notasDoEstudante(ctx.conta.id, cadeiras.map((c) => c.id))
    const aprovada = (l) => l.situacao === 'aprovado' || l.situacao === 'dispensado'
    const resumir = (linhas) => {
      const feitas = linhas.filter(aprovada)
      return {
        disciplinas: linhas.length,
        aprovadas: feitas.length,
        reprovadas: linhas.filter((l) => l.situacao === 'reprovado').length,
        emCurso: linhas.length - feitas.length - linhas.filter((l) => l.situacao === 'reprovado').length,
        horas: linhas.reduce((s, l) => s + l.cadeira.horas, 0),
        horasAprovadas: feitas.reduce((s, l) => s + l.cadeira.horas, 0),
        media: feitas.length ? Math.round((feitas.reduce((s, l) => s + l.final, 0) / feitas.length) * 10) / 10 : null,
      }
    }
    const anos = matriculas.map((m) => {
      const linhas = cadeiras.filter((c) => c.turmaId === m.turma.id).map((c) => ({
        cadeira: { id: c.id, codigo: c.codigo, nome: c.nome, periodo: c.periodo, horas: c.horas, docente: c.docente?.nome || '' },
        ...notasVisiveis(notas[c.id], c.notasPublicadas),
      }))
      return { matricula: { id: m.id, estado: m.estado }, turma: m.turma, disciplinas: linhas, resumo: resumir(linhas) }
    })
    return { anos, resumo: resumir(anos.flatMap((a) => a.disciplinas)) }
  }

  async horario(ctx) {
    const cadeiras = await this.apoio.minhasCadeiras(ctx.conta)
    return this.academico.horariosDasCadeiras(cadeiras.map((c) => c.id))
  }

  async presencas(ctx) {
    this.apoio.soEstudante(ctx.conta)
    const cadeiras = await this.apoio.minhasCadeiras(ctx.conta)
    const todas = await this.academico.presencasDoEstudante(ctx.conta.id, cadeiras.map((c) => c.id))
    return cadeiras.map((c) => {
      const dela = todas.filter((p) => p.cadeiraId === c.id)
      return { cadeira: { id: c.id, nome: c.nome }, aulas: dela.length, faltas: dela.filter((p) => p.estado === 'falta').length, assiduidade: assiduidade(dela) }
    })
  }

  async pedidos(ctx) {
    this.apoio.soEstudante(ctx.conta)
    return this.academico.pedidos({ estudanteId: ctx.conta.id })
  }

  async criarPedido(ctx, { tipo, motivo }) {
    this.apoio.soEstudante(ctx.conta)
    const p = await this.academico.criarPedido({
      estudanteId: ctx.conta.id,
      tipo: escolha(tipo, 'tipo', 'Tipo de documento', TIPOS_PEDIDO),
      motivo: texto(motivo, 'motivo', 'Motivo', { max: 1000, obrigatorio: tipo === 'Outro', min: tipo === 'Outro' ? 5 : 1 }),
    })
    await this.auditoria.registar(ctx, { acao: 'pedido_documento', colecao: 'pedidos', alvoId: p.id, alvoTitulo: p.tipo, utilizador: quem(ctx.conta) })
    return p
  }

  async avisosGerais(ctx) {
    this.apoio.soEstudante(ctx.conta)
    return this.academico.avisosGerais(await this.academico.turmasAtivas(ctx.conta.id))
  }
}
