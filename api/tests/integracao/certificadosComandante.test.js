import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, relogioFalso } from '../apoio/ambiente.js'

/*
  O diploma e o certificado de conclusão do curso: a Administração Escolar envia ao Comandante e só ficam
  disponíveis (para imprimir, no percurso do estudante e na verificação pública) quando ele aprovar.
*/
describe('Diplomas e certificados: só ficam disponíveis com a aprovação do Comandante', () => {
  let amb, rae, comandante, turma, ana
  const url = () => `/api/admin/academico/turmas/${turma.id}/certificados/${ana.id}`
  const pendente = async () => (await comandante.get('/api/admin/publicacoes').expect(200)).body.find((x) => x.colecao === 'certificados_curso')

  before(async () => {
    amb = await criarAmbiente({ relogio: relogioFalso('2026-11-09T09:00:00Z'), env: { APROVACAO_COMANDANTE: 'sim' } })
    await amb.com(await amb.entrar()).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Estado-Maior' })
    const tudo = amb.com((await amb.criarUtilizador('administrador')).token)
    rae = amb.com((await amb.criarUtilizador('secretaria')).token)
    comandante = amb.com((await amb.criarUtilizador('comandante')).token)
    turma = (await tudo.post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM Final', anoCurricular: 1 })).body
    await tudo.put(`/api/admin/academico/turmas/${turma.id}`).send({ anoFinal: true })
    ana = (await amb.registarEMatricular(tudo, turma.id, { nome: 'Estudante Ana Diploma', email: 'ana.diploma@esgfaa.gov.ao' })).body
    const cad = (await tudo.post(`/api/admin/academico/turmas/${turma.id}/cadeiras`).send({ codigo: 'EST201', nome: 'Estratégia', horas: 60 })).body
    await tudo.put(`/api/admin/academico/cadeiras/${cad.id}/pauta`).send({ linhas: [{ estudanteId: ana.id, p1: 15, p2: 15 }] })
    await tudo.put(`/api/admin/academico/turmas/${turma.id}/tfc/${ana.id}`).send({ tema: 'A defesa costeira', dataDefesa: '2026-11-05', nota: 16 }).expect(200)
  })
  after(() => amb.fechar())

  it('abrir a página não envia nada; enviar fica à espera do Comandante, sem o percurso para imprimir', async () => {
    const aberto = (await rae.post(url()).send({}).expect(201)).body
    assert.deepEqual([aberto.estado, aberto.percurso], ['por pedir', null])
    assert.equal(await pendente(), undefined)
    const enviado = (await rae.post(url()).send({ pedir: true }).expect(201)).body
    assert.deepEqual([enviado.estado, enviado.percurso], ['pendente', null])
    // ainda não existe para fora: nem na verificação pública, nem no percurso do estudante
    assert.equal((await amb.http().get(`/api/publico/certificados/${enviado.codigo}`)).status, 404)
    assert.equal((await rae.get(`/api/admin/academico/estudantes/${ana.id}/historico`)).body.certificado ?? null, null)
    const item = await pendente()
    assert.match(item.titulo, /CEM Final.*1 estudante/)
    assert.match(item.resumo, /Estudante Ana Diploma/)
    // a Administração Escolar não decide
    assert.equal((await rae.post(`/api/admin/publicacoes/certificados_curso/${turma.id}/decisao`).send({ decisao: 'aprovar' })).status, 403)
  })

  it('o Comandante recusa (com o motivo); a Administração Escolar corrige e envia de novo; ele aprova', async () => {
    assert.equal((await comandante.post(`/api/admin/publicacoes/certificados_curso/${turma.id}/decisao`).send({ decisao: 'recusar' })).status, 400)
    await comandante.post(`/api/admin/publicacoes/certificados_curso/${turma.id}/decisao`).send({ decisao: 'recusar', motivo: 'Confirmar a data do fim do curso' }).expect(200)
    const recusado = (await rae.post(url()).send({}).expect(201)).body
    assert.deepEqual([recusado.estado, recusado.aprovacao.motivo], ['recusado', 'Confirmar a data do fim do curso'])
    assert.equal(await pendente(), undefined)
    assert.equal((await rae.post(url()).send({ pedir: true }).expect(201)).body.estado, 'pendente')
    await comandante.post(`/api/admin/publicacoes/certificados_curso/${turma.id}/decisao`).send({ decisao: 'aprovar' }).expect(200)
    const aprovado = (await rae.post(url()).send({}).expect(201)).body
    assert.equal(aprovado.estado, 'aprovado')
    assert.ok(aprovado.percurso, 'o aprovado leva o percurso para gerar o PDF')
    assert.equal((await amb.http().get(`/api/publico/certificados/${aprovado.codigo}`).expect(200)).body.estudante, 'Estudante Ana Diploma')
    assert.equal(await pendente(), undefined)
  })
})
