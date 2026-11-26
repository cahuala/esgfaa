import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente } from '../apoio/ambiente.js'

// documentos do ano lectivo: os discentes de cada curso, com o NIP, o posto, o ramo, o órgão e a ordem pelo posto
describe('Documentos do ano lectivo (dados estatísticos, por ramos, diplomas…)', () => {
  let amb, ensino
  before(async () => {
    amb = await criarAmbiente()
    const admin = await amb.entrar()
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso Superior de Comando e Direcção' })
    ensino = amb.com((await amb.criarUtilizador('administrador')).token)
    const t = (await ensino.post('/api/admin/academico/turmas').send({ curso: 'curso-superior-de-comando-e-direccao', anoLetivo: '2026/2027', nome: '32.º CSCD' }).expect(201)).body
    await amb.registarEMatricular(ensino, t.id, { nome: 'Coronel Discente Teste', email: 'cor.discente@esgfaa.gov.ao' })
    await amb.registarEMatricular(ensino, t.id, { nome: 'Superintendente Policia Teste', email: 'sup.policia@esgfaa.gov.ao' })
    // os dados que vêm do Pessoal: a Polícia com o posto equivalente das FAA (Brigadeiro), para ficar à frente
    await amb.contentor.prisma.contaPortal.updateMany({ where: { email: 'cor.discente@esgfaa.gov.ao' }, data: { dados: { posto: 'Coronel', ramo: 'FAN', nip: 'N1', departamento: 'Força Aérea Nacional', origem: 'faa' } } })
    await amb.contentor.prisma.contaPortal.updateMany({ where: { email: 'sup.policia@esgfaa.gov.ao' }, data: { dados: { posto: 'Comissário', postoEquivalente: 'Brigadeiro', ramo: '', nip: 'I0001', departamento: 'Polícia Nacional', origem: 'policia' } } })
  })
  after(() => amb.fechar())

  it('um curso por linha, os discentes pela ordem do posto (com o equivalente das FAA)', async () => {
    const d = (await ensino.get(`/api/admin/academico/documentos-do-ano?anoLetivo=${encodeURIComponent('2026/2027')}`).expect(200)).body
    assert.equal(d.cursos.length, 1)
    const [c] = d.cursos
    assert.deepEqual(c.linhas.map((l) => [l.posto, l.nip, l.orgao, l.origem, l.grau]), [['Comissário', 'I0001', 'Polícia Nacional', 'policia', 17], ['Coronel', 'N1', 'Força Aérea Nacional', 'faa', 16]])
    assert.equal((await ensino.get('/api/admin/academico/documentos-do-ano?anoLetivo=2026')).status, 400)
  })
})
