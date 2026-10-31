import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, relogioFalso } from '../apoio/ambiente.js'

const DATAS = { inicio: '2026-10-01', semestre1Inicio: '2026-10-05', semestre1Fim: '2027-02-12', semestre2Inicio: '2027-03-01', semestre2Fim: '2027-07-16', fim: '2027-07-31' }

describe('anos letivos: datas do ano e dos semestres', () => {
  let amb, adm
  before(async () => {
    amb = await criarAmbiente({ relogio: relogioFalso('2026-11-20T10:00:00Z') })
    adm = amb.com(await amb.entrar())
  })
  after(() => amb.fechar())

  it('cria, valida as datas, diz o semestre em curso e qual é o ano atual', async () => {
    const r = await adm.post('/api/admin/academico/anos-letivos').send({ id: '2026/2027', ...DATAS })
    assert.equal(r.status, 201, r.body.erro)
    assert.equal(r.body.atual, true) // o primeiro fica o atual
    assert.equal(r.body.semestreAtual, '1') // 20 de novembro: 1.º semestre
    assert.equal((await adm.post('/api/admin/academico/anos-letivos').send({ id: '2026/2027', ...DATAS })).status, 409)
    assert.equal((await adm.post('/api/admin/academico/anos-letivos').send({ id: '2027/2029', ...DATAS })).status, 400)
    const mal = await adm.post('/api/admin/academico/anos-letivos').send({ id: '2027/2028', ...DATAS, semestre2Inicio: '2027-01-10' })
    assert.equal(mal.status, 400)
    assert.match(mal.body.erro, /2\.º semestre começa depois do fim do 1\.º/)

    await adm.post('/api/admin/academico/anos-letivos').send({ id: '2027/2028', inicio: '2027-10-01', semestre1Inicio: '2027-10-04', semestre1Fim: '2028-02-11', semestre2Inicio: '2028-02-28', semestre2Fim: '2028-07-14', fim: '2028-07-31' }).expect(201)
    const lista = (await adm.post('/api/admin/academico/anos-letivos/2027-2028/atual').expect(200)).body
    assert.deepEqual(lista.map((a) => [a.id, a.atual]), [['2027/2028', true], ['2026/2027', false]])
    const editado = (await adm.put('/api/admin/academico/anos-letivos/2026-2027').send({ ...DATAS, semestre1Fim: '2027-02-05' }).expect(200)).body
    assert.equal(editado.semestre1Fim, '2027-02-05')
  })

  it('uma turma num ano por configurar regista-o com as datas habituais; com turmas não se apaga', async () => {
    await adm.post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Estado-Maior' }).expect(201)
    await adm.post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2028/2029', nome: 'CEM 28' }).expect(201)
    const ano = (await adm.get('/api/admin/academico/anos-letivos').expect(200)).body.find((a) => a.id === '2028/2029')
    assert.deepEqual([ano.inicio, ano.semestre2Inicio, ano.fim, ano.turmas], ['2028-10-01', '2029-02-16', '2029-07-31', 1])
    assert.equal((await adm.delete('/api/admin/academico/anos-letivos/2028-2029')).status, 409)
    assert.equal((await adm.delete('/api/admin/academico/anos-letivos/2026-2027')).status, 204)
  })

  it('a Repartição de Pessoal e Quadros não mexe nos anos letivos', async () => {
    const pq = amb.com((await amb.criarUtilizador('pessoal_quadros')).token)
    assert.equal((await pq.post('/api/admin/academico/anos-letivos').send({ id: '2030/2031', ...DATAS })).status, 403)
  })
})
