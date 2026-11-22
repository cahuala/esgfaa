import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente } from '../apoio/ambiente.js'

// um curso de até 12 meses (os da Escola duram 10) tem um só ano: a turma é logo a final; um curso pode ter várias turmas
describe('Turmas e duração do curso', () => {
  let amb, adm
  before(async () => {
    amb = await criarAmbiente()
    adm = amb.com(await amb.entrar())
    await adm.post('/api/admin/colecoes/cursos').send({ nome: 'Curso Superior de Comando e Direcção', duracao: '10 meses' }).expect(201)
    await adm.post('/api/admin/colecoes/cursos').send({ nome: 'Curso Longo de Teste', duracao: '2 anos' }).expect(201)
  })
  after(() => amb.fechar())

  it('curso de 10 meses: a turma fica final, sem ano curricular; o mesmo curso tem várias turmas no mesmo ano', async () => {
    const a = (await adm.post('/api/admin/academico/turmas').send({ curso: 'curso-superior-de-comando-e-direccao', anoLetivo: '2026/2027', nome: '32.º CSCD — Turma A', anoCurricular: 2 }).expect(201)).body
    const b = (await adm.post('/api/admin/academico/turmas').send({ curso: 'curso-superior-de-comando-e-direccao', anoLetivo: '2026/2027', nome: '32.º CSCD — Turma B' }).expect(201)).body
    assert.deepEqual([a.anoFinal, a.anoCurricular, b.anoFinal], [true, 1, true])
  })

  it('curso de 2 anos: a turma do 1.º ano não é a final', async () => {
    const t = (await adm.post('/api/admin/academico/turmas').send({ curso: 'curso-longo-de-teste', anoLetivo: '2026/2027', nome: 'Longo 1.º ano', anoCurricular: 1 }).expect(201)).body
    assert.deepEqual([t.anoFinal, t.anoCurricular], [false, 1])
  })
})
