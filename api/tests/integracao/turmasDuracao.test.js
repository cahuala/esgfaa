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

  it('lista do curso: os estudantes de todas as turmas, pela ordem hierárquica, com a turma de cada um', async () => {
    const turmas = (await adm.get('/api/admin/academico/turmas').expect(200)).body.filter((t) => t.curso === 'curso-superior-de-comando-e-direccao')
    const [a, b] = turmas
    const conta = async (nome, posto, turmaId) => {
      const r = (await amb.registarEMatricular(adm, turmaId, { nome, email: `${nome.split(' ')[0].toLowerCase()}@esgfaa.gov.ao` })).body
      await amb.contentor.prisma.contaPortal.update({ where: { id: r.id }, data: { dados: posto ? { posto } : {} } })
    }
    await conta('Zeferino Major', 'Major', a.id)
    await conta('Bruno Coronel', 'Coronel', b.id)
    await conta('Abel Major', 'Major', b.id)
    await conta('Carla Civil', null, a.id)
    const l = (await adm.get('/api/admin/academico/cursos/curso-superior-de-comando-e-direccao/lista?anoLetivo=2026/2027').expect(200)).body
    assert.deepEqual(l.estudantes.map((e) => [e.nome, e.posto, e.turma]), [
      ['Bruno Coronel', 'Coronel', b.nome], ['Abel Major', 'Major', b.nome], ['Zeferino Major', 'Major', a.nome], ['Carla Civil', '', a.nome],
    ])
    assert.equal(l.turmas.length, 2)
    // a relação nominal da turma vem pela mesma ordem
    const t = (await adm.get(`/api/admin/academico/turmas/${b.id}`).expect(200)).body
    assert.deepEqual(t.matriculas.map((m) => m.estudante.nome), ['Bruno Coronel', 'Abel Major'])
  })

  it('a Administração Escolar designa o Director de cada curso (um docente com conta que vê o Ensino); fica na lista do curso', async () => {
    const rae = amb.com((await amb.criarUtilizador('secretaria')).token)
    const dir = await amb.criarUtilizador('director_curso')
    const area = await amb.criarUtilizador('area_cientifica')
    const gabinete = await amb.criarUtilizador('gabinete_ensino')
    const redactor = await amb.criarUtilizador('redator')
    // o Director de Curso e o chefe de departamento são docentes; o gabinete vê o Ensino mas não é docente
    await amb.contentor.prisma.contaPortal.create({ data: { tipo: 'docente', numero: 'D-dircur', nome: 'Utilizador director_curso', email: 'dircur@esgfaa.gov.ao', senha: 'x', dados: {} } })
    await amb.contentor.prisma.contaPortal.create({ data: { tipo: 'docente', numero: 'D-areaci', nome: 'Utilizador area_cientifica', email: 'areaci@esgfaa.gov.ao', senha: 'x', dados: {} } })
    const c = (await rae.get('/api/admin/academico/directores-curso').expect(200)).body
    const ids = c.candidatos.map((x) => x.utilizadorId)
    assert.ok(ids.includes(dir.id) && ids.includes(area.id) && !ids.includes(redactor.id) && !ids.includes(gabinete.id))
    assert.equal((await rae.put('/api/admin/academico/cursos/curso-superior-de-comando-e-direccao/director').send({ utilizadorId: gabinete.id })).status, 400)
    // quem não vê o Ensino não pode ser Director de Curso; só a Administração Escolar designa
    assert.equal((await rae.put('/api/admin/academico/cursos/curso-superior-de-comando-e-direccao/director').send({ utilizadorId: redactor.id })).status, 400)
    assert.equal((await amb.com(dir.token).put('/api/admin/academico/cursos/curso-superior-de-comando-e-direccao/director').send({ utilizadorId: dir.id })).status, 403)
    const r = (await rae.put('/api/admin/academico/cursos/curso-superior-de-comando-e-direccao/director').send({ utilizadorId: dir.id }).expect(200)).body
    assert.equal(r.directores['curso-superior-de-comando-e-direccao'].nome, 'Utilizador director_curso')
    // o Director de Curso vê o Ensino (sem alterar) e aparece na lista do curso
    const l = (await amb.com(dir.token).get('/api/admin/academico/cursos/curso-superior-de-comando-e-direccao/lista?anoLetivo=2026/2027').expect(200)).body
    assert.equal(l.director.nome, 'Utilizador director_curso')
    assert.equal((await amb.com(dir.token).post('/api/admin/academico/turmas').send({ curso: 'curso-superior-de-comando-e-direccao', anoLetivo: '2026/2027', nome: 'X' })).status, 403)
    await rae.put('/api/admin/academico/cursos/curso-superior-de-comando-e-direccao/director').send({ utilizadorId: null }).expect(200)
    assert.equal((await rae.get('/api/admin/academico/cursos/curso-superior-de-comando-e-direccao/lista').expect(200)).body.director, null)
  })
})
