import { ErroValidacao, NaoEncontrado } from '../dominio/comum/erros.js'
import { texto } from '../dominio/academico/comum/validacao.js'

export const TIPOS_PEDIDO = { acesso: 'Acesso aos meus dados', rectificacao: 'Rectificação (corrigir dados)', oposicao: 'Oposição a um tratamento', eliminacao: 'Eliminação de dados', outro: 'Outro assunto sobre dados pessoais' }
const MES = 30 * 86_400_000
// campos que nunca saem na exportação (segredos e técnicos)
const SEGREDOS = ['senha', 'tokenCalendario', 'versaoToken', 'tentativasFalhadas', 'bloqueadoAte']
const limpar = (o) => Object.fromEntries(Object.entries(o ?? {}).filter(([k]) => !SEGREDOS.includes(k)))

/*
  Protecção de dados pessoais (Lei n.º 22/11, de 17 de Junho):
  — aviso de privacidade: cada conta (portal e painel) toma conhecimento uma vez;
  — direitos dos titulares: cada um descarrega os seus dados e faz pedidos (rectificação, oposição…),
    respondidos no painel;
  — conservação: os registos técnicos com dados pessoais apagam-se (ou anonimizam-se) passados os prazos.
*/
export class ServicoPrivacidade {
  constructor({ prisma, notificacoes, auditoria, relogio, conservacao }) {
    Object.assign(this, { prisma, notificacoes, auditoria, relogio, conservacao })
  }

  // ---------- aviso ----------
  async avisoConta(conta) {
    const c = await this.prisma.contaPortal.findUnique({ where: { id: conta.id }, select: { privacidadeEm: true } })
    return { conhecimentoEm: c?.privacidadeEm ?? null }
  }

  async aceitarConta(conta) {
    await this.prisma.contaPortal.update({ where: { id: conta.id }, data: { privacidadeEm: this.relogio.agora() } })
    return this.avisoConta(conta)
  }

  async avisoUtilizador(ctx) {
    const u = await this.prisma.utilizador.findUnique({ where: { id: ctx.actor.id }, select: { privacidadeEm: true } })
    return { conhecimentoEm: u?.privacidadeEm ?? null }
  }

  async aceitarUtilizador(ctx) {
    await this.prisma.utilizador.update({ where: { id: ctx.actor.id }, data: { privacidadeEm: this.relogio.agora() } })
    return this.avisoUtilizador(ctx)
  }

  // ---------- direito de acesso: tudo o que o portal guarda sobre a conta ----------
  async meusDados(ctx) {
    const id = ctx.conta.id
    const p = this.prisma
    const [conta, matriculas, inscricoes, notas, entregas, tentativas, presencas, pedidos, emprestimos, notificacoes, enviadas, recebidas, acessos, pedidosDados] = await Promise.all([
      p.contaPortal.findUnique({ where: { id } }),
      p.matricula.findMany({ where: { estudanteId: id }, include: { turma: { select: { nome: true, curso: true, anoLetivo: true } } } }),
      p.inscricaoCadeira.findMany({ where: { estudanteId: id }, include: { cadeira: { select: { codigo: true, nome: true } } } }),
      p.notaPauta.findMany({ where: { estudanteId: id }, include: { cadeira: { select: { codigo: true, nome: true } } } }),
      p.entrega.findMany({ where: { estudanteId: id }, include: { trabalho: { select: { titulo: true } } } }),
      p.tentativa.findMany({ where: { estudanteId: id }, select: { questionarioId: true, iniciadaEm: true, entregueEm: true, nota: true } }).catch(() => []),
      p.presenca.count({ where: { estudanteId: id } }),
      p.pedido.findMany({ where: { estudanteId: id } }),
      p.emprestimo.findMany({ where: { contaId: id } }),
      p.notificacao.findMany({ where: { contaId: id }, orderBy: { id: 'desc' }, take: 500 }),
      p.mensagem.findMany({ where: { deId: id }, orderBy: { id: 'desc' }, take: 1000 }),
      p.mensagem.findMany({ where: { paraId: id }, orderBy: { id: 'desc' }, take: 1000 }),
      p.registoAcesso.count({ where: { contaId: id } }),
      p.pedidoDados.findMany({ where: { contaId: id } }),
    ])
    if (!conta) throw new NaoEncontrado('Conta não encontrada.')
    await this.auditoria.registar(ctx, { acao: 'exportar_meus_dados', colecao: 'contas_portal', alvoId: id, alvoTitulo: conta.nome, utilizador: null })
    return {
      geradoEm: this.relogio.agora().toISOString(),
      aviso: 'Dados pessoais guardados pelo Portal Académico da Escola Superior de Guerra sobre esta conta (Lei n.º 22/11, direito de acesso).',
      conta: limpar(conta),
      matriculas, inscricoes, notas, entregas, tentativas, presencas: { total: presencas },
      pedidosDeDocumentos: pedidos, emprestimosBiblioteca: emprestimos, notificacoes,
      mensagens: { enviadas, recebidas }, acessosAsCadeiras: { total: acessos }, pedidosSobreDados: pedidosDados,
    }
  }

  // ---------- pedidos dos titulares ----------
  async pedir(ctx, { tipo, texto: t }) {
    if (!TIPOS_PEDIDO[tipo]) throw new ErroValidacao('Tipo de pedido desconhecido.', { campo: 'tipo' })
    const p = await this.prisma.pedidoDados.create({ data: { contaId: ctx.conta.id, tipo, texto: texto(t, 'texto', 'Descrição', { min: 5, max: 3000 }) } })
    await this.auditoria.registar(ctx, { acao: 'pedido_dados', colecao: 'pedidos_dados', alvoId: p.id, alvoTitulo: TIPOS_PEDIDO[tipo], utilizador: null })
    return p
  }

  meusPedidos(ctx) {
    return this.prisma.pedidoDados.findMany({ where: { contaId: ctx.conta.id }, orderBy: { criadoEm: 'desc' } })
  }

  async listarPedidos(ctx) {
    ctx.actor.exigir('atividades.ver')
    const l = await this.prisma.pedidoDados.findMany({ include: { conta: { select: { nome: true, email: true, numero: true, tipo: true } } }, orderBy: [{ estado: 'asc' }, { criadoEm: 'desc' }] })
    return l.map((x) => ({ ...x, tipoNome: TIPOS_PEDIDO[x.tipo] ?? x.tipo }))
  }

  async responder(ctx, idTexto, { estado, resposta }) {
    ctx.actor.exigir('atividades.ver')
    const id = Number(idTexto)
    if (!['respondido', 'recusado'].includes(estado)) throw new ErroValidacao('Estado inválido.', { campo: 'estado' })
    const p = await this.prisma.pedidoDados.findUnique({ where: { id } })
    if (!p) throw new NaoEncontrado('Pedido não encontrado.')
    const r = await this.prisma.pedidoDados.update({ where: { id }, data: { estado, resposta: texto(resposta, 'resposta', 'Resposta', { min: 3, max: 3000 }), respondidoPor: ctx.actor.nome ?? '', respondidoEm: this.relogio.agora() } })
    await this.auditoria.registar(ctx, { acao: 'responder_pedido_dados', colecao: 'pedidos_dados', alvoId: id, alvoTitulo: TIPOS_PEDIDO[p.tipo] })
    await this.notificacoes?.notificar([p.contaId], { tipo: 'aviso', titulo: 'Resposta ao seu pedido sobre dados pessoais', texto: TIPOS_PEDIDO[p.tipo], ligacao: '/perfil' }).catch(() => {})
    return r
  }

  // ---------- conservação ----------
  /*
    Apaga ou anonimiza o que já não é preciso (prazos em meses, configuráveis):
    mensagens do formulário de contacto, registo de atividades do painel, eventos de segurança, registos
    de acesso às cadeiras e o IP dos comentários. Os registos académicos (notas, certificados, percursos)
    ficam: fazem parte do arquivo da Escola.
  */
  async aplicarConservacao() {
    const agora = this.relogio.agora().getTime()
    const antes = (meses) => new Date(agora - meses * MES)
    const c = this.conservacao
    const p = this.prisma
    const r = {
      mensagensContacto: (await p.mensagemContacto.deleteMany({ where: { criadoEm: { lt: antes(c.contactos) } } })).count,
      atividades: (await p.atividade.deleteMany({ where: { data: { lt: antes(c.atividades) } } })).count,
      eventosSeguranca: (await p.eventoSeguranca.deleteMany({ where: { minuto: { lt: antes(c.seguranca) } } })).count,
      registosAcesso: (await p.registoAcesso.deleteMany({ where: { em: { lt: antes(c.acessos) } } })).count,
      ipComentarios: (await p.comentario.updateMany({ where: { data: { lt: antes(c.ipComentarios) }, ip: { not: null } }, data: { ip: null } })).count,
    }
    return r
  }
}
