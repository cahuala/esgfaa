import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { criarAmbiente } from '../apoio/ambiente.js'

const NOVA = 'Portal2026segura'
const LTI = 'https://purl.imsglobal.org/spec/lti/claim'
const FERRAMENTA = { nome: 'Simulador de tiro', descricao: 'Laboratório virtual', urlLogin: 'https://simulador.exemplo.ao/lti/login', urlLancamento: 'https://simulador.exemplo.ao/lti/lancar', partilharDados: true }
const campo = (html, nome) => html.match(new RegExp(`name="${nome}" value="([^"]*)"`))?.[1].replace(/&amp;/g, '&')

describe('ferramentas externas por LTI 1.3: o portal é a plataforma', () => {
  let amb, sec, cadeira, ferramenta, material
  const tokens = {}
  const contas = {}
  const como = (quem) => amb.com(tokens[quem])

  // a ferramenta: recebe o pedido de login e volta ao endereço de autorização do portal
  const autorizar = (campos, extra = {}) => amb.http().get('/api/lti/autorizar').query({
    scope: 'openid', response_type: 'id_token', response_mode: 'form_post', prompt: 'none', client_id: campos.client_id,
    redirect_uri: campos.target_link_uri, login_hint: campos.login_hint, lti_message_hint: campos.lti_message_hint, state: 'estado-da-ferramenta', nonce: 'n-0001', ...extra,
  })

  before(async () => {
    // o emissor (iss) é o endereço público da API, que tem de ser fixo (PUBLIC_URL)
    amb = await criarAmbiente({ env: { PUBLIC_URL: 'https://api.esgfaa.teste' } })
    const admin = await amb.entrar()
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Estado-Maior' })
    const s = await amb.criarUtilizador('administrador')
    sec = () => amb.com(s.token)
    const turma = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM A' })).body
    const outra = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM B' })).body
    contas.prof = (await sec().post('/api/admin/academico/contas').send({ tipo: 'docente', nome: 'Docente Prof Teste', email: 'prof@esgfaa.gov.ao' })).body
    contas.ana = (await amb.registarEMatricular(sec(), turma.id, { nome: 'Estudante ana Teste', email: 'ana@esgfaa.gov.ao' })).body
    contas.carla = (await amb.registarEMatricular(sec(), outra.id, { nome: 'Estudante carla Teste', email: 'carla@esgfaa.gov.ao' })).body
    cadeira = (await sec().post(`/api/admin/academico/turmas/${turma.id}/cadeiras`).send({ codigo: 'TAT101', nome: 'Tática' })).body
    await sec().put(`/api/admin/academico/cadeiras/${cadeira.id}/docentes`).send({ docentes: [{ docenteId: contas.prof.id, papel: 'regente' }] })
    for (const k of ['prof', 'ana', 'carla']) {
      const email = `${k}@esgfaa.gov.ao`
      const r = await amb.http().post('/api/portal/entrar').send({ email, senha: email })
      tokens[k] = (await amb.com(r.body.token).put('/api/portal/eu/senha').send({ atual: email, nova: NOVA })).body.token
    }
  })
  after(() => amb.fechar())

  it('a Administração Escolar regista a ferramenta e vê os dados do portal para a configurar', async () => {
    assert.equal((await sec().post('/api/admin/academico/lti').send({ ...FERRAMENTA, urlLogin: 'http://inseguro.ao/login' })).status, 400)
    const r = await sec().post('/api/admin/academico/lti').send(FERRAMENTA)
    assert.equal(r.status, 201, r.body.erro)
    ferramenta = r.body
    assert.match(ferramenta.clienteId, /^esgfaa-[0-9a-f]{16}$/)
    const l = (await sec().get('/api/admin/academico/lti')).body
    assert.equal(l.plataforma.emissor, 'https://api.esgfaa.teste')
    assert.match(l.plataforma.jwks, /\/api\/lti\/jwks$/)
    assert.match(l.plataforma.autorizacao, /\/api\/lti\/autorizar$/)
    const jwks = (await amb.http().get('/api/lti/jwks')).body
    assert.equal(jwks.keys[0].kty, 'RSA')
    assert.ok(!jwks.keys[0].d, 'a chave publicada não pode ter a parte privada')
  })

  it('o docente cria a atividade e o estudante entra na ferramenta já identificado (id_token assinado)', async () => {
    assert.deepEqual((await como('prof').get('/api/portal/lti/ferramentas')).body.map((f) => f.nome), ['Simulador de tiro'])
    const m = await como('prof').post(`/api/portal/cadeiras/${cadeira.id}/materiais`).send({ tipo: 'lti', titulo: 'Exercício de tiro', ferramentaId: ferramenta.id })
    assert.equal(m.status, 201, m.body.erro)
    material = m.body
    const l = await como('ana').post(`/api/portal/materiais/${material.id}/lti`)
    assert.equal(l.status, 200, l.body.erro)
    assert.equal(l.body.url, FERRAMENTA.urlLogin)
    assert.equal(l.body.campos.client_id, ferramenta.clienteId)

    const a = await autorizar(l.body.campos)
    assert.equal(a.status, 200, a.body?.erro)
    assert.match(a.text, new RegExp(`action="${FERRAMENTA.urlLancamento}"`))
    assert.match(a.headers['content-security-policy'], /form-action https:\/\/simulador\.exemplo\.ao/)
    assert.equal(campo(a.text, 'state'), 'estado-da-ferramenta')
    // a ferramenta verifica com a chave pública do portal
    const jwk = (await amb.http().get('/api/lti/jwks')).body.keys[0]
    const t = jwt.verify(campo(a.text, 'id_token'), crypto.createPublicKey({ key: jwk, format: 'jwk' }), { algorithms: ['RS256'], audience: ferramenta.clienteId, issuer: l.body.campos.iss })
    assert.equal(t.nonce, 'n-0001')
    assert.equal(t.sub, `estudante-${contas.ana.id}`)
    assert.equal(t[`${LTI}/message_type`], 'LtiResourceLinkRequest')
    assert.equal(t[`${LTI}/version`], '1.3.0')
    assert.match(t[`${LTI}/roles`][0], /#Learner$/)
    assert.deepEqual([t[`${LTI}/context`].label, t[`${LTI}/resource_link`].title], ['TAT101', 'Exercício de tiro'])
    assert.equal(t.email, 'ana@esgfaa.gov.ao') // a ferramenta pode receber os dados (partilharDados)
    // o docente entra como Instructor
    const d = (await como('prof').post(`/api/portal/materiais/${material.id}/lti`)).body
    const td = jwt.decode(campo((await autorizar(d.campos)).text, 'id_token'))
    assert.match(td[`${LTI}/roles`][0], /#Instructor$/)
  })

  it('recusa: outra turma, redirect_uri estranho, pista falsa ou trocada, ferramenta desativada', async () => {
    assert.ok([403, 404].includes((await como('carla').post(`/api/portal/materiais/${material.id}/lti`)).status))
    const { campos } = (await como('ana').post(`/api/portal/materiais/${material.id}/lti`)).body
    assert.equal((await autorizar(campos, { redirect_uri: 'https://ladrao.exemplo/recolher' })).status, 400)
    assert.equal((await autorizar(campos, { login_hint: jwt.sign({ c: contas.prof.id, m: material.id, f: ferramenta.id }, 'outra-chave-qualquer', { audience: 'esgfaa-lti-pedido' }) })).status, 400)
    assert.equal((await autorizar(campos, { lti_message_hint: '999' })).status, 400)
    assert.equal((await autorizar(campos, { response_type: 'code' })).status, 400)
    assert.equal((await autorizar(campos, { nonce: '' })).status, 400)
    await sec().put(`/api/admin/academico/lti/${ferramenta.id}`).send({ ativa: false })
    assert.equal((await autorizar(campos)).status, 400)
    assert.equal((await como('ana').post(`/api/portal/materiais/${material.id}/lti`)).status, 400)
  })
})
