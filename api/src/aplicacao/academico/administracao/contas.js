import { NaoEncontrado } from '../../../dominio/comum/erros.js'
import { limparTexto } from '../../../dominio/comum/texto.js'
import { escolha, texto } from '../../../dominio/academico/comum/validacao.js'
import { emailDaEscola, numeroConta, TIPOS_CONTA } from '../../../dominio/academico/pessoas/contas.js'

// Contas do portal (estudantes e docentes), geridas pela Administração Escolar.
export class ServicoContas {
  constructor(dependencias) {
    Object.assign(this, dependencias)
  }

  listarContas(ctx, filtros) {
    ctx.actor.exigir('academico.ver')
    return this.contas.listar(filtros).then((l) => l.map((c) => ({ ...c.publico(), deveMudarSenha: c.deveMudarSenha })))
  }

  async #dadosConta(dados = {}) {
    const d = typeof dados === 'object' && dados && !Array.isArray(dados) ? dados : {}
    return Object.fromEntries(['posto', 'ramo', 'telefone', 'nip', 'departamento']
      .filter((k) => d[k] !== undefined && d[k] !== '')
      .map((k) => [k, limparTexto(d[k]).slice(0, 120)]))
  }

  async criarConta(ctx, { tipo, nome, email, dados }) {
    ctx.actor.exigir('academico.gerir')
    const t = escolha(tipo, 'tipo', 'Tipo de conta', TIPOS_CONTA)
    const e = emailDaEscola(email, this.dominioEmail)
    const n = texto(nome, 'nome', 'Nome completo', { min: 5, max: 150 })
    const ano = this.relogio.agora().getFullYear()
    // a palavra-passe inicial é o e-mail; o portal obriga a mudá-la na primeira entrada
    const senha = await this.cifra.cifrar(e)
    let conta
    for (let tentativa = 0; !conta; tentativa++) {
      try {
        const numero = numeroConta(t, ano, await this.contas.proximaSequencia(t, ano))
        conta = await this.contas.criar({ tipo: t, numero, nome: n, email: e, senha, dados: await this.#dadosConta(dados) })
      } catch (erro) {
        if (!/Número/.test(erro.message) || tentativa >= 3) throw erro
      }
    }
    await this.auditoria.registar(ctx, { acao: 'criar_conta_portal', colecao: 'contas_portal', alvoId: conta.id, alvoTitulo: `${conta.nome} (${conta.numero})`, detalhes: { tipo: t } })
    return { ...conta.publico(), deveMudarSenha: true }
  }

  async editarConta(ctx, id, { nome, email, ativo, dados }) {
    ctx.actor.exigir('academico.gerir')
    const c = await this.contas.porId(id)
    if (!c) throw new NaoEncontrado('Conta não encontrada.')
    if (nome !== undefined) c.nome = texto(nome, 'nome', 'Nome completo', { min: 5, max: 150 })
    if (email !== undefined) c.email = emailDaEscola(email, this.dominioEmail)
    if (dados !== undefined) c.dados = await this.#dadosConta(dados)
    if (ativo !== undefined && Boolean(ativo) !== c.ativo) {
      c.ativo = Boolean(ativo)
      if (!c.ativo) c.invalidarSessoes()
    }
    const g = await this.contas.guardar(c)
    await this.auditoria.registar(ctx, { acao: 'editar_conta_portal', colecao: 'contas_portal', alvoId: c.id, alvoTitulo: `${c.nome} (${c.numero})` })
    return { ...g.publico(), deveMudarSenha: g.deveMudarSenha }
  }

  // repõe a palavra-passe inicial (o e-mail) e termina as sessões abertas
  async reporSenha(ctx, id) {
    ctx.actor.exigir('academico.gerir')
    const c = await this.contas.porId(id)
    if (!c) throw new NaoEncontrado('Conta não encontrada.')
    c.mudarSenha(await this.cifra.cifrar(c.email))
    c.deveMudarSenha = true
    c.tentativasFalhadas = 0
    c.bloqueadoAte = null
    await this.contas.guardar(c)
    await this.auditoria.registar(ctx, { acao: 'repor_senha_portal', colecao: 'contas_portal', alvoId: c.id, alvoTitulo: `${c.nome} (${c.numero})` })
  }
}
