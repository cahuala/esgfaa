import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente } from '../apoio/ambiente.js'

// matriculado (Repartição) ou alocado e aprovado: a conta do portal fica pronta e sai a ficha de acesso, uma só vez
describe('Conta do portal na matrícula e na alocação', () => {
  let amb, sec, cmd, turma, outra, cadeira, aluno, prof
  before(async () => {
    amb = await criarAmbiente({ env: { APROVACAO_COMANDANTE: 'sim' } })
    const admin = await amb.entrar()
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Estado-Maior' })
    const adm = amb.com((await amb.criarUtilizador('administrador')).token)
    sec = amb.com((await amb.criarUtilizador('secretaria')).token)
    cmd = amb.com((await amb.oComandante()).token)
    turma = (await adm.post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM Conta' })).body
    outra = (await adm.post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM Outra Conta' })).body
    aluno = (await adm.post('/api/admin/academico/contas').send({ tipo: 'estudante', nome: 'Aluno Conta Teste', email: 'aluno.conta@esgfaa.gov.ao' })).body
    prof = (await adm.post('/api/admin/academico/contas').send({ tipo: 'docente', nome: 'Professor Conta Teste', email: 'prof.conta@esgfaa.gov.ao' })).body
    cadeira = (await adm.post(`/api/admin/academico/turmas/${turma.id}/cadeiras`).send({ codigo: 'EST1', nome: 'Estratégia' })).body
    // como as contas que chegam do Pessoal: a palavra-passe ninguém a sabe (ainda não se deu o acesso)
    for (const id of [aluno.id, prof.id]) {
      const c = await amb.contentor.prisma.contaPortal.findUnique({ where: { id } })
      const dados = { ...(c.dados ?? {}) }
      delete dados.acessoEntregueEm
      await amb.contentor.prisma.contaPortal.update({ where: { id }, data: { dados } })
    }
  })
  after(() => amb.fechar())

  it('matriculado: a ficha de acesso sai logo e entra-se no portal com ela; noutra matrícula já não sai outra', async () => {
    const m = await sec.post(`/api/admin/academico/turmas/${turma.id}/matriculas`).send({ estudanteId: aluno.id })
    assert.equal(m.status, 201, m.body.erro)
    assert.equal(m.body.fichas.length, 1)
    const { email, senhaInicial } = m.body.fichas[0]
    assert.equal((await amb.http().post('/api/portal/entrar').send({ email, senha: senhaInicial })).status, 200)
    const v = await sec.post(`/api/admin/academico/turmas/${outra.id}/matricular`).send({ estudanteIds: [aluno.id] })
    assert.deepEqual(v.body.fichas, [])
  })

  it('alocado pela Repartição fica proposto (sem conta); aprovado pelo Comandante, as fichas dos docentes saem na Alocação', async () => {
    const r = await sec.put(`/api/admin/academico/cadeiras/${cadeira.id}/docentes`).send({ docentes: [{ docenteId: prof.id, papel: 'regente', horas: 10 }] })
    assert.equal(r.status, 200, r.body.erro)
    assert.deepEqual(r.body.fichas, [])
    // o Comandante aloca (aprovado logo): a ficha vem com a resposta
    const a = await cmd.put(`/api/admin/academico/cadeiras/${cadeira.id}/docentes`).send({ docentes: [{ docenteId: prof.id, papel: 'regente', horas: 10 }] })
    assert.equal(a.status, 200, a.body.erro)
    const fichas = a.body.fichas.length ? a.body.fichas : (await sec.post('/api/admin/academico/alocacao/fichas-acesso').send({})).body.fichas
    assert.equal(fichas.length, 1)
    assert.equal((await amb.http().post('/api/portal/entrar').send({ email: fichas[0].email, senha: fichas[0].senhaInicial })).status, 200)
    // já entregue: não sai outra
    assert.deepEqual((await sec.post('/api/admin/academico/alocacao/fichas-acesso').send({})).body.fichas, [])
  })
})
