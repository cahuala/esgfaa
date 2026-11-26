import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { criarAmbiente } from '../apoio/ambiente.js'

const CHAVE = 'chave-partilhada-com-o-pessoal-de-32-caracteres-ou-mais'

/*
  Estrutura do ensino: cada cadeira pertence a um departamento; quem trabalha num departamento (a conta vem do
  Pessoal, com o departamento da unidade) vê o seu; a Administração Escolar vê tudo e põe as cadeiras no departamento.
*/
describe('Estrutura do ensino: cursos, departamentos e cadeiras', () => {
  let amb, ensino, cadeira, turma
  const BI = '002222222LA022'
  const enviar = (contas) => {
    const corpo = JSON.stringify({ contas })
    const data = String(Math.floor(Date.now() / 1000))
    const assinatura = crypto.createHmac('sha256', CHAVE).update(`${data}.${corpo}`).digest('hex')
    return amb.http().post('/api/integracao/pessoal/contas-ensino').set('Content-Type', 'application/json').set('X-Pessoal-Data', data).set('X-Pessoal-Assinatura', assinatura).send(corpo)
  }
  before(async () => {
    amb = await criarAmbiente({ env: { INTEGRACAO_CHAVE: CHAVE } })
    const admin = await amb.entrar()
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Estratégia e Arte Operativa' })
    ensino = amb.com((await amb.criarUtilizador('administrador')).token)
    turma = (await ensino.post('/api/admin/academico/turmas').send({ curso: 'curso-de-estrategia-e-arte-operativa', anoLetivo: '2026/2027', nome: '18.º CEAO' }).expect(201)).body
    cadeira = (await ensino.post(`/api/admin/academico/turmas/${turma.id}/cadeiras`).send({ codigo: 'EST101', nome: 'Estratégia Militar', departamento: 'Departamento de Estratégia' }).expect(201)).body
    await ensino.post(`/api/admin/academico/turmas/${turma.id}/cadeiras`).send({ codigo: 'LIN101', nome: 'Língua Inglesa' }).expect(201)
  })
  after(() => amb.fechar())

  it('a Administração Escolar vê os cursos, os departamentos e as cadeiras sem departamento, e muda-as', async () => {
    const q = `/api/admin/academico/estrutura?anoLetivo=${encodeURIComponent('2026/2027')}`
    let d = (await ensino.get(q).expect(200)).body
    assert.equal(d.departamentos.find((x) => x.nome === 'Departamento de Estratégia').cadeiras.map((c) => c.codigo).join(), 'EST101')
    assert.deepEqual(d.semDepartamento.map((c) => c.codigo), ['LIN101'])
    assert.equal(d.cursos[0].turmas[0].nome, '18.º CEAO')
    await ensino.put(`/api/admin/academico/cadeiras/${d.semDepartamento[0].id}/departamento`).send({ departamento: 'Departamento de Ensino de Línguas' }).expect(200)
    d = (await ensino.get(q).expect(200)).body
    assert.equal(d.semDepartamento.length, 0)
    // editar a cadeira não lhe tira o departamento
    await ensino.put(`/api/admin/academico/cadeiras/${cadeira.id}`).send({ nome: 'Estratégia Militar Geral' }).expect(200)
    assert.equal((await ensino.get(`/api/admin/academico/cadeiras/${cadeira.id}`).expect(200)).body.departamento, 'Departamento de Estratégia')
  })

  it('a conta do chefe do departamento vem do Pessoal com o departamento e vê só o seu', async () => {
    const imp = crypto.createHmac('sha256', CHAVE).update(`bi:${BI}`).digest('hex')
    await enviar([{ ref: 'pessoal-77', nome: 'Chefe Departamento Teste', bi: imp, papel: 'area_cientifica', departamento: 'Departamento de Estratégia', cargo: 'Chefe do Departamento de Estratégia', senha: await amb.contentor.cifra.cifrar(BI) }]).expect(200)
    const e = await amb.http().post('/api/admin/entrar').send({ email: BI, senha: BI })
    assert.equal(e.status, 200, e.body.erro)
    const chefe = amb.com(e.body.token)
    const d = (await chefe.get(`/api/admin/academico/estrutura?anoLetivo=${encodeURIComponent('2026/2027')}`).expect(200)).body
    assert.equal(d.meuDepartamento, 'Departamento de Estratégia')
    assert.deepEqual(d.departamentos.map((x) => x.nome), ['Departamento de Estratégia'])
    assert.deepEqual(d.departamentos[0].pessoas.map((p) => [p.nome, p.cargo]), [['Chefe Departamento Teste', 'Chefe do Departamento de Estratégia']])
    assert.equal(d.semDepartamento.length, 0)
    // não muda os departamentos (é da Administração Escolar)
    assert.equal((await chefe.put(`/api/admin/academico/cadeiras/${cadeira.id}/departamento`).send({ departamento: '' })).status, 403)
  })
})
