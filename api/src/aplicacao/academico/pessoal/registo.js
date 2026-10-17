import { ErroValidacao, NaoEncontrado } from '../../../dominio/comum/erros.js'
import { limparTexto } from '../../../dominio/comum/texto.js'
import { escolha, texto } from '../../../dominio/academico/comum/validacao.js'
import { emailDaEscola, numeroConta, TIPOS_CONTA } from '../../../dominio/academico/pessoas/contas.js'

/*
  Registo de pessoas (Repartição de Pessoal e Quadros): estudantes e docentes, com os dados pessoais
  e a conta do portal. A Administração Escolar consulta este registo para matricular, inscrever
  e alocar, mas não regista ninguém.
*/
export class ServicoRegistoPessoal {
  constructor(dependencias) {
    Object.assign(this, dependencias)
  }

  // quem pode ver o registo: o Pessoal e Quadros e a Administração Escolar (para escolher)
  listarContas(ctx, filtros) {
    ctx.actor.exigir('pessoal.ver', 'academico.ver')
    return this.contas.listar(filtros).then((l) => l.map((c) => ({ ...c.publico(), deveMudarSenha: c.deveMudarSenha })))
  }

  async #dadosConta(dados = {}) {
    const d = typeof dados === 'object' && dados && !Array.isArray(dados) ? dados : {}
    return Object.fromEntries(['posto', 'ramo', 'telefone', 'nip', 'departamento']
      .filter((k) => d[k] !== undefined && d[k] !== '')
      .map((k) => [k, limparTexto(d[k]).slice(0, 120)]))
  }

  async criarConta(ctx, { tipo, nome, email, dados }) {
    ctx.actor.exigir('pessoal.registar')
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
    ctx.actor.exigir('pessoal.registar')
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
    ctx.actor.exigir('pessoal.registar')
    const c = await this.contas.porId(id)
    if (!c) throw new NaoEncontrado('Conta não encontrada.')
    c.mudarSenha(await this.cifra.cifrar(c.email))
    c.deveMudarSenha = true
    c.tentativasFalhadas = 0
    c.bloqueadoAte = null
    await this.contas.guardar(c)
    await this.auditoria.registar(ctx, { acao: 'repor_senha_portal', colecao: 'contas_portal', alvoId: c.id, alvoTitulo: `${c.nome} (${c.numero})` })
  }

  /*
    Contas enviadas pelo Sistema de Gestão de Pessoal (rede interna), já com a assinatura verificada.
    Cria quem ainda não tem conta, atualiza o nome e os dados de quem tem, e desativa quem deixou de ser
    docente/estudante ou saiu da Escola. O e-mail é a chave: a conta do portal não sabe mais nada da ficha.
  */
  async sincronizarDoPessoal(ctx, pessoas) {
    const resultados = []
    let criadas = 0
    let atualizadas = 0
    for (const p of pessoas) {
      try {
        const email = emailDaEscola(p.email, this.dominioEmail)
        const t = escolha(p.tipo, 'tipo', 'Tipo de conta', TIPOS_CONTA)
        const existente = await this.contas.porEmail(email)
        if (!existente) {
          if (!p.ativo) {
            resultados.push({ ref: p.ref, ok: true, contaId: null })
            continue
          }
          const nome = texto(p.nome, 'nome', 'Nome completo', { min: 5, max: 150 })
          let conta
          for (let tentativa = 0; !conta; tentativa++) {
            try {
              const ano = this.relogio.agora().getFullYear()
              conta = await this.contas.criar({ tipo: t, numero: numeroConta(t, ano, await this.contas.proximaSequencia(t, ano)), nome, email, senha: await this.cifra.cifrar(email), dados: await this.#dadosConta(p.dados) })
            } catch (erro) {
              if (!/Número/.test(erro.message) || tentativa >= 3) throw erro
            }
          }
          criadas++
          resultados.push({ ref: p.ref, ok: true, contaId: conta.id })
          continue
        }
        if (existente.tipo !== t) throw new ErroValidacao(`Já existe uma conta de ${existente.tipo} com este e-mail.`)
        if (p.nome) existente.nome = texto(p.nome, 'nome', 'Nome completo', { min: 5, max: 150 })
        existente.dados = { ...existente.dados, ...(await this.#dadosConta(p.dados)) }
        if (Boolean(p.ativo) !== existente.ativo) {
          existente.ativo = Boolean(p.ativo)
          if (!existente.ativo) existente.invalidarSessoes()
        }
        await this.contas.guardar(existente)
        atualizadas++
        resultados.push({ ref: p.ref, ok: true, contaId: existente.id })
      } catch (e) {
        if (!(e instanceof ErroValidacao)) throw e
        resultados.push({ ref: p.ref, ok: false, erro: e.message })
      }
    }
    if (criadas || atualizadas) await this.auditoria.registar(ctx, { acao: 'sincronizar_pessoal', colecao: 'contas_portal', alvoTitulo: 'Sistema de Gestão de Pessoal', detalhes: { criadas, atualizadas }, utilizador: null })
    return { resultados }
  }

  /*
    Registo de várias pessoas de uma folha (CSV/Excel lido no navegador), todas do mesmo tipo.
    Com simular, só diz o que faria a cada linha. Quem já está registado não se repete.
  */
  async importar(ctx, { tipo = 'estudante', linhas, simular = true }) {
    ctx.actor.exigir('pessoal.registar')
    const t = escolha(tipo, 'tipo', 'Tipo de conta', TIPOS_CONTA)
    if (!Array.isArray(linhas) || !linhas.length) throw new ErroValidacao('A folha não tem pessoas.', { campo: 'linhas' })
    if (linhas.length > 500) throw new ErroValidacao('No máximo 500 pessoas de cada vez.', { campo: 'linhas' })
    const vistos = new Set()
    const resultado = []
    for (const [i, l] of linhas.entries()) {
      const linha = { linha: i + 1, nome: String(l.nome ?? '').trim(), email: String(l.email ?? '').trim().toLowerCase() }
      try {
        const email = emailDaEscola(l.email, this.dominioEmail)
        const nome = texto(l.nome, 'nome', 'Nome completo', { min: 5, max: 150 })
        if (vistos.has(email)) throw new ErroValidacao('E-mail repetido na folha.')
        vistos.add(email)
        const existente = await this.contas.porEmail(email)
        let acao = existente ? 'ja_registado' : 'registar'
        let numero = existente?.numero ?? null
        if (existente && existente.tipo !== t) throw new ErroValidacao(`Já está registado como ${existente.tipo}.`)
        if (!simular && !existente) {
          numero = (await this.criarConta(ctx, { tipo: t, nome, email, dados: { posto: l.posto, ramo: l.ramo, nip: l.nip, telefone: l.telefone } })).numero
          acao = 'registado'
        }
        resultado.push({ ...linha, nome, email, acao, numero })
      } catch (e) {
        if (!(e instanceof ErroValidacao)) throw e
        resultado.push({ ...linha, acao: 'erro', erro: e.message })
      }
    }
    const conta = (k) => resultado.filter((r) => r.acao === k).length
    const resumo = { registar: conta('registar') + conta('registado'), ja_registado: conta('ja_registado'), erro: conta('erro') }
    if (!simular) await this.auditoria.registar(ctx, { acao: 'importar_pessoas', colecao: 'contas_portal', alvoTitulo: `${resumo.registar} ${t}(s)`, detalhes: resumo })
    return { simulacao: simular, tipo: t, resumo, linhas: resultado }
  }
}
