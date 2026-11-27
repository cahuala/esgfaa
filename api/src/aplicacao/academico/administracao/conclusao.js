import { NaoEncontrado, Conflito, ErroValidacao } from '../../../dominio/comum/erros.js'
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

  /*
    O diploma e o certificado de conclusão do curso: a Administração Escolar envia ao Comandante e só ficam
    disponíveis (para imprimir, no percurso do estudante e na verificação pública) quando ele aprovar. Quando é
    o próprio Comandante a emitir, ou sem a aprovação do Comandante configurada, ficam logo aprovados.
    Abrir a página não envia nada: só «pedir» envia (e reenvia um que foi recusado).
  */
  async emitirCertificado(ctx, turmaId, estudanteId, { pedir = false } = {}) {
    ctx.actor.exigir('academico.gerir')
    return this.#documentos(ctx, await this.#turma(turmaId), await this.#estudante(estudanteId), { pedir })
  }

  /*
    Os diplomas e certificados de uma turma de uma só vez (também os de anos anteriores, para a 2.ª via): a situação
    de cada estudante e, para os aprovados, o percurso com que se geram os PDF.
  */
  async certificadosDaTurma(ctx, turmaId) {
    ctx.actor.exigir('academico.gerir')
    const turma = await this.#turma(turmaId)
    const estudantes = []
    for (const e of await this.academico.estudantesDaPauta(turma.id)) {
      const estudante = await this.#estudante(e.id)
      try {
        estudantes.push(await this.#documentos(ctx, turma, estudante, { consultar: true }))
      } catch (falha) {
        if (!(falha instanceof Conflito)) throw falha
        estudantes.push({ estado: 'nao concluido', motivo: falha.message, estudante, percurso: null })
      }
    }
    const direto = !this.aprovacaoComandante || ctx.actor.pode('academico.homologar')
    return { turma: { id: turma.id, nome: turma.nome, anoLetivo: turma.anoLetivo, curso: turma.curso }, direto, estudantes }
  }

  // envia ao Comandante os de vários estudantes da turma (um só pedido e um só aviso)
  async pedirCertificados(ctx, turmaId, estudanteIds) {
    ctx.actor.exigir('academico.gerir')
    const turma = await this.#turma(turmaId)
    const daTurma = new Set((await this.academico.estudantesDaPauta(turma.id)).map((e) => e.id))
    let enviados = 0
    const erros = []
    for (const id of [...new Set(estudanteIds)].filter((x) => daTurma.has(x))) {
      const estudante = await this.#estudante(id)
      try {
        const r = await this.#documentos(ctx, turma, estudante, { pedir: true, aviso: false })
        if (r.novo) enviados++
      } catch (falha) {
        if (!(falha instanceof Conflito)) throw falha
        erros.push(`${estudante.nome}: ${falha.message}`)
      }
    }
    const direto = !this.aprovacaoComandante || ctx.actor.pode('academico.homologar')
    if (enviados && !direto) await this.auditoria.registar(ctx, { acao: 'pedir_aprovacao_certificado', colecao: 'certificados', alvoTitulo: `${turma.nome} (${turma.anoLetivo}): ${enviados} estudante(s)` })
    return { enviados, erros, ...(await this.certificadosDaTurma(ctx, turma.id)) }
  }

  async #documentos(ctx, turma, estudante, { pedir = false, aviso = true, consultar = false } = {}) {
    const percurso = await this.percursos.de(estudante.id, { publicadas: false, estudante })
    const existente = (await this.conclusao.certificadosDoEstudante(estudante.id)).find((c) => c.turmaId === turma.id)
    if (!existente && !percurso.concluido) throw new Conflito(`O curso ainda não está concluído: ${percurso.emFalta.slice(0, 3).join('; ')}.`)
    if (!existente && percurso.planoCurso && !percurso.planoCurso.homologado) throw new Conflito('A classificação final ainda não foi homologada pelo Comandante (Conselho de Curso).')
    const direto = !this.aprovacaoComandante || ctx.actor.pode('academico.homologar')
    const agora = this.relogio.agora().toISOString()
    const pedido = { pedidoPor: ctx.actor.nome ?? '', pedidoEm: agora, ...(direto ? { decididoPor: ctx.actor.nome ?? '', decididoEm: agora } : {}) }
    const estado = direto ? 'aprovado' : 'pendente'
    // o aviso por e-mail ao Comandante vai com o pedido de um só; nos de vários, vai um no fim
    const acaoPedido = direto ? 'emitir_certificado_curso' : aviso ? 'pedir_aprovacao_certificado' : 'pedir_certificado_curso'
    let novo = false
    let cert = existente
    if (!cert) {
      if ((!direto && !pedir) || consultar) return { estado: 'por pedir', direto, estudante, turmaId: turma.id, curso: await this.#nomeDoCurso(turma.curso), media: percurso.mediaFinal, percurso: null }
      cert = await this.conclusao.emitirCertificado({
        codigo: novoCodigo(), estudanteId: estudante.id, turmaId: turma.id, curso: await this.#nomeDoCurso(turma.curso),
        media: percurso.mediaFinal, notaTfc: percurso.tfc?.nota ?? percurso.planoCurso?.ucs?.find((u) => u.tii)?.final ?? null, emitidoEm: this.relogio.agora(),
        estado, aprovacao: pedido,
      })
      await this.auditoria.registar(ctx, { acao: acaoPedido, colecao: 'certificados', alvoId: estudante.id, alvoTitulo: `${cert.codigo} — ${estudante.nome} (${turma.nome})` })
      novo = true
    } else if (cert.estado === 'recusado' && pedir) {
      await this.conclusao.mudarEstadoCertificado(cert.codigo, { de: 'recusado', para: estado, aprovacao: pedido })
      cert = { ...cert, estado, aprovacao: pedido }
      await this.auditoria.registar(ctx, { acao: acaoPedido, colecao: 'certificados', alvoId: estudante.id, alvoTitulo: `${cert.codigo} — ${estudante.nome} (${turma.nome})` })
      novo = true
    }
    // só o aprovado leva o percurso (com que se gera o PDF)
    if (cert.estado !== 'aprovado') return { ...cert, estudante, percurso: null, novo }
    return { ...cert, estudante, percurso: percurso.paraJSON(), novo }
  }

  // ---------- o que espera pelo Comandante ----------

  // por turma: os diplomas e certificados enviados pela Administração Escolar
  async paraAprovar() {
    const porTurma = new Map()
    for (const c of await this.conclusao.certificadosPendentes()) {
      if (!porTurma.has(c.turmaId)) porTurma.set(c.turmaId, [])
      porTurma.get(c.turmaId).push(c)
    }
    return [...porTurma].map(([turmaId, cs]) => ({
      colecao: 'certificados_curso', id: String(turmaId), tipo: 'certificados', ligacao: `/academico/turmas/${turmaId}`,
      titulo: `Diplomas e certificados — ${cs[0].turma?.nome ?? ''} (${cs[0].turma?.anoLetivo ?? ''}): ${cs.length} ${cs.length === 1 ? 'estudante' : 'estudantes'}`,
      pedidoPor: cs[0].aprovacao?.pedidoPor ?? '', pedidoEm: cs[0].aprovacao?.pedidoEm ?? cs[0].emitidoEm,
      resumo: cs.map((c) => `${c.estudante?.nome ?? ''} — média final ${c.media === null ? '—' : c.media.toFixed(2).replace('.', ',')} (código ${c.codigo})`).join('\n'),
    }))
  }

  async contarParaAprovar() {
    return this.conclusao.contarCertificadosPendentes()
  }

  // o Comandante aprova (ficam disponíveis) ou recusa (com o motivo, que a Administração Escolar vê) os de uma turma
  async decidirCertificados(ctx, turmaId, { decisao, motivo }) {
    ctx.actor.exigir('academico.homologar')
    const cs = (await this.conclusao.certificadosPendentes()).filter((c) => String(c.turmaId) === String(turmaId))
    if (!cs.length) throw new Conflito('Estes diplomas e certificados não estão à espera de aprovação.')
    const m = String(motivo ?? '').trim()
    if (decisao !== 'aprovar' && m.length < 3) throw new ErroValidacao('Indique o motivo (a Administração Escolar vê-o).', { campo: 'motivo' })
    const agora = this.relogio.agora().toISOString()
    const para = decisao === 'aprovar' ? 'aprovado' : 'recusado'
    let n = 0
    for (const c of cs) if (await this.conclusao.mudarEstadoCertificado(c.codigo, { de: 'pendente', para, aprovacao: { ...c.aprovacao, decididoPor: ctx.actor.nome ?? '', decididoEm: agora, ...(m ? { motivo: m } : {}) } })) n++
    await this.auditoria.registar(ctx, { acao: decisao === 'aprovar' ? 'aprovar_certificados_curso' : 'recusar_certificados_curso', colecao: 'certificados', alvoTitulo: `${cs[0].turma?.nome ?? ''}: ${n} diploma(s) e certificado(s)`, detalhes: { turmaId: Number(turmaId), quantos: n, ...(m ? { motivo: m } : {}) } })
    return { decisao: decisao === 'aprovar' ? 'aprovar' : 'recusar', certificados: n }
  }
}
