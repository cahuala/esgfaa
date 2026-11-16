import { Conflito, ErroValidacao, NaoEncontrado } from '../../../dominio/comum/erros.js'
import { NOMES_COMPONENTES } from '../../../dominio/academico/avaliacao/resultado.js'
import { senhaInicial } from '../../../dominio/academico/pessoas/contas.js'

const PAPEIS = { regente: 'regente', assistente: 'assistente' }
const media = (m) => (m === null ? '—' : m.toFixed(1).replace('.', ','))

/*
  O que o Ensino faz e só vale com a aprovação do Comandante (em «Por aprovar», no painel):
  - a distribuição dos docentes pelas cadeiras de uma turma: o Ensino põe os docentes nas cadeiras (ficam
    propostos, sem acesso), revê e envia a lista; o Comandante aprova (os docentes passam a ter a cadeira e, na
    primeira aprovação, recebem a conta do portal por e-mail) ou devolve-a com o motivo;
  - a publicação das notas (provas parcelares, exames, TAI/TAG): o docente pede e os estudantes só as veem
    quando o Comandante aprova; se recusar, o docente vê o motivo.
*/
export class ServicoAprovacoesComandante {
  constructor(dependencias) {
    Object.assign(this, dependencias)
  }

  // ---------- distribuição dos docentes (Ensino) ----------

  async enviarDistribuicao(ctx, turmaId) {
    ctx.actor.exigir('academico.gerir')
    const t = await this.controlo.turmaComDocencias(turmaId)
    if (!t) throw new NaoEncontrado('Turma não encontrada.')
    if (t.distribuicao?.estado === 'pendente') throw new Conflito('A distribuição desta turma já está à espera do Comandante.')
    const propostos = t.cadeiras.flatMap((c) => c.docentes.filter((d) => d.estado === 'proposta'))
    if (!propostos.length) throw new ErroValidacao('Não há docentes propostos nesta turma: ponha primeiro os docentes nas cadeiras.')
    await this.controlo.guardarDistribuicao(t.id, { estado: 'pendente', pedidoPor: ctx.actor.nome ?? '', pedidoEm: this.relogio.agora().toISOString() })
    await this.auditoria.registar(ctx, { acao: 'pedir_aprovacao_distribuicao', colecao: 'turmas', alvoId: t.id, alvoTitulo: t.nome, detalhes: { propostos: propostos.length } })
    return { enviada: true, propostos: propostos.length }
  }

  // ---------- o que espera pelo Comandante (lista de «Por aprovar») ----------

  async paraAprovar(ctx) {
    if (!this.aprovacaoComandante || !ctx.actor.pode('academico.homologar')) return []
    const turmas = await this.controlo.turmasComDistribuicaoPendente()
    const distribuicoes = turmas.map((t) => ({
      colecao: 'distribuicao_docente', id: String(t.id), tipo: 'distribuicao',
      titulo: `${t.nome} (${t.anoLetivo})`, pedidoPor: t.distribuicao.pedidoPor, pedidoEm: t.distribuicao.pedidoEm,
      resumo: t.cadeiras.map((c) => {
        const ds = c.docentes.map((d) => `${d.docente.nome} (${PAPEIS[d.papel] ?? d.papel}, ${d.horas} h)${d.estado === 'proposta' ? ' — NOVO' : ''}`)
        return `${c.codigo} ${c.nome}: ${ds.length ? ds.join('; ') : 'sem docentes'}`
      }).join('\n'),
    }))
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
    return [...distribuicoes, ...notas]
  }

  async contarParaAprovar(ctx) {
    if (!this.aprovacaoComandante || !ctx.actor.pode('academico.homologar')) return 0
    return (await this.controlo.contarDistribuicoesPendentes()) + (await this.controlo.contarPublicacoesPendentes())
  }

  // ---------- decisões do Comandante ----------

  async decidirDistribuicao(ctx, turmaId, { decisao, motivo }) {
    ctx.actor.exigir('academico.homologar')
    const t = await this.controlo.turmaComDocencias(Number(turmaId))
    if (!t || t.distribuicao?.estado !== 'pendente') throw new Conflito('Esta distribuição não está à espera de aprovação.')
    const agora = this.relogio.agora()
    if (decisao !== 'aprovar') {
      const m = String(motivo ?? '').trim()
      if (m.length < 3) throw new ErroValidacao('Indique o motivo (o Ensino vê-o para corrigir a lista).', { campo: 'motivo' })
      await this.controlo.guardarDistribuicao(t.id, { ...t.distribuicao, estado: 'devolvida', motivo: m, decididoPor: ctx.actor.nome ?? '', decididoEm: agora.toISOString() })
      await this.auditoria.registar(ctx, { acao: 'devolver_distribuicao', colecao: 'turmas', alvoId: t.id, alvoTitulo: t.nome, detalhes: { motivo: m } })
      return { decisao: 'recusar' }
    }
    const ids = await this.controlo.aprovarPropostas(t.id)
    await this.controlo.guardarDistribuicao(t.id, null)
    // a primeira aprovação de um docente: a conta fica verificada e a palavra-passe inicial vai por e-mail
    const novos = t.cadeiras.flatMap((c) => c.docentes).filter((d) => ids.includes(d.docente.id) && !d.docente.verificadoEm && d.docente.ativo).map((d) => d.docente)
    const unicos = [...new Map(novos.map((d) => [d.id, d])).values()]
    await this.controlo.verificarDocentes(ids, ctx.actor.nome ?? '', agora)
    let emails = 0
    for (const d of unicos) if (await this.#enviarConta(ctx, d.id)) emails++
    await this.notificacoes?.notificar(ids, { tipo: 'aviso', titulo: 'Distribuição de serviço docente aprovada', texto: `${t.nome}: o Comandante aprovou as suas cadeiras.`, ligacao: '/cadeiras' })
    await this.auditoria.registar(ctx, { acao: 'aprovar_distribuicao', colecao: 'turmas', alvoId: t.id, alvoTitulo: t.nome, detalhes: { docentes: ids.length, contasEnviadas: emails } })
    return { decisao: 'aprovar', docentes: ids.length, contasNovas: unicos.length, emails, semEmail: !this.correio?.real }
  }

  // palavra-passe inicial nova e o e-mail com a conta (sem servidor de e-mail, a Repartição entrega a ficha de acesso)
  async #enviarConta(ctx, contaId) {
    const c = await this.contas.porId(contaId)
    if (!c || !this.correio) return false
    const inicial = senhaInicial()
    c.mudarSenha(await this.cifra.cifrar(inicial))
    c.deveMudarSenha = true
    await this.contas.guardar(c)
    await this.auditoria.registar(ctx, { acao: 'enviar_conta_docente', colecao: 'contas_portal', alvoId: c.id, alvoTitulo: `${c.nome} (${c.numero})` })
    const endereco = this.urlPortal || 'o Portal Académico da ESG'
    return this.correio.enviar({
      para: c.email,
      assunto: 'A sua conta do Portal Académico da ESG',
      texto: [
        `${c.nome},`, '',
        'O Comandante da Escola Superior de Guerra aprovou a distribuição de serviço docente: já pode entrar no Portal Académico.', '',
        `Endereço: ${endereco}`, `E-mail: ${c.email}`, `Número: ${c.numero}`, `Palavra-passe inicial: ${inicial}`, '',
        'Na primeira entrada o portal pede uma palavra-passe nova. Não partilhe esta mensagem.',
      ].join('\n'),
    })
  }

  async decidirNotas(ctx, id, { decisao, motivo }) {
    ctx.actor.exigir('academico.homologar')
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
        ? { tipo: 'notas', titulo: `Publicação aprovada: ${quais}`, texto: `${c.nome}: os estudantes já veem as notas.`, ligacao: `/cadeiras/${c.id}?separador=avaliacoes` }
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
      ? { tipo: 'notas', titulo: `Publicação aprovada: ${a.tipo} ${a.titulo}`, texto: `${c.nome}: os estudantes já veem as notas.`, ligacao: `/cadeiras/${c.id}?separador=avaliacoes` }
      : { tipo: 'notas', titulo: `Publicação recusada: ${a.tipo} ${a.titulo}`, texto: `${c.nome}: ${m}`, ligacao: `/cadeiras/${c.id}?separador=avaliacoes` })
    return { decisao }
  }
}
