import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, relogioFalso } from '../apoio/ambiente.js'

const FACTORES = ['culturaMilitar', 'culturaCientifica', 'autoconfianca', 'adaptabilidade', 'iniciativa', 'comunicacao', 'senso', 'decisao', 'planeamento', 'analise', 'trabalhoGrupo']
const juizo = (v) => ({ factores: Object.fromEntries(FACTORES.map((k) => [k, v])), texto: 'Revelou empenho constante.' })

describe('Conselho de Curso: juízo ampliativo, proposta, confirmação, homologação, Distinto e ajuste', () => {
  let amb, escola, director, comandante, turma, uc, contas
  before(async () => {
    amb = await criarAmbiente({ relogio: relogioFalso('2026-11-10T09:00:00Z') })
    const admin = await amb.entrar()
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Teste' })
    const tudo = amb.com((await amb.criarUtilizador('administrador')).token)
    escola = amb.com((await amb.criarUtilizador('secretaria')).token)
    director = amb.com((await amb.criarUtilizador('director_ensino')).token)
    comandante = amb.com((await amb.criarUtilizador('comandante')).token)
    turma = (await tudo.post('/api/admin/academico/turmas').send({ curso: 'curso-de-teste', anoLetivo: '2026/2027', nome: 'Teste A' })).body
    contas = {}
    for (const k of ['ana', 'bruno', 'carla']) contas[k] = (await amb.registarEMatricular(tudo, turma.id, { nome: `Discente ${k} Teste`, email: `${k}@esgfaa.gov.ao` })).body
    // plano de média simples com ajuste de ±0,25 (como o COAMP), uma UC
    assert.equal((await escola.post('/api/admin/academico/planos-curso').send({ curso: 'curso-de-teste', anoLetivo: '2026/2027', nome: 'Plano de teste', formula: 'media', ajusteMaximo: 0.25, blocos: [] })).status, 201)
    uc = (await escola.post(`/api/admin/academico/turmas/${turma.id}/cadeiras`).send({ codigo: 'UC1', nome: 'Unidade de teste', horasContacto: 30, horasNaoContacto: 15, creditos: 3 })).body
    const p = (await escola.post(`/api/admin/academico/cadeiras/${uc.id}/provas`).send({ tipo: 'TAI', forma: 'teste', titulo: 'Teste 1' })).body
    const tai = p.avaliacoes[0]
    await escola.put(`/api/admin/academico/cadeiras/${uc.id}/provas/${tai.id}/notas`).send({ linhas: [{ estudanteId: contas.ana.id, nota: 17 }, { estudanteId: contas.bruno.id, nota: 17 }, { estudanteId: contas.carla.id, nota: 13 }] })
    await escola.put(`/api/admin/academico/cadeiras/${uc.id}/provas/${tai.id}/publicacao`).send({ publicar: true })
    uc.tai = tai
  })
  after(() => amb.fechar())

  it('o Director de Ensino faz o juízo ampliativo (11 factores) e só depois propõe', async () => {
    assert.equal((await escola.put(`/api/admin/academico/turmas/${turma.id}/conselho/juizo/${contas.ana.id}`).send(juizo('Bom'))).status, 403) // a secretaria não
    assert.equal((await director.put(`/api/admin/academico/turmas/${turma.id}/conselho/juizo/${contas.ana.id}`).send({ factores: { decisao: 'Excelente' } })).status, 400)
    await director.put(`/api/admin/academico/turmas/${turma.id}/conselho/juizo/${contas.ana.id}`).send(juizo('Muito Bom')).expect(200)
    const r = await director.post(`/api/admin/academico/turmas/${turma.id}/conselho/propor`)
    assert.equal(r.status, 400)
    assert.match(r.body.erro, /juízo ampliativo/)
    for (const k of ['bruno', 'carla']) await director.put(`/api/admin/academico/turmas/${turma.id}/conselho/juizo/${contas[k].id}`).send(juizo('Bom')).expect(200)
    const e = (await director.post(`/api/admin/academico/turmas/${turma.id}/conselho/propor`).expect(200)).body
    assert.equal(e.conselho.estado, 'proposta')
    assert.deepEqual(e.linhas.map((l) => [l.final, l.mencao]), [[17, 'Bom'], [17, 'Bom'], [13, 'Regular']])
    // as notas ficam fechadas
    const n = await escola.put(`/api/admin/academico/cadeiras/${uc.id}/provas/${uc.tai.id}/notas`).send({ linhas: [{ estudanteId: contas.carla.id, nota: 20 }] })
    assert.equal(n.status, 409)
  })

  it('Conselho de Curso confirma (acta e data); o Comandante ajusta e homologa com o Distinto', async () => {
    assert.equal((await director.post(`/api/admin/academico/turmas/${turma.id}/conselho/confirmar`).send({ acta: '', dataConselho: '2026-12-01' })).status, 400)
    await director.post(`/api/admin/academico/turmas/${turma.id}/conselho/confirmar`).send({ acta: '12/2026', dataConselho: '2026-12-01' }).expect(200)
    assert.equal((await director.put(`/api/admin/academico/turmas/${turma.id}/conselho/ajuste/${contas.carla.id}`).send({ ajuste: 0.25 })).status, 403) // só o Comandante
    assert.equal((await comandante.put(`/api/admin/academico/turmas/${turma.id}/conselho/ajuste/${contas.carla.id}`).send({ ajuste: 0.5 })).status, 400) // máximo 0,25
    await comandante.put(`/api/admin/academico/turmas/${turma.id}/conselho/ajuste/${contas.carla.id}`).send({ ajuste: 0.25 }).expect(200)
    // o Distinto só para a melhor nota (Ana e Bruno empatados: um só)
    assert.equal((await comandante.post(`/api/admin/academico/turmas/${turma.id}/conselho/homologar`).send({ distinto: [contas.carla.id] })).status, 400)
    assert.equal((await comandante.post(`/api/admin/academico/turmas/${turma.id}/conselho/homologar`).send({ distinto: [contas.ana.id, contas.bruno.id] })).status, 400)
    assert.equal((await director.post(`/api/admin/academico/turmas/${turma.id}/conselho/homologar`).send({ distinto: [contas.ana.id] })).status, 403)
    const e = (await comandante.post(`/api/admin/academico/turmas/${turma.id}/conselho/homologar`).send({ distinto: [contas.ana.id] }).expect(200)).body
    assert.equal(e.conselho.estado, 'homologada')
    const carla = e.linhas.find((l) => l.estudanteId === contas.carla.id)
    assert.deepEqual([carla.final, carla.ajuste, carla.homologado], [13.25, 0.25, true])
    assert.equal(e.linhas.find((l) => l.estudanteId === contas.ana.id).distinto, true)
  })

  it('depois da homologação: o certificado sai com a nota homologada; reabrir só pelo Comandante', async () => {
    const c = await escola.post(`/api/admin/academico/turmas/${turma.id}/certificados/${contas.carla.id}`)
    assert.equal(c.status, 201, c.body.erro)
    assert.equal(Number(c.body.media), 13.25)
    assert.equal((await director.post(`/api/admin/academico/turmas/${turma.id}/conselho/reabrir`).send({ motivo: 'Correcção de nota' })).status, 403)
    const r = (await comandante.post(`/api/admin/academico/turmas/${turma.id}/conselho/reabrir`).send({ motivo: 'Correcção de nota lançada' }).expect(200)).body
    assert.equal(r.conselho.estado, 'aberto')
  })
})

describe('Conselho de Curso: sem homologação não há certificado', () => {
  let amb
  after(() => amb.fechar())
  it('turma com plano por homologar: o certificado é recusado', async () => {
    amb = await criarAmbiente({ relogio: relogioFalso('2026-11-10T09:00:00Z') })
    const admin = await amb.entrar()
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso B' })
    const tudo = amb.com((await amb.criarUtilizador('administrador')).token)
    const rt = await tudo.post('/api/admin/academico/turmas').send({ curso: 'curso-b', anoLetivo: '2026/2027', nome: 'Turma B' })
    assert.equal(rt.status, 201, JSON.stringify(rt.body))
    const t = rt.body
    const e = (await amb.registarEMatricular(tudo, t.id, { nome: 'Discente Um Teste', email: 'um@esgfaa.gov.ao' })).body
    await tudo.post('/api/admin/academico/planos-curso').send({ curso: 'curso-b', anoLetivo: '2026/2027', nome: 'Plano B', formula: 'media', blocos: [] }).expect(201)
    const uc = (await tudo.post(`/api/admin/academico/turmas/${t.id}/cadeiras`).send({ codigo: 'X1', nome: 'Unidade X' })).body
    const rp = await tudo.post(`/api/admin/academico/cadeiras/${uc.id}/provas`).send({ tipo: 'TAG', titulo: 'Grupo' })
    assert.equal(rp.status, 201, JSON.stringify(rp.body) + JSON.stringify(uc))
    const p = rp.body
    await tudo.put(`/api/admin/academico/cadeiras/${uc.id}/provas/${p.avaliacoes[0].id}/notas`).send({ linhas: [{ estudanteId: e.id, nota: 15 }] })
    const r = await tudo.post(`/api/admin/academico/turmas/${t.id}/certificados/${e.id}`)
    assert.equal(r.status, 409)
    assert.match(r.body.erro, /homologada/)
  })
})
