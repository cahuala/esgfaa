import { Conflito, ErroValidacao, NaoEncontrado } from '../../../dominio/comum/erros.js'
import { NOMES_COMPONENTES } from '../../../dominio/academico/avaliacao/resultado.js'
import { senhaInicial } from '../../../dominio/academico/pessoas/contas.js'
import { ordenarPorHierarquia } from '../../../dominio/academico/pessoas/hierarquia.js'
import { CHAVE_DIRECTORES } from './turmas.js'

const PAPEIS = { regente: 'regente', assistente: 'assistente' }
const media = (m) => (m === null ? '—' : m.toFixed(1).replace('.', ','))

/*
  O que o Ensino faz e só vale com a aprovação do Comandante (em «Por aprovar», no painel):
  - a distribuição dos docentes pelas cadeiras de um ano lectivo (uma só lista para todas as turmas): o Ensino põe
    os docentes nas cadeiras (ficam propostos, sem acesso), revê, imprime e envia a lista; o Comandante aprova (os docentes passam a ter a cadeira e, na
    primeira aprovação, recebem a conta do portal por e-mail), manda refazer (volta ao Ensino com as recomendações,
    os docentes propostos ficam para corrigir) ou rejeita (os docentes propostos saem das cadeiras e faz-se uma lista
    nova). Ao aprovar também pode deixar recomendações; o Ensino vê-as na Alocação de docentes;
  - a publicação das notas (provas parcelares, exames, TAI/TAG): o docente pede e os estudantes só as veem
    quando o Director de Ensino aprova (ou o Comandante); se recusar, o docente vê o motivo;
  - os diplomas e certificados de conclusão do curso: a Administração Escolar envia e só ficam disponíveis
    quando o Comandante aprova (por turma).
*/
export class ServicoAprovacoesComandante {
  constructor(dependencias) {
    Object.assign(this, dependencias)
  }

  // ---------- distribuição dos docentes (Ensino) ----------

  async enviarDistribuicao(ctx, anoLetivo) {
    ctx.actor.exigir('academico.gerir')
    const turmas = await this.controlo.turmasDoAno(anoLetivo)
    if (!turmas.length) throw new NaoEncontrado('Não há turmas activas neste ano lectivo.')
    if (turmas.some((t) => t.distribuicao?.estado === 'pendente')) throw new Conflito('A distribuição deste ano lectivo já está à espera do Comandante.')
    const propostos = turmas.flatMap((t) => t.cadeiras.flatMap((c) => c.docentes.filter((d) => d.estado === 'proposta')))
    if (!propostos.length) throw new ErroValidacao('Não há docentes propostos neste ano lectivo: ponha primeiro os docentes nas cadeiras.')
    const pedido = { estado: 'pendente', anoLetivo, pedidoPor: ctx.actor.nome ?? '', pedidoEm: this.relogio.agora().toISOString() }
    for (const t of turmas) await this.controlo.guardarDistribuicao(t.id, pedido)
    await this.auditoria.registar(ctx, { acao: 'pedir_aprovacao_distribuicao', colecao: 'turmas', alvoTitulo: `Ano lectivo ${anoLetivo}`, detalhes: { propostos: propostos.length, turmas: turmas.length } })
    return { enviada: true, propostos: propostos.length }
  }

  /*
    A lista para imprimir e assinar (o Director de Ensino em baixo, o Comandante a aprovar em cima): cada docente,
    pela ordem hierárquica, com as cadeiras e as horas no ano lectivo; no fim, as cadeiras ainda sem docente.
  */
  async listaDoAno(ctx, anoLetivo) {
    ctx.actor.exigir('academico.ver')
    const turmas = await this.controlo.turmasDoAno(anoLetivo)
    const porDocente = new Map()
    const semDocente = []
    for (const t of turmas) {
      for (const c of t.cadeiras) {
        if (!c.docentes.length) semDocente.push({ codigo: c.codigo, nome: c.nome, turma: t.nome })
        for (const d of c.docentes) {
          const x = porDocente.get(d.docente.id) ?? { id: d.docente.id, nome: d.docente.nome, numero: d.docente.numero, dados: d.docente.dados, posto: d.docente.dados?.posto ?? '', cadeiras: [], horas: 0 }
          x.cadeiras.push({ codigo: c.codigo, nome: c.nome, turma: t.nome, papel: PAPEIS[d.papel] ?? d.papel, horas: d.horas, estado: d.estado })
          x.horas += d.horas
          porDocente.set(x.id, x)
        }
      }
    }
    const estados = turmas.map((t) => t.distribuicao).filter(Boolean)
    const decisao = estados.find((e) => e.estado === 'pendente') ?? estados.sort((a, b) => String(b.decididoEm ?? '').localeCompare(String(a.decididoEm ?? '')))[0] ?? null
    return {
      anoLetivo, turmas: turmas.length, distribuicao: decisao, semDocente,
      docentes: ordenarPorHierarquia([...porDocente.values()]).map(({ dados, ...x }) => (void dados, x)),
    }
  }

  // ---------- o que espera pelo Comandante (lista de «Por aprovar») ----------

  async paraAprovar(ctx) {
    if (!this.aprovacaoComandante) return []
    // o Director de Ensino aprova a publicação das notas; o resto é do Comandante
    if (!ctx.actor.pode('academico.homologar')) return ctx.actor.pode('academico.conselho') ? this.#notasPorPublicar() : []
    // uma só lista por ano lectivo (todas as turmas)
    const porAno = new Map()
    for (const t of await this.controlo.turmasComDistribuicaoPendente()) {
      const k = t.distribuicao.anoLetivo ?? t.anoLetivo
      if (!porAno.has(k)) porAno.set(k, [])
      porAno.get(k).push(t)
    }
    const distribuicoes = [...porAno].map(([ano, ts]) => {
      const linhas = ts.flatMap((t) => t.cadeiras.flatMap((c) => c.docentes.map((d) => ({ d, c, t }))))
      const docentes = new Set(linhas.map((x) => x.d.docente.id))
      return {
        colecao: 'distribuicao_docente', id: ano, tipo: 'distribuicao', ligacao: `/academico/documentos/distribuicao?ano=${encodeURIComponent(ano)}`,
        titulo: `Ano lectivo ${ano}: ${docentes.size} docente(s) em ${linhas.length} cadeira(s) de ${ts.length} turma(s)`,
        pedidoPor: ts[0].distribuicao.pedidoPor, pedidoEm: ts[0].distribuicao.pedidoEm,
        resumo: linhas.map(({ d, c, t }) => `${d.docente.nome} — ${c.codigo} ${c.nome} (${t.nome}; ${PAPEIS[d.papel] ?? d.papel}, ${d.horas} h)${d.estado === 'proposta' ? ' — NOVO' : ''}`).join('\n'),
      }
    })
    return [...distribuicoes, ...(await this.#notasPorPublicar()), ...(await this.#directoresPropostos()), ...(await this.#reaberturas()), ...((await this.certificadosCurso?.paraAprovar()) ?? [])]
  }

  // as provas com a publicação das notas pedida (aprova o Director de Ensino; o Comandante também pode)
  async #notasPorPublicar() {
    const notas = []
    for (const c of await this.controlo.cadeirasComPublicacaoPendente()) {
      const p = c.publicacaoPedida
      const r = await this.controlo.resumoNotas(c.id, p.componentes ?? [])
      notas.push({
        colecao: 'publicacao_notas', id: `uc-${c.id}`, tipo: 'notas', titulo: `${(p.componentes ?? []).map((k) => NOMES_COMPONENTES[k]).join(', ')} — ${c.nome} (${c.turma.nome})`,
        pedidoPor: p.pedidoPor, pedidoEm: p.pedidoEm, ligacao: `/academico/cadeiras/${c.id}?separador=pauta`,
        resumo: r.map((x) => `${NOMES_COMPONENTES[x.componente]}: ${x.notas} nota(s), média ${media(x.media)}, ${x.positivas} positiva(s)`).join('\n'),
      })
    }
    for (const a of await this.controlo.avaliacoesComPublicacaoPendente()) {
      const r = await this.controlo.resumoNotasProva(a.id)
      notas.push({
        colecao: 'publicacao_notas', id: `av-${a.id}`, tipo: 'notas', titulo: `${a.tipo} ${a.titulo} — ${a.cadeira.nome} (${a.cadeira.turma.nome})`,
        pedidoPor: a.publicacaoPedida.pedidoPor, pedidoEm: a.publicacaoPedida.pedidoEm, ligacao: `/academico/cadeiras/${a.cadeiraId}?separador=pauta`,
        resumo: `${r.notas} nota(s), média ${media(r.media)}, ${r.positivas} positiva(s)`,
      })
    }
    return notas
  }

  // ---------- reabrir um ano lectivo fechado (pedido da Administração Escolar) ----------

  async #reaberturas() {
    const FINS = { actividades: 'para lançar notas ou outras actividades', documento: 'para emitir um documento' }
    const fechos = ((await this.anosLetivos?.fechosPendentes()) ?? []).map((a) => ({
      colecao: 'ano_letivo', id: a.id, tipo: 'fecho', ligacao: '/academico/anos-letivos',
      titulo: `Fechar o ano lectivo ${a.id}`,
      pedidoPor: a.pedidoFecho.pedidoPor, pedidoEm: a.pedidoFecho.pedidoEm,
      resumo: [a.pedidoFecho.motivo && `Motivo: ${a.pedidoFecho.motivo}`, 'Fechado, já não se alteram as turmas, cadeiras, matrículas, notas e actividades desse ano, nem se emitem documentos dele.'].filter(Boolean).join('\n'),
    }))
    return [...fechos, ...((await this.anosLetivos?.reaberturasPendentes()) ?? []).map((a) => ({
      colecao: 'ano_letivo', id: a.id, tipo: 'reabertura', ligacao: '/academico/anos-letivos',
      titulo: `Reabrir o ano lectivo ${a.id} ${FINS[a.pedidoReabertura.finalidade] ?? ''}`.trim(),
      pedidoPor: a.pedidoReabertura.pedidoPor, pedidoEm: a.pedidoReabertura.pedidoEm,
      resumo: [a.pedidoReabertura.documento && `Documento: ${a.pedidoReabertura.documento}`, `Motivo: ${a.pedidoReabertura.motivo}`, a.fechadoPor && `Fechado por ${a.fechadoPor}`].filter(Boolean).join('\n'),
    }))]
  }

  // ---------- Director de Curso (proposto pela Administração Escolar) ----------

  async #directoresPropostos() {
    const guardado = (await this.paginas?.ler(CHAVE_DIRECTORES)) ?? {}
    const pendentes = Object.entries(guardado).filter(([, x]) => x.proposta)
    if (!pendentes.length) return []
    const cursos = new Map((await this.conteudos.listar('cursos')).map((c) => [c.id, (c.dados ?? c).nome]))
    const contas = new Map((await this.utilizadores.listar()).map((u) => [u.id, u]))
    return pendentes.map(([curso, x]) => {
      const novo = x.proposta.utilizadorId ? contas.get(x.proposta.utilizadorId) : null
      const antes = x.utilizadorId ? contas.get(x.utilizadorId) : null
      return {
        colecao: 'director_curso', id: curso, tipo: 'director_curso',
        titulo: novo ? `${novo.nome} — Director do ${cursos.get(curso) ?? curso}` : `Retirar o Director do ${cursos.get(curso) ?? curso}`,
        pedidoPor: x.proposta.pedidoPor, pedidoEm: x.proposta.pedidoEm,
        resumo: [novo && `Proposto: ${novo.nome}${novo.cargo ? ` (${novo.cargo})` : ''}`, `Director actual: ${antes ? antes.nome : 'nenhum'}`].filter(Boolean).join('\n'),
      }
    })
  }

  async decidirDirectorCurso(ctx, curso, { decisao, motivo }) {
    ctx.actor.exigir('academico.homologar')
    const guardado = (await this.paginas.ler(CHAVE_DIRECTORES)) ?? {}
    const x = guardado[curso]
    if (!x?.proposta) throw new Conflito('Esta designação não está à espera de aprovação.')
    const agora = this.relogio.agora().toISOString()
    const m = String(motivo ?? '').trim()
    if (decisao !== 'aprovar') {
      if (m.length < 3) throw new ErroValidacao('Indique o motivo (a Administração Escolar vê-o).', { campo: 'motivo' })
      guardado[curso] = { ...x, proposta: undefined, recusa: { motivo: m, utilizadorId: x.proposta.utilizadorId, decididoPor: ctx.actor.nome ?? '', decididoEm: agora } }
      await this.paginas.guardar(CHAVE_DIRECTORES, guardado, ctx.actor.id)
      await this.auditoria.registar(ctx, { acao: 'recusar_director_curso', colecao: 'cursos', alvoId: curso, alvoTitulo: curso, detalhes: { motivo: m } })
      return { decisao: 'recusar' }
    }
    const p = x.proposta
    guardado[curso] = p.utilizadorId ? { utilizadorId: p.utilizadorId, desde: agora, designadoPor: p.pedidoPor, aprovadoPor: ctx.actor.nome ?? '' } : {}
    await this.paginas.guardar(CHAVE_DIRECTORES, guardado, ctx.actor.id)
    await this.auditoria.registar(ctx, { acao: p.utilizadorId ? 'aprovar_director_curso' : 'aprovar_retirar_director_curso', colecao: 'cursos', alvoId: curso, alvoTitulo: curso })
    return { decisao: 'aprovar' }
  }

  async contarParaAprovar(ctx) {
    if (!this.aprovacaoComandante) return 0
    if (!ctx.actor.pode('academico.homologar')) return ctx.actor.pode('academico.conselho') ? this.controlo.contarPublicacoesPendentes() : 0
    const directores = Object.values((await this.paginas?.ler(CHAVE_DIRECTORES)) ?? {}).filter((x) => x.proposta).length
    const reaberturas = ((await this.anosLetivos?.reaberturasPendentes()) ?? []).length + ((await this.anosLetivos?.fechosPendentes()) ?? []).length
    const certificados = (await this.certificadosCurso?.contarParaAprovar()) ?? 0
    return (await this.controlo.contarDistribuicoesPendentes()) + (await this.controlo.contarPublicacoesPendentes()) + directores + reaberturas + certificados
  }

  // ---------- decisões do Comandante ----------

  async decidirDistribuicao(ctx, anoLetivo, { decisao, motivo }) {
    ctx.actor.exigir('academico.homologar')
    const turmas = (await this.controlo.turmasComDistribuicaoPendente()).filter((t) => (t.distribuicao.anoLetivo ?? t.anoLetivo) === anoLetivo)
    if (!turmas.length) throw new Conflito('A distribuição deste ano lectivo não está à espera de aprovação.')
    const agora = this.relogio.agora()
    const m = String(motivo ?? '').trim()
    const decidido = { anoLetivo, pedidoPor: turmas[0].distribuicao.pedidoPor, pedidoEm: turmas[0].distribuicao.pedidoEm, decididoPor: ctx.actor.nome ?? '', decididoEm: agora.toISOString() }
    const alvo = `Ano lectivo ${anoLetivo}`
    if (decisao !== 'aprovar') {
      if (m.length < 3) throw new ErroValidacao('Escreva as recomendações (o Ensino vê-as para corrigir a lista).', { campo: 'motivo' })
      if (decisao === 'rejeitar') {
        let retirados = 0
        for (const t of turmas) {
          retirados += await this.controlo.removerPropostas(t.id)
          await this.controlo.guardarDistribuicao(t.id, { ...decidido, estado: 'rejeitada', motivo: m })
        }
        await this.auditoria.registar(ctx, { acao: 'rejeitar_distribuicao', colecao: 'turmas', alvoTitulo: alvo, detalhes: { motivo: m, retirados } })
        return { decisao: 'rejeitar', retirados }
      }
      for (const t of turmas) await this.controlo.guardarDistribuicao(t.id, { ...decidido, estado: 'devolvida', motivo: m })
      await this.auditoria.registar(ctx, { acao: 'devolver_distribuicao', colecao: 'turmas', alvoTitulo: alvo, detalhes: { motivo: m } })
      return { decisao: 'refazer' }
    }
    const ids = new Set()
    for (const t of turmas) {
      for (const id of await this.controlo.aprovarPropostas(t.id)) ids.add(id)
      // aprovada: fica o registo (com as recomendações, se as houver), que o Ensino vê na Alocação
      await this.controlo.guardarDistribuicao(t.id, { ...decidido, estado: 'aprovada', ...(m ? { recomendacoes: m } : {}) })
    }
    const porId = new Map(turmas.flatMap((t) => t.cadeiras.flatMap((c) => c.docentes)).map((d) => [d.docente.id, d.docente]))
    const novos = [...ids].map((id) => porId.get(id)).filter(Boolean)
    const { contasNovas: unicos, emails } = await this.libertarDocentes(ctx, novos)
    await this.notificacoes?.notificar([...ids], { tipo: 'aviso', titulo: 'Distribuição de serviço docente aprovada', texto: `Ano lectivo ${anoLetivo}: o Comandante aprovou as suas cadeiras.`, ligacao: '/cadeiras' })
    await this.auditoria.registar(ctx, { acao: 'aprovar_distribuicao', colecao: 'turmas', alvoTitulo: alvo, detalhes: { docentes: ids.size, contasEnviadas: emails, ...(m ? { recomendacoes: m } : {}) } })
    return { decisao: 'aprovar', docentes: ids.size, contasNovas: unicos.length, emails, semEmail: !this.correio?.real }
  }

  /*
    A primeira aprovação de um docente (pelo Comandante, na distribuição, ou quando é ele próprio a alocar): a conta
    fica verificada e a palavra-passe inicial vai por e-mail. Só a partir daqui o docente entra no portal.
  */
  async libertarDocentes(ctx, docentes, { fichas = false } = {}) {
    const porVerificar = [...new Map(docentes.filter((d) => d && !d.verificadoEm && d.ativo !== false).map((d) => [d.id, d])).values()]
    if (!porVerificar.length) return { contasNovas: [], emails: 0, fichas: [] }
    await this.controlo.verificarDocentes(porVerificar.map((d) => d.id), ctx.actor.nome ?? '', this.relogio.agora())
    let emails = 0
    const lista = []
    // a primeira aprovação: a conta vai por e-mail (como sempre) e, se se pedem, sai também a ficha de acesso
    for (const d of porVerificar) {
      const r = await this.darConta(ctx, d.id, { email: Boolean(this.correio), ficha: fichas, forcar: true })
      if (r?.enviado) emails++
      if (r?.ficha) lista.push(r.ficha)
    }
    return { contasNovas: porVerificar, emails, fichas: lista }
  }

  /*
    O acesso ao portal de quem ainda não o recebeu (nunca entrou nem se lhe deu a ficha): a conta fica activa, com a
    palavra-passe inicial (o portal pede outra na primeira entrada); vai por e-mail se se pedir e houver servidor.
  */
  async darConta(ctx, contaId, { email = false, ficha = false, forcar = false } = {}) {
    const c = await this.contas.porId(contaId)
    if (!c || (!forcar && (c.ultimoAcesso || c.dados?.acessoEntregueEm))) return null
    const inicial = senhaInicial()
    c.mudarSenha(await this.cifra.cifrar(inicial))
    c.deveMudarSenha = true
    c.ativo = true
    const endereco = this.urlPortal || 'o Portal Académico da ESG'
    const enviado = email && this.correio ? await this.correio.enviar({
      para: c.email,
      assunto: 'A sua conta do Portal Académico da ESG',
      texto: [
        `${c.nome},`, '',
        'Já pode entrar no Portal Académico da Escola Superior de Guerra.', '',
        `Endereço: ${endereco}`, `E-mail: ${c.email}`, `Número: ${c.numero}`, `Palavra-passe inicial: ${inicial}`, '',
        'Na primeira entrada o portal pede uma palavra-passe nova. Não partilhe esta mensagem.',
      ].join('\n'),
    }) : false
    // o acesso só conta como entregue se o e-mail saiu de facto ou se a ficha vai ser impressa
    if (ficha || (enviado && this.correio?.real)) c.dados = { ...(c.dados ?? {}), acessoEntregueEm: this.relogio.agora().toISOString() }
    await this.contas.guardar(c)
    await this.auditoria.registar(ctx, { acao: 'enviar_conta_docente', colecao: 'contas_portal', alvoId: c.id, alvoTitulo: `${c.nome} (${c.numero})` })
    return { ficha: ficha ? { ...c.publico(), senhaInicial: inicial } : null, enviado }
  }

  // as fichas de acesso dos docentes já aprovados nas cadeiras que ainda não receberam o acesso (sem e-mail na Escola)
  async fichasDosDocentes(ctx, { anoLetivo } = {}) {
    ctx.actor.exigir('academico.gerir')
    const ids = await this.controlo.docentesAprovados?.({ anoLetivo }) ?? []
    const fichas = []
    for (const id of ids) {
      const r = await this.darConta(ctx, id, { ficha: true })
      if (r?.ficha) fichas.push(r.ficha)
    }
    return { fichas, portal: this.urlPortal || '' }
  }

  async decidirNotas(ctx, id, { decisao, motivo }) {
    ctx.actor.exigir('academico.homologar', 'academico.conselho')
    const [, tipo, n] = /^(uc|av)-(\d+)$/.exec(String(id)) ?? []
    if (!tipo) throw new NaoEncontrado('Pedido não encontrado.')
    const m = String(motivo ?? '').trim()
    if (decisao !== 'aprovar' && m.length < 3) throw new ErroValidacao('Indique o motivo (o docente vê-o).', { campo: 'motivo' })
    const agora = this.relogio.agora().toISOString()
    if (tipo === 'uc') {
      const c = await this.academico.cadeira(Number(n))
      if (!c || c.publicacaoPedida?.estado !== 'pendente') throw new Conflito('Esta publicação não está à espera de aprovação.')
      const quais = c.publicacaoPedida.componentes.map((k) => NOMES_COMPONENTES[k]).join(', ')
      if (decisao === 'aprovar') {
        await this.pautas.publicar(ctx, c, [...c.notasPublicadas, ...c.publicacaoPedida.componentes], null)
      } else {
        await this.academico.pedirPublicacao(c.id, { ...c.publicacaoPedida, estado: 'recusada', motivo: m, decididoEm: agora })
        await this.auditoria.registar(ctx, { acao: 'recusar_publicacao_notas', colecao: 'pautas', alvoId: c.id, alvoTitulo: `${quais} — ${c.nome}`, detalhes: { motivo: m } })
      }
      await this.notificacoes?.notificar(c.docentes.map((d) => d.id), decisao === 'aprovar'
        ? { tipo: 'notas', titulo: `Publicação aprovada: ${quais}`, texto: `${c.nome}: os estudantes já vêem as notas.`, ligacao: `/cadeiras/${c.id}?separador=avaliacoes` }
        : { tipo: 'notas', titulo: `Publicação recusada: ${quais}`, texto: `${c.nome}: ${m}`, ligacao: `/cadeiras/${c.id}?separador=avaliacoes` })
      return { decisao }
    }
    const a = await this.planos.avaliacao(Number(n))
    if (!a || a.publicacaoPedida?.estado !== 'pendente') throw new Conflito('Esta publicação não está à espera de aprovação.')
    const c = await this.academico.cadeira(a.cadeiraId)
    if (decisao === 'aprovar') await this.esg.publicar(ctx, c, a.id, true, null)
    else {
      await this.planos.atualizarAvaliacao(a.id, { publicacaoPedida: { ...a.publicacaoPedida, estado: 'recusada', motivo: m, decididoEm: agora } })
      await this.auditoria.registar(ctx, { acao: 'recusar_publicacao_notas', colecao: 'pautas', alvoId: c.id, alvoTitulo: `${a.tipo} ${a.titulo} — ${c.nome}`, detalhes: { motivo: m } })
    }
    await this.notificacoes?.notificar(c.docentes.map((d) => d.id), decisao === 'aprovar'
      ? { tipo: 'notas', titulo: `Publicação aprovada: ${a.tipo} ${a.titulo}`, texto: `${c.nome}: os estudantes já vêem as notas.`, ligacao: `/cadeiras/${c.id}?separador=avaliacoes` }
      : { tipo: 'notas', titulo: `Publicação recusada: ${a.tipo} ${a.titulo}`, texto: `${c.nome}: ${m}`, ligacao: `/cadeiras/${c.id}?separador=avaliacoes` })
    return { decisao }
  }
}
