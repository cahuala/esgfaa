import { ErroValidacao, NaoEncontrado } from '../../dominio/comum/erros.js'
import { texto } from '../../dominio/academico/regras.js'

const escapar = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const LEMBRETE_HORAS = 24

/*
  Comunicação do portal: notificações (o sino do cabeçalho, e por e-mail se a conta quiser),
  lembretes de prazo e mensagens privadas entre quem partilha uma cadeira.
  Os e-mails saem em segundo plano: uma falha de envio nunca estraga a ação que os originou.
*/
export class ServicoComunicacao {
  constructor({ comunicacao, academico, acesso, correio, relogio, urlPortal = '', registar = () => {} }) {
    Object.assign(this, { comunicacao, academico, acesso, correio, relogio, urlPortal, registar })
    this.emCurso = new Set()
  }

  // ======================= notificações =======================

  /*
    Notifica as contas indicadas (sem repetidos, sem quem fez a ação).
    dados: { tipo, titulo, texto, ligacao }
  */
  async notificar(contaIds, dados, { excepto } = {}) {
    const ids = [...new Set(contaIds.map(Number))].filter((id) => id && id !== excepto)
    if (!ids.length) return
    const limpo = { tipo: dados.tipo, titulo: String(dados.titulo).slice(0, 200), texto: String(dados.texto || '').slice(0, 500), ligacao: dados.ligacao || '' }
    await this.comunicacao.notificar(ids, limpo)
    const envio = this.#enviarEmails(ids, limpo).catch((e) => this.registar({ nivel: 'erro', mensagem: 'Falha nas notificações por e-mail', erro: e.message }))
    this.emCurso.add(envio)
    envio.finally(() => this.emCurso.delete(envio))
  }

  // espera pelos e-mails em curso (testes e encerramento do servidor)
  async esvaziar() {
    await Promise.allSettled([...this.emCurso])
  }

  async #enviarEmails(ids, n) {
    const contas = await this.comunicacao.destinatariosEmail(ids)
    const ligacao = this.urlPortal && n.ligacao ? `${this.urlPortal}/#${n.ligacao}` : this.urlPortal
    for (const c of contas) {
      await this.correio.enviar({
        para: c.email,
        assunto: `[ESG] ${n.titulo}`,
        texto: `${c.nome},\n\n${n.titulo}\n${n.texto ? `\n${n.texto}\n` : ''}${ligacao ? `\nAbrir no portal: ${ligacao}\n` : ''}\n— Portal Académico da Escola Superior de Guerra\nPode deixar de receber estes e-mails no seu perfil do portal.`,
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;color:#2d353c">
  <div style="background:#14100e;color:#fff;padding:14px 18px;border-bottom:3px solid #e53917"><b>Portal Académico</b> · Escola Superior de Guerra</div>
  <div style="padding:18px;border:1px solid #e4e7ea;border-top:0">
    <p style="margin:0 0 10px">${escapar(c.nome)},</p>
    <h2 style="font-size:17px;margin:0 0 8px">${escapar(n.titulo)}</h2>
    ${n.texto ? `<p style="margin:0 0 14px;color:#555">${escapar(n.texto)}</p>` : ''}
    ${ligacao ? `<p><a href="${escapar(ligacao)}" style="background:#e53917;color:#fff;padding:9px 16px;text-decoration:none;border-radius:4px;display:inline-block">Abrir no portal</a></p>` : ''}
    <p style="font-size:12px;color:#999;margin-top:18px">Pode deixar de receber estes e-mails no seu perfil do portal.</p>
  </div>
</div>`,
      })
    }
  }

  // estudantes com matrícula ativa na turma da cadeira
  async estudantesDaCadeira(cadeira) {
    return (await this.academico.estudantesAtivosDaTurma(cadeira.turmaId)).map((e) => e.id)
  }

  listar(ctx, { antesDe } = {}) {
    return this.comunicacao.notificacoes(ctx.conta.id, { antesDe: antesDe ? Number(antesDe) : undefined })
  }

  async marcarLidas(ctx, { ids, todas }) {
    await this.comunicacao.marcarLidas(ctx.conta.id, todas ? undefined : (ids || []).map(Number))
    return this.comunicacao.notificacoes(ctx.conta.id)
  }

  // números para o cabeçalho (sino e envelope)
  async resumo(ctx) {
    const [{ naoLidas }, mensagens] = await Promise.all([this.comunicacao.notificacoes(ctx.conta.id, { limite: 1 }), this.comunicacao.mensagensPorLer(ctx.conta.id)])
    return { notificacoes: naoLidas, mensagens }
  }

  async preferencias(ctx) {
    return { notificarEmail: await this.comunicacao.notificarEmail(ctx.conta.id), emailAtivo: this.correio.real }
  }

  async definirPreferencias(ctx, { notificarEmail }) {
    await this.comunicacao.definirNotificarEmail(ctx.conta.id, Boolean(notificarEmail))
    return this.preferencias(ctx)
  }

  /*
    Lembretes: trabalhos que terminam nas próximas 24 horas, para quem ainda não entregou.
    Corre de 15 em 15 minutos no servidor; cada trabalho só é lembrado uma vez.
  */
  async lembrarPrazos() {
    const agora = this.relogio.agora()
    const ate = new Date(agora.getTime() + LEMBRETE_HORAS * 3_600_000)
    let enviados = 0
    for (const t of await this.comunicacao.trabalhosALembrar(agora, ate)) {
      if (!(await this.comunicacao.marcarLembrado(t.id, agora))) continue
      // quem já entregou ou tem o prazo alargado não é lembrado agora
      const entregues = new Set([...t.entregas.flatMap((e) => [e.estudanteId, ...(e.grupo?.membros.map((m) => m.estudanteId) || [])]), ...t.prorrogacoes.map((p) => p.estudanteId)])
      const faltam = (await this.academico.estudantesAtivosDaTurma(t.cadeira.turmaId)).map((e) => e.id).filter((id) => !entregues.has(id))
      const horas = Math.max(1, Math.round((new Date(t.prazo) - agora) / 3_600_000))
      await this.notificar(faltam, {
        tipo: 'prazo', titulo: `Faltam ${horas} h para entregar: ${t.titulo}`, texto: `${t.cadeira.nome}. Ainda não entregou este trabalho.`,
        ligacao: `/cadeiras/${t.cadeira.id}?atividade=trabalho-${t.id}`,
      })
      enviados += faltam.length
    }
    return enviados
  }

  // ======================= mensagens =======================

  // quem esta conta pode contactar: docentes e colegas das suas cadeiras (como os participantes no Moodle)
  async contactos(ctx) {
    const cadeiras = await this.acesso.minhasCadeiras(ctx.conta)
    const pessoas = new Map()
    for (const c of cadeiras) {
      for (const d of c.docentes) pessoas.set(d.id, { id: d.id, nome: d.nome, tipo: 'docente', papel: d.papel === 'regente' ? 'Regente' : 'Assistente', cadeiras: [] })
      for (const e of await this.academico.estudantesAtivosDaTurma(c.turmaId)) if (!pessoas.has(e.id)) pessoas.set(e.id, { id: e.id, nome: e.nome, tipo: 'estudante', papel: 'Estudante', numero: e.numero, cadeiras: [] })
      for (const id of [...c.docentes.map((d) => d.id)]) pessoas.get(id).cadeiras.push(c.codigo)
    }
    pessoas.delete(ctx.conta.id)
    return [...pessoas.values()].sort((a, b) => (a.tipo === b.tipo ? a.nome.localeCompare(b.nome) : a.tipo === 'docente' ? -1 : 1))
  }

  async #contactavel(ctx, outroId) {
    const id = Number(outroId)
    const c = (await this.contactos(ctx)).find((p) => p.id === id)
    if (!c) throw new NaoEncontrado('Esta pessoa não está nas suas cadeiras.')
    return c
  }

  conversas(ctx) {
    return this.comunicacao.conversas(ctx.conta.id)
  }

  // abre a conversa e marca como lidas as mensagens recebidas
  async conversa(ctx, outroId) {
    const pessoa = await this.#contactavel(ctx, outroId)
    await this.comunicacao.marcarConversaLida(ctx.conta.id, pessoa.id, this.relogio.agora())
    return { pessoa, mensagens: await this.comunicacao.conversa(ctx.conta.id, pessoa.id) }
  }

  async enviar(ctx, outroId, { texto: corpo }) {
    const pessoa = await this.#contactavel(ctx, outroId)
    const t = texto(corpo, 'texto', 'Mensagem', { min: 1, max: 5000 })
    if (!t.trim()) throw new ErroValidacao('Escreva a mensagem.', { campo: 'texto' })
    const m = await this.comunicacao.enviarMensagem({ deId: ctx.conta.id, paraId: pessoa.id, texto: t })
    await this.notificar([pessoa.id], {
      tipo: 'mensagem', titulo: `Nova mensagem de ${ctx.conta.nome}`, texto: t.length > 160 ? `${t.slice(0, 157)}…` : t, ligacao: `/mensagens/${ctx.conta.id}`,
    })
    return { ...m, minha: true }
  }
}
