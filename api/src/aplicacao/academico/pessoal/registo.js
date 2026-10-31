import { Conflito, ErroValidacao, NaoEncontrado } from '../../../dominio/comum/erros.js'
import { limparTexto } from '../../../dominio/comum/texto.js'
import { escolha, texto } from '../../../dominio/academico/comum/validacao.js'
import { emailDaEscola, numeroConta, senhaInicial, TIPOS_CONTA } from '../../../dominio/academico/pessoas/contas.js'

/*
  Registo de pessoas (Repartição de Pessoal e Quadros): estudantes e docentes, com os dados pessoais
  e a conta do portal. A Administração Escolar consulta este registo para matricular, inscrever
  e alocar, mas não regista ninguém.
  A palavra-passe inicial é aleatória e só se mostra uma vez (na ficha de acesso que a Repartição entrega).
  Com o Sistema de Gestão de Pessoal ligado (noPessoal), é lá que se registam e mudam os estudantes e os
  docentes; aqui ficam só a consulta e a ficha de acesso (repor a palavra-passe).
*/
const SO_NO_PESSOAL = 'Os estudantes e os docentes registam-se e mudam-se no Sistema de Gestão de Pessoal; o portal recebe-os de lá. Aqui pode imprimir a ficha de acesso.'

export class ServicoRegistoPessoal {
  constructor(dependencias) {
    Object.assign(this, { gerarSenha: senhaInicial, noPessoal: false }, dependencias)
  }

  #soNoPessoal() {
    if (this.noPessoal) throw new Conflito(SO_NO_PESSOAL)
  }

  // o painel sabe se o registo é aqui ou no Pessoal (para mostrar ou esconder «Novo registo» e «Importar»)
  origem(ctx) {
    ctx.actor.exigir('pessoal.ver', 'academico.ver')
    return { noPessoal: this.noPessoal }
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
    this.#soNoPessoal()
    const t = escolha(tipo, 'tipo', 'Tipo de conta', TIPOS_CONTA)
    const e = emailDaEscola(email, this.dominioEmail)
    const n = texto(nome, 'nome', 'Nome completo', { min: 5, max: 150 })
    const ano = this.relogio.agora().getFullYear()
    // a palavra-passe inicial vai na resposta (para a ficha de acesso); o portal obriga a mudá-la na primeira entrada
    const inicial = this.gerarSenha(e)
    const senha = await this.cifra.cifrar(inicial)
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
    return { ...conta.publico(), deveMudarSenha: true, senhaInicial: inicial }
  }

  async editarConta(ctx, id, { nome, email, ativo, dados }) {
    ctx.actor.exigir('pessoal.registar')
    this.#soNoPessoal()
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

  // dá uma palavra-passe inicial nova (para a ficha de acesso) e termina as sessões abertas
  async reporSenha(ctx, id) {
    ctx.actor.exigir('pessoal.registar')
    return this.#reporSenha(ctx, id)
  }

  // pedido assinado do Sistema de Gestão de Pessoal: a Repartição imprime lá a ficha de acesso
  // o Pessoal mostra, na tabela dos estudantes e docentes, o estado de cada conta no portal
  estadoContasDoPessoal(ctx, ids) {
    return this.contas.estados(ids)
  }

  reporSenhaDoPessoal(ctx, contaId, pedidoPor = '') {
    const quem = { id: null, nome: `${String(pedidoPor).slice(0, 100) || 'Repartição de Pessoal e Quadros'} (Sistema de Gestão de Pessoal)` }
    // o endereço público do portal vai na ficha (o Pessoal só conhece o endereço interno)
    return this.#reporSenha({ ...ctx, actor: quem }, contaId).then((r) => ({ ...r, portal: this.urlPortal || '' }))
  }

  async #reporSenha(ctx, id) {
    const c = await this.contas.porId(id)
    if (!c) throw new NaoEncontrado('Conta não encontrada.')
    const inicial = this.gerarSenha(c.email)
    c.mudarSenha(await this.cifra.cifrar(inicial))
    c.deveMudarSenha = true
    c.tentativasFalhadas = 0
    c.bloqueadoAte = null
    await this.contas.guardar(c)
    await this.auditoria.registar(ctx, { acao: 'repor_senha_portal', colecao: 'contas_portal', alvoId: c.id, alvoTitulo: `${c.nome} (${c.numero})` })
    return { ...c.publico(), senhaInicial: inicial }
  }

  /*
    Contas enviadas pelo Sistema de Gestão de Pessoal (rede interna), já com a assinatura verificada.
    Cria quem ainda não tem conta, atualiza o nome e os dados de quem tem, e desativa quem deixou de ser
    docente/estudante ou saiu da Escola. O e-mail é a chave: a conta do portal não sabe mais nada da ficha.
  */
  // fotografia que vem do Pessoal: { id, dados (base64) } guarda-se na pasta privada; null apaga-a
  async #fotoDoPessoal(contaId, foto) {
    if (foto === undefined || !this.privados) return
    const atual = await this.contas.foto(contaId)
    if (foto === null) {
      if (atual?.fotoCaminho) this.privados.apagar(this.privados.absoluto(atual.fotoCaminho))
      await this.contas.guardarFoto(contaId, null, null)
      return
    }
    if (atual?.fotoId === foto.id) return
    const dados = Buffer.from(foto.dados, 'base64')
    const tipo = [['image/jpeg', [0xff, 0xd8, 0xff]], ['image/png', [0x89, 0x50, 0x4e, 0x47]], ['image/webp', [0x52, 0x49, 0x46, 0x46]]].find(([, a]) => a.every((b, i) => dados[i] === b))?.[0]
    if (!tipo) throw new ErroValidacao('A fotografia não é JPG, PNG nem WEBP.')
    const { caminho } = this.privados.guardar(dados, tipo)
    if (atual?.fotoCaminho) this.privados.apagar(this.privados.absoluto(atual.fotoCaminho))
    await this.contas.guardarFoto(contaId, caminho, foto.id)
  }

  // a fotografia de uma conta, para o painel (quem pode ver o registo) e para o próprio no portal
  async fotoDaConta(ctx, contaId, { propria = false } = {}) {
    if (!propria) ctx.actor.exigir('pessoal.ver', 'academico.ver')
    const f = await this.contas.foto(contaId)
    if (!f?.fotoCaminho || !this.privados) throw new NaoEncontrado('Sem fotografia.')
    return { caminho: this.privados.absoluto(f.fotoCaminho), tipo: f.fotoCaminho.endsWith('.png') ? 'image/png' : f.fotoCaminho.endsWith('.webp') ? 'image/webp' : 'image/jpeg', nome: 'foto' }
  }

  async sincronizarDoPessoal(ctx, pessoas) {
    const resultados = []
    let criadas = 0
    let atualizadas = 0
    for (const p of pessoas) {
      try {
        const email = emailDaEscola(p.email, this.dominioEmail)
        const t = escolha(p.tipo, 'tipo', 'Tipo de conta', TIPOS_CONTA)
        // a conta já enviada reconhece-se pelo id (assim uma mudança de e-mail não cria outra conta)
        const porId = p.contaId ? await this.contas.porId(p.contaId) : null
        const existente = (porId && porId.tipo === t ? porId : null) ?? await this.contas.porEmail(email)
        if (existente && existente.email !== email) {
          const outra = await this.contas.porEmail(email)
          if (outra && outra.id !== existente.id) throw new ErroValidacao('Já existe outra conta no portal com o novo e-mail.')
          existente.email = email
        }
        if (!existente) {
          if (!p.ativo) {
            resultados.push({ ref: p.ref, ok: true, contaId: null })
            continue
          }
          const nome = texto(p.nome, 'nome', 'Nome completo', { min: 5, max: 150 })
          // a palavra-passe fica desconhecida: a Repartição dá a ficha de acesso com «Repor a palavra-passe»
          let conta
          for (let tentativa = 0; !conta; tentativa++) {
            try {
              const ano = this.relogio.agora().getFullYear()
              conta = await this.contas.criar({ tipo: t, numero: numeroConta(t, ano, await this.contas.proximaSequencia(t, ano)), nome, email, senha: await this.cifra.cifrar(this.gerarSenha(email)), dados: await this.#dadosConta(p.dados) })
            } catch (erro) {
              if (!/Número/.test(erro.message) || tentativa >= 3) throw erro
            }
          }
          await this.#fotoDoPessoal(conta.id, p.foto)
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
        await this.#fotoDoPessoal(existente.id, p.foto)
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
    this.#soNoPessoal()
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
        let senhaInicial
        if (existente && existente.tipo !== t) throw new ErroValidacao(`Já está registado como ${existente.tipo}.`)
        if (!simular && !existente) {
          const nova = await this.criarConta(ctx, { tipo: t, nome, email, dados: { posto: l.posto, ramo: l.ramo, nip: l.nip, telefone: l.telefone } })
          numero = nova.numero
          senhaInicial = nova.senhaInicial
          acao = 'registado'
        }
        resultado.push({ ...linha, nome, email, acao, numero, ...(senhaInicial ? { senhaInicial } : {}) })
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
