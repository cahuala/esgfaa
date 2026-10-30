import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente } from '../apoio/ambiente.js'

const NOVA = 'Portal2026segura'
const SUB = (n) => ({ endpoint: `https://fcm.googleapis.com/fcm/send/aparelho-${n}`, keys: { p256dh: `BCpd${'x'.repeat(80)}${n}`, auth: `auth${n}abcdef` }, aparelho: 'Android · Chrome' })

describe('avisos no telemóvel (Web Push): ligar neste aparelho, receber, e os aparelhos que deixam de aceitar saem', () => {
  let amb, cadeira
  const contas = {}
  const tokens = {}
  const enviados = []
  const expirados = new Set()
  const portal = (quem) => amb.com(tokens[quem])

  before(async () => {
    const push = {
      chavePublica: 'BChavePublicaDeTeste',
      enviar: async (s, carga) => { enviados.push({ endpoint: s.endpoint, carga }); return expirados.has(s.endpoint) ? 'expirada' : 'ok' },
    }
    amb = await criarAmbiente({ externos: { push } })
    const admin = await amb.entrar()
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Estado-Maior' })
    const s = await amb.criarUtilizador('administrador')
    const sec = () => amb.com(s.token)
    const turma = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM A' })).body
    contas.prof = (await sec().post('/api/admin/academico/contas').send({ tipo: 'docente', nome: 'Docente prof Teste', email: 'prof@esgfaa.gov.ao' })).body
    for (const k of ['ana', 'bruno']) contas[k] = (await amb.registarEMatricular(sec(), turma.id, { nome: `Estudante ${k} Teste`, email: `${k}@esgfaa.gov.ao` })).body
    cadeira = (await sec().post(`/api/admin/academico/turmas/${turma.id}/cadeiras`).send({ codigo: 'EST101', nome: 'Estratégia' })).body
    await sec().put(`/api/admin/academico/cadeiras/${cadeira.id}/docentes`).send({ docentes: [{ docenteId: contas.prof.id, papel: 'regente' }] })
    for (const k of ['prof', 'ana', 'bruno']) {
      const email = `${k}@esgfaa.gov.ao`
      const r = await amb.http().post('/api/portal/entrar').send({ email, senha: amb.senhaInicial(email) })
      tokens[k] = (await amb.com(r.body.token).put('/api/portal/eu/senha').send({ atual: amb.senhaInicial(email), nova: NOVA })).body.token
    }
  })
  after(() => amb.fechar())

  it('subscrever, receber o aviso de um novo aviso da cadeira, e deixar de receber', async () => {
    assert.equal((await portal('ana').get('/api/portal/push/chave')).body.chave, 'BChavePublicaDeTeste')
    assert.equal((await amb.http().get('/api/portal/push/chave')).status, 401)
    assert.equal((await portal('ana').post('/api/portal/push/subscricao').send({ ...SUB(1), endpoint: 'http://inseguro/x' })).status, 400)
    let r = await portal('ana').post('/api/portal/push/subscricao').send(SUB(1))
    assert.equal(r.status, 201, r.body.erro)
    assert.deepEqual(r.body, { ativo: true, aparelhos: 1 })
    await portal('ana').post('/api/portal/push/subscricao').send(SUB(2)) // segundo aparelho
    await portal('bruno').post('/api/portal/push/subscricao').send(SUB(3))
    expirados.add(SUB(3).endpoint) // o telemóvel do Bruno já não aceita

    await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/avisos`).send({ titulo: 'Primeira aula', texto: 'Tragam o programa lido.' })
    await new Promise((ok) => setTimeout(ok, 200))
    const daAna = enviados.filter((x) => x.endpoint.includes('aparelho-1') || x.endpoint.includes('aparelho-2'))
    assert.equal(daAna.length, 2)
    assert.match(daAna[0].carga.titulo, /Primeira aula/)
    assert.match(daAna[0].carga.ligacao, new RegExp(`/cadeiras/${cadeira.id}`))
    // o aparelho expirado do Bruno saiu da lista
    enviados.length = 0
    await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/avisos`).send({ titulo: 'Segunda aula', texto: 'Sala B.' })
    await new Promise((ok) => setTimeout(ok, 200))
    assert.equal(enviados.filter((x) => x.endpoint.includes('aparelho-3')).length, 0)

    // desligar num aparelho; o outro continua
    r = await portal('ana').delete('/api/portal/push/subscricao').send({ endpoint: SUB(1).endpoint })
    assert.deepEqual(r.body, { ativo: false, aparelhos: 1 })
    // o Bruno não consegue desligar o aparelho da Ana
    await portal('bruno').delete('/api/portal/push/subscricao').send({ endpoint: SUB(2).endpoint })
    enviados.length = 0
    await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/avisos`).send({ titulo: 'Terceira aula', texto: 'Auditório.' })
    await new Promise((ok) => setTimeout(ok, 200))
    assert.deepEqual(enviados.map((x) => x.endpoint), [SUB(2).endpoint])
  })
})
