import { NaoEncontrado, Conflito } from '../../../dominio/comum/erros.js'
import { TrabalhoFimCurso } from '../../../dominio/academico/conclusao/tfc.js'
import { novoCodigo } from '../../../dominio/academico/conclusao/codigo.js'

/*
  Conclusão do curso (Administração Escolar): trabalho de fim de curso dos finalistas,
  histórico académico de cada estudante e certificado de conclusão do curso.
*/
const CHAVE_DOCUMENTOS = 'documentos-academicos'
const CHAVE_ASSINATURAS_PESSOAL = 'assinaturas-do-pessoal'
const PADRAO_DOCUMENTOS = {
  directorEnsino: { cargo: 'O DIRECTOR DE ENSINO', nome: '', posto: '' },
  comandante: { cargo: 'O COMANDANTE DA ESG', nome: '', posto: '' },
  turmas: {}, // { [turmaId]: { edicao: '17.º', inicio: 'AAAA-MM-DD', fim: 'AAAA-MM-DD' } }
}

export class ServicoConclusaoCurso {
  constructor(dependencias) {
    Object.assign(this, dependencias)
  }

  async #turma(id) {
    const t = await this.academico.turma(id)
    if (!t) throw new NaoEncontrado('Turma não encontrada.')
    return t
  }

  async #nomeDoCurso(curso) {
    return (await this.conteudos.listar('cursos')).find((c) => c.id === curso)?.titulo || curso
  }

  async #estudante(id) {
    const e = await this.contas.porId(id)
    if (!e || e.tipo !== 'estudante') throw new NaoEncontrado('Estudante não encontrado.')
    return e.publico()
  }

  // finalistas da turma: TFC, estado das disciplinas, média final e certificado
  async finalistas(ctx, turmaId) {
    ctx.actor.exigir('academico.ver')
    const turma = await this.#turma(turmaId)
    const estudantes = await this.academico.estudantesDaPauta(turma.id)
    const linhas = await Promise.all(estudantes.map(async (e) => {
      const p = (await this.percursos.de(e.id, { publicadas: false })).paraJSON()
      return { estudante: e, tfc: p.tfc, resumo: p.resumo, conclusao: p.conclusao, certificado: p.certificado }
    }))
    return { turma: { id: turma.id, nome: turma.nome, anoLetivo: turma.anoLetivo, anoFinal: turma.anoFinal, curso: await this.#nomeDoCurso(turma.curso) }, linhas }
  }

  async lancarTfc(ctx, turmaId, estudanteId, dados) {
    ctx.actor.exigir('academico.gerir')
    const turma = await this.#turma(turmaId)
    if (!turma.anoFinal) throw new Conflito('Marque a turma como turma de finalistas antes de lançar trabalhos de fim de curso.')
    const id = Number(estudanteId)
    if (!(await this.academico.estudantesDaPauta(turma.id)).some((e) => e.id === id)) throw new NaoEncontrado('O estudante não pertence à turma.')
    const tfc = await this.conclusao.gravarTfc(id, turma.id, TrabalhoFimCurso.validar(dados), this.relogio.agora())
    await this.auditoria.registar(ctx, { acao: 'lancar_tfc', colecao: 'tfc', alvoId: tfc.id, alvoTitulo: tfc.tema, detalhes: { nota: tfc.nota } })
    if (tfc.nota !== null) {
      await this.notificacoes?.notificar([id], { tipo: 'notas', titulo: 'Nota do trabalho de fim de curso lançada', texto: `${tfc.nota} valores — ${tfc.tema}`, ligacao: '/percurso' })
    }
    return tfc
  }

  // histórico académico completo (todas as notas lançadas), para imprimir
  async historico(ctx, estudanteId) {
    ctx.actor.exigir('academico.ver')
    const estudante = await this.#estudante(estudanteId)
    const p = (await this.percursos.de(estudante.id, { publicadas: false, estudante })).paraJSON()
    const cursos = [...new Set(p.anos.map((a) => a.turma.curso))]
    return { ...p, cursos: await Promise.all(cursos.map((c) => this.#nomeDoCurso(c))), emitidoEm: this.relogio.agora().toISOString() }
  }

  // certificado de conclusão do curso: só com o curso concluído; emitir outra vez devolve o mesmo
  /*
    Diplomas e certificados: quem assina (Director de Ensino e Comandante) e, por turma, a edição do curso e
    as datas em que decorreu. Só a Administração Escolar os define e imprime.
  */
  /*
    Quem assina os diplomas e certificados: quem ocupa hoje o cargo (vem do Sistema de Pessoal, pelo
    quadro orgânico); só se o Pessoal não o souber (cargo vago, ligação ainda não feita) se usa o nome
    escrito aqui. Cada assinante vem com a origem: «pessoal» (titular ou substituto) ou «manual».
  */
  async documentosAcademicos(ctx) {
    ctx.actor.exigir('academico.ver')
    const guardado = { ...PADRAO_DOCUMENTOS, ...((await this.paginas.ler(CHAVE_DOCUMENTOS)) ?? {}) }
    const doPessoal = (await this.paginas.ler(CHAVE_ASSINATURAS_PESSOAL)) ?? null
    const efectivo = (k) => {
      const p = doPessoal?.assinaturas?.[k]
      return p?.nome && p.origem !== 'manual' ? { cargo: p.cargo, nome: p.nome, posto: p.posto, origem: 'pessoal', substituto: p.origem === 'substituto' } : { ...guardado[k], origem: 'manual' }
    }
    return { ...guardado, directorEnsino: efectivo('directorEnsino'), comandante: efectivo('comandante'), manual: { directorEnsino: guardado.directorEnsino, comandante: guardado.comandante }, doPessoalEm: doPessoal?.recebidoEm ?? null }
  }

  async guardarDocumentosAcademicos(ctx, dados) {
    ctx.actor.exigir('academico.gerir')
    const atual = { ...PADRAO_DOCUMENTOS, ...((await this.paginas.ler(CHAVE_DOCUMENTOS)) ?? {}) }
    // só se guardam os nomes escritos à mão (os do Pessoal não se sobrepõem)
    const limpo = (x) => (x ? { cargo: x.cargo ?? '', nome: x.nome ?? '', posto: x.posto ?? '' } : undefined)
    const novo = { ...atual, ...(dados.directorEnsino && dados.directorEnsino.origem !== 'pessoal' ? { directorEnsino: limpo(dados.directorEnsino) } : {}), ...(dados.comandante && dados.comandante.origem !== 'pessoal' ? { comandante: limpo(dados.comandante) } : {}), turmas: { ...atual.turmas, ...(dados.turmas ?? {}) } }
    await this.paginas.guardar(CHAVE_DOCUMENTOS, novo, ctx.actor.id)
    return this.documentosAcademicos(ctx)
  }

  // do Sistema de Pessoal (pedido assinado): quem ocupa hoje os cargos que assinam
  async receberAssinaturasDoPessoal(ctx, assinaturas) {
    await this.paginas.guardar(CHAVE_ASSINATURAS_PESSOAL, { assinaturas, recebidoEm: this.relogio.agora().toISOString() }, null)
    await this.auditoria.registar(ctx, { acao: 'assinaturas_do_pessoal', colecao: 'documentos', alvoTitulo: `Assinaturas: ${assinaturas.comandante?.nome || '—'} (Comandante), ${assinaturas.directorEnsino?.nome || '—'} (Director de Ensino)`, utilizador: null })
    return { ok: true }
  }

  async emitirCertificado(ctx, turmaId, estudanteId) {
    ctx.actor.exigir('academico.gerir')
    const turma = await this.#turma(turmaId)
    const estudante = await this.#estudante(estudanteId)
    const percurso = await this.percursos.de(estudante.id, { publicadas: false, estudante })
    const existente = (await this.conclusao.certificadosDoEstudante(estudante.id)).find((c) => c.turmaId === turma.id)
    if (!existente && !percurso.concluido) throw new Conflito(`O curso ainda não está concluído: ${percurso.emFalta.slice(0, 3).join('; ')}.`)
    if (!existente && percurso.planoCurso && !percurso.planoCurso.homologado) throw new Conflito('A classificação final ainda não foi homologada pelo Comandante (Conselho de Curso).')
    const cert = existente || await this.conclusao.emitirCertificado({
      codigo: novoCodigo(), estudanteId: estudante.id, turmaId: turma.id, curso: await this.#nomeDoCurso(turma.curso),
      media: percurso.mediaFinal, notaTfc: percurso.tfc?.nota ?? percurso.planoCurso?.ucs?.find((u) => u.tii)?.final ?? null, emitidoEm: this.relogio.agora(),
    })
    if (!existente) await this.auditoria.registar(ctx, { acao: 'emitir_certificado_curso', colecao: 'certificados', alvoId: estudante.id, alvoTitulo: `${cert.codigo} — ${estudante.nome}` })
    return { ...cert, estudante, percurso: percurso.paraJSON() }
  }
}
