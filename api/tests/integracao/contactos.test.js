import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente } from '../apoio/ambiente.js'

const MENSAGEM = { nome: 'Joana Silva', email: 'Joana@Exemplo.ao', telefone: '+244 923 000 000', assunto: 'Visita de estudo', mensagem: 'Gostaria de saber se é possível visitar a Escola com uma turma.', consentimento: true }

describe('formulário de contacto do site: a mensagem chega ao painel', () => {
  let amb, admin
  before(async () => {
    amb = await criarAmbiente()
    admin = await amb.entrar()
  })
  after(() => amb.fechar())

  it('qualquer visitante envia; o painel vê, abre (fica lida), responde e apaga', async () => {
    const r = await amb.http().post('/api/publico/contactos').send(MENSAGEM)
    assert.equal(r.status, 201)
    assert.equal((await amb.com(admin).get('/api/admin/contactos/novas')).body.novas, 1)
    const l = (await amb.com(admin).get('/api/admin/contactos')).body
    assert.equal(l.mensagens.length, 1)
    const m = l.mensagens[0]
    assert.equal(m.email, 'joana@exemplo.ao')
    assert.equal(m.estado, 'nova')
    assert.equal((await amb.com(admin).get(`/api/admin/contactos/${m.id}`)).body.estado, 'lida')
    assert.equal((await amb.com(admin).get('/api/admin/contactos/novas')).body.novas, 0)
    const at = await amb.com(admin).patch(`/api/admin/contactos/${m.id}`).send({ estado: 'respondida', notas: 'Respondido por telefone.' })
    assert.equal(at.body.estado, 'respondida')
    assert.equal(at.body.notas, 'Respondido por telefone.')
    assert.equal((await amb.com(admin).delete(`/api/admin/contactos/${m.id}`)).status, 204)
    assert.equal((await amb.com(admin).get('/api/admin/contactos')).body.mensagens.length, 0)
  })

  it('valida os campos, ignora robôs e protege a lista', async () => {
    const sem = await amb.http().post('/api/publico/contactos').send({ ...MENSAGEM, consentimento: false })
    assert.equal(sem.status, 400)
    assert.match(sem.body.erro, /aceite/)
    assert.equal((await amb.http().post('/api/publico/contactos').send({ ...MENSAGEM, email: 'nao-e-email' })).status, 400)
    assert.equal((await amb.http().post('/api/publico/contactos').send({ ...MENSAGEM, mensagem: 'curta' })).status, 400)
    // campo escondido preenchido: responde como se tivesse corrido bem, mas não guarda
    assert.equal((await amb.http().post('/api/publico/contactos').send({ ...MENSAGEM, website: 'http://spam.example' })).status, 201)
    assert.equal((await amb.com(admin).get('/api/admin/contactos')).body.mensagens.length, 0)
    assert.equal((await amb.http().get('/api/admin/contactos')).status, 401)
    const redator = await amb.criarUtilizador('redator')
    assert.equal((await amb.com(redator.token).get('/api/admin/contactos')).status, 403)
    assert.equal((await amb.com(redator.token).get('/api/admin/contactos/novas')).body.novas, 0)
  })
})
