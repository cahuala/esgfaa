import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, militar } from '../apoio/ambiente.js'
import { emailDeAcesso } from '../../src/dominio/pessoal/emailAcesso.js'

// e-mails de acesso à plataforma (nome.apelido@portal.esg.emfaa.gov.ao) para os docentes e estudantes sem e-mail
describe('E-mails de acesso ao portal dos docentes e estudantes', () => {
  let amb, adm
  const criar = async (nome, nip, dados = {}) => {
    const p = (await adm.post('/api/pessoas').send(militar({ nome, nip })).expect(201)).body
    await amb.contentor.bd.pessoa.update({ where: { id: p.id }, data: { email: null, ...dados } })
    return p
  }
  before(async () => {
    amb = await criarAmbiente()
    adm = amb.com(await amb.entrar())
  })
  after(() => amb.fechar())

  it('nome.apelido, sem acentos; se já houver, com o 2.º nome e depois um número', () => {
    const d = 'portal.esg.emfaa.gov.ao'
    assert.equal(emailDeAcesso('Paulino Soma Kesenje', d, new Set()), 'paulino.kesenje@portal.esg.emfaa.gov.ao')
    assert.equal(emailDeAcesso('João da Conceição Ângelo', d, new Set(['joao.angelo@portal.esg.emfaa.gov.ao'])), 'joao.conceicao.angelo@portal.esg.emfaa.gov.ao')
    assert.equal(emailDeAcesso('Ana Paz', d, new Set(['ana.paz@portal.esg.emfaa.gov.ao'])), 'ana.paz2@portal.esg.emfaa.gov.ao')
  })

  it('cria só para quem não tem e-mail (docentes e estudantes, também os antigos) e põe-nos na fila do portal', async () => {
    const est = await criar('Major Estudante Sem Email', 'NIPEA1', { vinculo: 'estudante' })
    const antigo = await criar('Capitão Finalista Antigo', 'NIPEA2', { vinculo: 'estudante', ativo: false })
    const doc = await criar('Coronel Docente Efectivo Sem Email', 'NIPEA3', { outrosVinculos: ['docente'] })
    const comEmail = await criar('Tenente Estudante Com Email', 'NIPEA4', { vinculo: 'estudante', email: 'tenente.proprio@esgfaa.gov.ao' })
    const efectivo = await criar('Sargento So Efectivo', 'NIPEA5')
    const sim = (await adm.post('/api/portal/emails-acesso').send({ simular: true }).expect(200)).body
    assert.equal(sim.dominio, 'portal.esg.emfaa.gov.ao')
    const ids = sim.exemplos.map((x) => x.id)
    assert.ok(ids.includes(est.id) && ids.includes(antigo.id) && ids.includes(doc.id))
    assert.ok(!ids.includes(comEmail.id) && !ids.includes(efectivo.id))
    assert.equal((await amb.contentor.bd.pessoa.findUnique({ where: { id: est.id } })).email, null)
    await adm.post('/api/portal/emails-acesso').send({ simular: false }).expect(200)
    const e = await amb.contentor.bd.pessoa.findUnique({ where: { id: est.id }, include: { sincronizacao: true } })
    assert.deepEqual([e.email, e.sincronizacao?.estado], ['major.email@portal.esg.emfaa.gov.ao', 'pendente'])
    assert.equal((await amb.contentor.bd.pessoa.findUnique({ where: { id: comEmail.id } })).email, 'tenente.proprio@esgfaa.gov.ao')
    assert.equal((await amb.contentor.bd.pessoa.findUnique({ where: { id: efectivo.id } })).email, null)
    // outra vez: nada a criar
    assert.equal((await adm.post('/api/portal/emails-acesso').send({ simular: true }).expect(200)).body.total, 0)
  })
})
