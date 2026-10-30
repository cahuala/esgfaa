import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, relogioFalso } from '../apoio/ambiente.js'

const NOVA = 'Portal2026segura'

// Lei n.º 22/11 (protecção de dados pessoais): aviso, direito de acesso, pedidos dos titulares e conservação
describe('protecção de dados pessoais', () => {
  let amb, relogio, sec, admin, ana
  before(async () => {
    relogio = relogioFalso('2026-11-09T09:00:00Z')
    amb = await criarAmbiente({ relogio })
    admin = amb.com(await amb.entrar())
    await admin.post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Estado-Maior' })
    const s = await amb.criarUtilizador('administrador')
    sec = () => amb.com(s.token)
    const turma = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM A' })).body
    await amb.registarEMatricular(sec(), turma.id, { nome: 'Estudante Ana Teste', email: 'ana@esgfaa.gov.ao' })
    const r = await amb.http().post('/api/portal/entrar').send({ email: 'ana@esgfaa.gov.ao', senha: amb.senhaInicial('ana@esgfaa.gov.ao') })
    ana = amb.com((await amb.com(r.body.token).put('/api/portal/eu/senha').send({ atual: amb.senhaInicial('ana@esgfaa.gov.ao'), nova: NOVA })).body.token)
  })
  after(() => amb.fechar())

  it('aviso de privacidade: por tomar conhecimento até a pessoa confirmar (portal e painel)', async () => {
    assert.equal((await ana.get('/api/portal/eu/privacidade')).body.conhecimentoEm, null)
    assert.ok((await ana.post('/api/portal/eu/privacidade')).body.conhecimentoEm)
    assert.equal((await admin.get('/api/admin/eu/privacidade')).body.conhecimentoEm, null)
    assert.ok((await admin.post('/api/admin/eu/privacidade')).body.conhecimentoEm)
  })

  it('direito de acesso: descarrega os seus dados, sem a palavra-passe', async () => {
    const r = await ana.get('/api/portal/eu/dados').expect(200)
    assert.match(r.headers['content-disposition'], /os-meus-dados\.json/)
    assert.equal(r.body.conta.email, 'ana@esgfaa.gov.ao')
    assert.equal(r.body.conta.senha, undefined)
    assert.equal(r.body.matriculas[0].turma.nome, 'CEM A')
  })

  it('pedido de rectificação: o titular pede, o painel responde e o titular é avisado', async () => {
    const p = (await ana.post('/api/portal/eu/pedidos-dados').send({ tipo: 'rectificacao', texto: 'O meu telefone está errado.' }).expect(201)).body
    assert.equal((await ana.post('/api/portal/eu/pedidos-dados').send({ tipo: 'xpto', texto: 'Teste de pedido' })).status, 400)
    const lista = (await admin.get('/api/admin/privacidade/pedidos').expect(200)).body
    assert.equal(lista[0].conta.email, 'ana@esgfaa.gov.ao')
    const rr = await admin.put(`/api/admin/privacidade/pedidos/${p.id}`).send({ estado: 'respondido', resposta: 'Corrigido na sua ficha.' })
    assert.equal(rr.status, 200)
    assert.equal((await ana.get('/api/portal/eu/pedidos-dados')).body[0].estado, 'respondido')
    await amb.contentor.servicos.comunicacao.esvaziar?.()
    const n = (await ana.get('/api/portal/notificacoes')).body
    assert.ok(n.lista.some((x) => /dados pessoais/.test(x.titulo)))
    // só quem vê o registo de atividades vê os pedidos
    const redator = await amb.criarUtilizador('redator')
    assert.equal((await amb.com(redator.token).get('/api/admin/privacidade/pedidos')).status, 403)
  })

  it('conservação: apaga as mensagens de contacto antigas e o IP dos comentários', async () => {
    await amb.contentor.prisma.mensagemContacto.create({ data: { nome: 'Antigo', email: 'a@exemplo.ao', assunto: 'x', mensagem: 'mensagem antiga', criadoEm: new Date('2024-01-01T00:00:00Z') } })
    await amb.contentor.prisma.mensagemContacto.create({ data: { nome: 'Recente', email: 'r@exemplo.ao', assunto: 'x', mensagem: 'mensagem recente' } })
    const r = await amb.contentor.servicos.privacidade.aplicarConservacao()
    assert.equal(r.mensagensContacto, 1)
    const restam = await amb.contentor.prisma.mensagemContacto.findMany()
    assert.deepEqual(restam.map((m) => m.nome), ['Recente'])
  })
})
