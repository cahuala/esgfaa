/*
  Avisos por e-mail ao Comandante (e a quem tiver a mesma permissão): quando alguma coisa fica à espera da
  decisão dele — uma publicação do site, um aviso geral ou um inquérito do portal, uma conta nova ou uma
  mudança de papel no painel, uma alteração de notas, um docente novo por verificar.
  Ouve o registo de atividades; sem SMTP_URL não envia nada. O e-mail não leva o endereço do painel.
*/
export const AVISOS = {
  pedir_aprovacao: { permissao: 'publicacoes.aprovar', assunto: (x) => `Publicação do site por aprovar: ${x.alvoTitulo}`, onde: 'Por aprovar' },
  pedir_aprovacao_aviso: { permissao: 'publicacoes.aprovar', assunto: (x) => `Aviso geral do portal por aprovar: ${x.alvoTitulo}`, onde: 'Por aprovar' },
  pedir_aprovacao_inquerito: { permissao: 'publicacoes.aprovar', assunto: (x) => `Inquérito institucional por aprovar: ${x.alvoTitulo}`, onde: 'Por aprovar' },
  pedir_aprovacao_conta: { permissao: 'utilizadores.aprovar', assunto: (x) => `Conta nova do painel por aprovar: ${x.alvoTitulo}`, onde: 'Por aprovar' },
  pedir_mudanca_papel: { permissao: 'utilizadores.aprovar', assunto: (x) => `Mudança de papel por aprovar: ${x.alvoTitulo}`, onde: 'Por aprovar' },
  pedir_alteracao_nota: { permissao: 'academico.homologar', assunto: (x) => `Pedido de alteração de notas: ${x.alvoTitulo}`, onde: 'Alterações de notas' },
  criar_conta_portal: { permissao: 'academico.homologar', so: (x) => x.detalhes?.tipo === 'docente', assunto: (x) => `Docente novo por verificar: ${x.alvoTitulo}`, onde: 'Docentes (verificação)' },
}

export class ServicoAvisosComandante {
  constructor({ utilizadores, papeis, correio, registar = () => {} }) {
    Object.assign(this, { utilizadores, papeis, correio, registar })
  }

  ligar(auditoria) {
    auditoria.ouvir((x) => this.avisar(x))
  }

  // contas ativas do painel com a permissão (o papel tem de a ter guardada; o Administrador não aprova)
  async destinatarios(permissao) {
    const papeis = (await this.papeis.listar()).filter((p) => p.permissoes.includes(permissao)).map((p) => p.id)
    return (await this.utilizadores.listar()).filter((u) => u.ativo && !u.aprovacao && papeis.includes(u.papel)).map((u) => u.email)
  }

  async avisar(x) {
    const a = AVISOS[x.acao]
    if (!a || (a.so && !a.so(x)) || !this.correio?.real) return 0
    const para = await this.destinatarios(a.permissao)
    for (const email of para) {
      await this.correio.enviar({
        para: email,
        assunto: `[ESG] ${a.assunto(x)}`,
        texto: `${a.assunto(x)}\n${x.quem ? `Pedido por: ${x.quem}\n` : ''}\nAbra o painel de gestão, em «${a.onde}», para decidir.\n\nEscola Superior de Guerra — aviso automático.`,
      }).catch((e) => this.registar({ nivel: 'erro', mensagem: 'Falha no aviso ao Comandante', erro: e.message }))
    }
    return para.length
  }
}
