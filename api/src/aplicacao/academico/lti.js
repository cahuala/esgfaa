import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { ErroValidacao, NaoEncontrado } from '../../dominio/comum/erros.js'
import { urlSegura } from '../../dominio/comum/urls.js'
import { texto } from '../../dominio/academico/comum/validacao.js'

const LTI = 'https://purl.imsglobal.org/spec/lti/claim'
const PAPEL = { docente: 'http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor', estudante: 'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner' }
const AUDIENCIA_PEDIDO = 'esgfaa-lti-pedido'

const https = (v, campo, rotulo) => {
  const u = String(v || '').trim()
  if (!/^https:\/\//.test(u) || !urlSegura(u) || u.length > 1000) throw new ErroValidacao(`${rotulo}: indique um endereço https://`, { campo })
  return u
}

/*
  Ferramentas externas por LTI 1.3 (o portal é a "plataforma"). A Administração Escolar regista cada ferramenta
  (endereços que a ferramenta indica) e passa-lhe os dados do portal (emissor, client_id, deployment_id, JWKS e
  endereço de autorização). Ao abrir a atividade, o portal começa o login OIDC na ferramenta; esta volta ao
  endereço de autorização, e o portal responde com o id_token assinado (quem é, papel, cadeira, atividade).
*/
export class ServicoLti {
  constructor({ lti, academico, contas, apoio, disponibilidade, registos, auditoria, chaves, segredo, nomeEscola = 'Escola Superior de Guerra' }) {
    Object.assign(this, { lti, academico, contas, apoio, disponibilidade, registos, auditoria, chaves, segredo, nomeEscola })
  }

  // dados que a ferramenta precisa de saber sobre o portal
  configuracao(emissor) {
    return { emissor, jwks: `${emissor}/api/lti/jwks`, autorizacao: `${emissor}/api/lti/autorizar` }
  }

  jwks() {
    return { keys: [this.chaves.jwk] }
  }

  // ---------- Administração Escolar ----------

  async listar(ctx, emissor) {
    ctx.actor.exigir('academico.ver')
    return { plataforma: this.configuracao(emissor), ferramentas: await this.lti.listar() }
  }

  #dados(d) {
    const urlLancamento = https(d.urlLancamento, 'urlLancamento', 'Endereço de lançamento')
    return {
      nome: texto(d.nome, 'nome', 'Nome', { min: 2, max: 120 }),
      descricao: texto(d.descricao, 'descricao', 'Descrição', { max: 500, obrigatorio: false }),
      urlLogin: https(d.urlLogin, 'urlLogin', 'Endereço de início de sessão (login)'),
      urlLancamento,
      redirecionamentos: [...new Set((Array.isArray(d.redirecionamentos) ? d.redirecionamentos : String(d.redirecionamentos || '').split(/\s+/)).filter(Boolean).map((u) => https(u, 'redirecionamentos', 'Endereço de retorno')))].slice(0, 10),
      idImplementacao: texto(d.idImplementacao || '1', 'idImplementacao', 'Deployment ID', { max: 100 }),
      partilharDados: d.partilharDados === true,
      ativa: d.ativa !== false,
    }
  }

  async criar(ctx, d) {
    ctx.actor.exigir('academico.gerir')
    const f = await this.lti.criar({ ...this.#dados(d), clienteId: `esgfaa-${crypto.randomBytes(8).toString('hex')}` })
    await this.auditoria.registar(ctx, { acao: 'criar_ferramenta_lti', colecao: 'lti', alvoId: f.id, alvoTitulo: f.nome })
    return f
  }

  async atualizar(ctx, id, d) {
    ctx.actor.exigir('academico.gerir')
    const f = await this.lti.ler(id)
    if (!f) throw new NaoEncontrado('Ferramenta não encontrada.')
    const r = await this.lti.atualizar(f.id, this.#dados({ ...f, ...d }))
    await this.auditoria.registar(ctx, { acao: 'editar_ferramenta_lti', colecao: 'lti', alvoId: f.id, alvoTitulo: r.nome })
    return r
  }

  async apagar(ctx, id) {
    ctx.actor.exigir('academico.gerir')
    const f = await this.lti.ler(id)
    if (!f) throw new NaoEncontrado('Ferramenta não encontrada.')
    await this.lti.apagar(f.id)
    await this.auditoria.registar(ctx, { acao: 'apagar_ferramenta_lti', colecao: 'lti', alvoId: f.id, alvoTitulo: f.nome })
  }

  // ---------- portal ----------

  // o docente escolhe uma destas ao criar a atividade
  async ativas() {
    return (await this.lti.listar()).filter((f) => f.ativa).map((f) => ({ id: f.id, nome: f.nome, descricao: f.descricao }))
  }

  async ferramentaAtiva(id) {
    const f = await this.lti.ler(id)
    if (!f?.ativa) throw new ErroValidacao('Escolha uma ferramenta externa ativa.', { campo: 'ferramentaId' })
    return f
  }

  // 1.º passo: o portal pede à ferramenta para começar a sessão (formulário enviado pelo navegador)
  async lancamento(ctx, materialId, emissor) {
    const m = await this.academico.material(materialId)
    if (!m || m.tipo !== 'lti') throw new NaoEncontrado('Atividade não encontrada.')
    if (ctx.conta.tipo === 'docente') await this.apoio.cadeiraDoDocente(ctx.conta, m.cadeiraId)
    else {
      await this.apoio.cadeiraAcessivel(ctx.conta, m.cadeiraId)
      await this.disponibilidade.exigir(m.cadeiraId, ctx.conta.id, 'material', m.id)
      await this.registos?.registar(ctx.conta, m.cadeiraId, 'material', m.id)
    }
    const f = await this.ferramentaAtiva(m.estrutura?.ferramentaId)
    const alvo = m.estrutura?.url || f.urlLancamento
    const pista = jwt.sign({ c: ctx.conta.id, m: m.id, f: f.id }, this.segredo, { audience: AUDIENCIA_PEDIDO, expiresIn: '10m', algorithm: 'HS256' })
    return {
      url: f.urlLogin, nome: f.nome,
      campos: { iss: emissor, login_hint: pista, target_link_uri: alvo, lti_message_hint: String(m.id), client_id: f.clienteId, lti_deployment_id: f.idImplementacao },
    }
  }

  // 2.º passo (OIDC): a ferramenta volta aqui; responde-se com o id_token, enviado por formulário para o redirect_uri
  async autorizar(p, emissor) {
    const erro = (m) => { throw new ErroValidacao(`Pedido LTI inválido: ${m}`) }
    if (p.response_type !== 'id_token') erro('response_type tem de ser id_token.')
    if (!String(p.scope || '').split(' ').includes('openid')) erro('falta o scope openid.')
    if (p.response_mode && p.response_mode !== 'form_post') erro('response_mode tem de ser form_post.')
    if (!p.nonce || String(p.nonce).length > 200) erro('falta o nonce.')
    const f = await this.lti.porCliente(p.client_id)
    if (!f?.ativa) erro('client_id desconhecido.')
    const permitidos = [f.urlLancamento, ...f.redirecionamentos]
    if (!permitidos.includes(p.redirect_uri)) erro('redirect_uri não registado para esta ferramenta.')
    let pista
    try { pista = jwt.verify(String(p.login_hint || ''), this.segredo, { audience: AUDIENCIA_PEDIDO, algorithms: ['HS256'] }) } catch { erro('login_hint inválido ou expirado. Abra outra vez a atividade no portal.') }
    if (pista.f !== f.id || (p.lti_message_hint && String(p.lti_message_hint) !== String(pista.m))) erro('o pedido não corresponde a esta ferramenta.')
    const [m, conta] = await Promise.all([this.academico.material(pista.m), this.contas.porId(pista.c)])
    if (!m || !conta?.ativo) throw new NaoEncontrado('Atividade não encontrada.')
    const cadeira = await this.academico.cadeira(m.cadeiraId)
    const agora = Math.floor(Date.now() / 1000)
    const corpo = {
      iss: emissor, aud: f.clienteId, sub: `${conta.tipo}-${conta.id}`, iat: agora, exp: agora + 300, nonce: String(p.nonce),
      [`${LTI}/message_type`]: 'LtiResourceLinkRequest',
      [`${LTI}/version`]: '1.3.0',
      [`${LTI}/deployment_id`]: f.idImplementacao,
      [`${LTI}/target_link_uri`]: m.estrutura?.url || f.urlLancamento,
      [`${LTI}/resource_link`]: { id: `material-${m.id}`, title: m.titulo, description: m.descricao || undefined },
      [`${LTI}/roles`]: [PAPEL[conta.tipo] || PAPEL.estudante],
      [`${LTI}/context`]: { id: `cadeira-${cadeira.id}`, label: cadeira.codigo, title: cadeira.nome, type: ['http://purl.imsglobal.org/vocab/lis/v2/course#CourseOffering'] },
      [`${LTI}/tool_platform`]: { guid: emissor, name: this.nomeEscola, product_family_code: 'esgfaa' },
      [`${LTI}/launch_presentation`]: { document_target: 'window', locale: 'pt-PT' },
      ...(f.partilharDados ? { name: conta.nome, email: conta.email } : {}),
    }
    const idToken = jwt.sign(corpo, this.chaves.privada, { algorithm: 'RS256', keyid: this.chaves.kid })
    return { acao: p.redirect_uri, campos: { id_token: idToken, ...(p.state ? { state: String(p.state).slice(0, 2000) } : {}) } }
  }
}
