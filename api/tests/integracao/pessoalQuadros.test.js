import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente } from '../apoio/ambiente.js'

/*
  Pessoal e Quadros regista estudantes e docentes; a Administração Escolar só escolhe
  quem já está registado (matricula, inscreve, aloca) e nunca regista.
*/
describe('Pessoal e Quadros regista; Administração Escolar matricula', () => {
  let amb, pessoal, escola, turma
  before(async () => {
    amb = await criarAmbiente()
    const admin = await amb.entrar()
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Estado-Maior' })
    pessoal = amb.com((await amb.criarUtilizador('pessoal_quadros')).token)
    escola = amb.com((await amb.criarUtilizador('secretaria')).token)
    turma = (await escola.post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM A' })).body
  })
  after(() => amb.fechar())

  it('cada repartição só faz o que lhe cabe', async () => {
    // a Administração Escolar não regista pessoas
    assert.equal((await escola.post('/api/admin/academico/contas').send({ tipo: 'estudante', nome: 'Estudante Novo Teste', email: 'novo@esgfaa.gov.ao' })).status, 403)
    assert.equal((await escola.post('/api/admin/academico/contas/importar').send({ linhas: [{ nome: 'Fulano de Tal', email: 'f@esgfaa.gov.ao' }] })).status, 403)
    // o Pessoal e Quadros regista estudantes e docentes
    const e = await pessoal.post('/api/admin/academico/contas').send({ tipo: 'estudante', nome: 'Cap. Carlos Mendes', email: 'carlos@esgfaa.gov.ao', dados: { posto: 'Capitão', nip: '12345' } })
    assert.equal(e.status, 201, e.body.erro)
    const d = await pessoal.post('/api/admin/academico/contas').send({ tipo: 'docente', nome: 'Cor. Docente Teste', email: 'docente@esgfaa.gov.ao' })
    assert.equal(d.status, 201, d.body.erro)
    assert.equal((await pessoal.put(`/api/admin/academico/contas/${e.body.id}`).send({ dados: { posto: 'Major', nip: '12345' } })).body.dados.posto, 'Major')
    // a palavra-passe inicial é aleatória e vem só na resposta (para a ficha de acesso); o e-mail não serve
    assert.match(e.body.senhaInicial, /^[A-Z][a-z]\d[a-z]-[A-Z][a-z]\d[a-z]-[A-Z][a-z]\d[a-z]$/i)
    const reposta = await pessoal.post(`/api/admin/academico/contas/${e.body.id}/repor-senha`)
    assert.equal(reposta.status, 200)
    assert.notEqual(reposta.body.senhaInicial, e.body.senhaInicial)
    assert.equal((await amb.http().post('/api/portal/entrar').send({ email: 'carlos@esgfaa.gov.ao', senha: e.body.senhaInicial })).status, 401)
    assert.equal((await amb.http().post('/api/portal/entrar').send({ email: 'carlos@esgfaa.gov.ao', senha: 'carlos@esgfaa.gov.ao' })).status, 401)
    assert.equal((await amb.http().post('/api/portal/entrar').send({ email: 'carlos@esgfaa.gov.ao', senha: reposta.body.senhaInicial })).status, 200)
    // mas não trata da vida académica
    assert.equal((await pessoal.post(`/api/admin/academico/turmas/${turma.id}/matriculas`).send({ estudanteId: e.body.id })).status, 403)
    assert.equal((await pessoal.post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'X' })).status, 403)
    // a Administração Escolar vê o registo e escolhe quem matricular
    const lista = (await escola.get('/api/admin/academico/contas?tipo=estudante&q=carlos')).body
    assert.deepEqual(lista.map((c) => c.email), ['carlos@esgfaa.gov.ao'])
    assert.equal((await escola.post(`/api/admin/academico/turmas/${turma.id}/matriculas`).send({ estudanteId: e.body.id })).status, 201)
    // não se matricula um docente como estudante
    assert.equal((await escola.post(`/api/admin/academico/turmas/${turma.id}/matricular`).send({ estudanteIds: [d.body.id] })).status, 400)
    // a rota antiga que registava e matriculava de uma vez já não existe
    assert.equal((await escola.post(`/api/admin/academico/turmas/${turma.id}/matricula-nova`).send({ nome: 'X Y Z W', email: 'x@esgfaa.gov.ao' })).status, 404)
  })

  it('registo de várias pessoas por folha (Pessoal e Quadros)', async () => {
    const linhas = [
      { nome: 'Ten. Rui Tavares', email: 'rui.tavares@esgfaa.gov.ao', posto: 'Tenente' },
      { nome: 'Cap. Carlos Mendes', email: 'CARLOS@esgfaa.gov.ao' }, // já registado
      { nome: 'Fora da Escola', email: 'alguem@gmail.com' },
      { nome: 'Ten. Rui Repetido', email: 'rui.tavares@esgfaa.gov.ao' },
      { nome: 'Cor. Docente Teste', email: 'docente@esgfaa.gov.ao' }, // registado como docente
    ]
    const sim = (await pessoal.post('/api/admin/academico/contas/importar').send({ tipo: 'estudante', linhas })).body
    assert.deepEqual(sim.linhas.map((l) => l.acao), ['registar', 'ja_registado', 'erro', 'erro', 'erro'])
    assert.match(sim.linhas[4].erro, /docente/)
    const r = (await pessoal.post('/api/admin/academico/contas/importar').send({ tipo: 'estudante', linhas, simular: false })).body
    assert.deepEqual(r.resumo, { registar: 1, ja_registado: 1, erro: 3 })
    assert.match(r.linhas[0].numero, /^E\d{4}-/)
    assert.equal(r.linhas[0].senhaInicial, amb.senhaInicial('rui.tavares@esgfaa.gov.ao'))
    assert.equal(r.linhas[1].senhaInicial, undefined)
    assert.equal((await amb.http().post('/api/portal/entrar').send({ email: 'rui.tavares@esgfaa.gov.ao', senha: amb.senhaInicial('rui.tavares@esgfaa.gov.ao') })).status, 200)
  })

  it('conta antiga com o e-mail como palavra-passe: não entra; só com a ficha de acesso nova', async () => {
    const antiga = await amb.contentor.repositorios.contasPortal.porEmail('docente@esgfaa.gov.ao')
    antiga.mudarSenha(await amb.contentor.cifra.cifrar('docente@esgfaa.gov.ao'))
    antiga.deveMudarSenha = true
    await amb.contentor.repositorios.contasPortal.guardar(antiga)
    const r = await amb.http().post('/api/portal/entrar').send({ email: 'docente@esgfaa.gov.ao', senha: 'docente@esgfaa.gov.ao' })
    assert.equal(r.status, 401)
    assert.match(r.body.erro, /ficha de acesso/)
  })

  it('matrícula por folha (Administração Escolar): só quem já está registado, pelo e-mail ou pelo número', async () => {
    const rui = (await escola.get('/api/admin/academico/contas?q=rui.tavares')).body[0]
    const linhas = [
      { numero: rui.numero },
      { email: 'carlos@esgfaa.gov.ao' }, // já matriculado
      { nome: 'Ninguém', email: 'nao.registado@esgfaa.gov.ao' },
      { nome: 'Sem dados' },
    ]
    const sim = (await escola.post(`/api/admin/academico/turmas/${turma.id}/importar`).send({ linhas })).body
    assert.deepEqual(sim.linhas.map((l) => l.acao), ['matricular', 'ja_matriculado', 'erro', 'erro'])
    assert.match(sim.linhas[2].erro, /Pessoal e Quadros/)
    assert.equal(sim.linhas[0].nome, 'Ten. Rui Tavares')
    const r = (await escola.post(`/api/admin/academico/turmas/${turma.id}/importar`).send({ linhas, simular: false })).body
    assert.deepEqual(r.resumo, { matricular: 1, ja_matriculado: 1, erro: 2 })
    // nenhuma conta nova foi criada
    assert.equal((await escola.get('/api/admin/academico/contas?q=nao.registado')).body.length, 0)
    const t = (await escola.get(`/api/admin/academico/turmas/${turma.id}`)).body
    assert.deepEqual(t.matriculas.map((m) => m.estudante.email).sort(), ['carlos@esgfaa.gov.ao', 'rui.tavares@esgfaa.gov.ao'])
  })
})
