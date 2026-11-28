import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, relogioFalso } from '../apoio/ambiente.js'

/*
  O diploma e o certificado de conclusão do curso: da primeira vez imprimem-se logo, sem pedido ao Comandante (a
  classificação final já foi homologada por ele); ficam no percurso do estudante e na verificação pública.
*/
describe('Diplomas e certificados: a primeira emissão imprime-se logo', () => {
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

  it('a primeira emissão é directa: imprime-se logo, sem esperar pelo Comandante (a classificação já foi homologada)', async () => {
    const emitido = (await rae.post(url()).send({}).expect(201)).body
    assert.equal(emitido.estado, 'aprovado')
    assert.ok(emitido.percurso, 'leva o percurso para gerar o PDF')
    assert.equal((await amb.http().get(`/api/publico/certificados/${emitido.codigo}`).expect(200)).body.estudante, 'Estudante Ana Diploma')
    assert.equal(await pendente(), undefined)
    // voltar a abrir não emite outro (o mesmo código)
    assert.equal((await rae.post(url()).send({}).expect(201)).body.codigo, emitido.codigo)
  })

  it('vários de uma vez: saem todos logo; quem não concluiu fica de fora', async () => {
    const tudo = amb.com((await amb.criarUtilizador('administrador')).token)
    const t = (await tudo.post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2025/2026', nome: 'CEM Anterior', anoCurricular: 1 })).body
    await tudo.put(`/api/admin/academico/turmas/${t.id}`).send({ anoFinal: true })
    const cad = (await tudo.post(`/api/admin/academico/turmas/${t.id}/cadeiras`).send({ codigo: 'HIS', nome: 'História Militar', horas: 30 })).body
    const est = []
    for (const [n, nota] of [['Um', 14], ['Dois', 16], ['Tres', 5]]) {
      const e = (await amb.registarEMatricular(tudo, t.id, { nome: `Discente ${n} Lote`, email: `lote.${n.toLowerCase()}@esgfaa.gov.ao` })).body
      await tudo.put(`/api/admin/academico/cadeiras/${cad.id}/pauta`).send({ linhas: [{ estudanteId: e.id, p1: nota, p2: nota, ...(nota < 10 ? { exame: 4, recurso: 4 } : {}) }] })
      await tudo.put(`/api/admin/academico/turmas/${t.id}/tfc/${e.id}`).send({ tema: `Tema ${n}`, dataDefesa: '2026-07-05', nota: 15 }).expect(200)
      est.push(e)
    }
    const lista = (await rae.get(`/api/admin/academico/turmas/${t.id}/certificados`).expect(200)).body
    assert.equal(lista.direto, true)
    assert.deepEqual(lista.estudantes.map((x) => x.estado).sort(), ['nao concluido', 'por pedir', 'por pedir'])
    // consultar não cria nada
    await comandante.get(`/api/admin/academico/turmas/${t.id}/certificados`).expect(200)
    assert.equal(await amb.contentor.prisma.certificadoCurso.count({ where: { turmaId: t.id } }), 0)
    const r = (await rae.post(`/api/admin/academico/turmas/${t.id}/certificados`).send({ estudanteIds: est.map((e) => e.id) }).expect(200)).body
    assert.equal(r.enviados, 2)
    assert.equal(r.erros.length, 1)
    assert.match(r.erros[0], /Discente Tres Lote/)
    // nada fica à espera do Comandante: os dois saem logo prontos a imprimir
    assert.equal((await comandante.get('/api/admin/publicacoes').expect(200)).body.filter((x) => x.colecao === 'certificados_curso' && x.id === String(t.id)).length, 0)
    const aprovados = r.estudantes.filter((x) => x.estado === 'aprovado')
    assert.equal(aprovados.length, 2)
    assert.ok(aprovados.every((x) => x.percurso), 'levam o percurso para o PDF')
  })
})
