import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, relogioFalso } from '../apoio/ambiente.js'

const NOVA = 'Portal2026segura'

describe('Administração Escolar: inscrições, TFC, conclusão do curso, histórico e documentos', () => {
  let amb, sec, ano1, ano2, cad1, cad2, cad3
  const contas = {}
  const tokens = {}
  const portal = (quem) => amb.com(tokens[quem])

  before(async () => {
    amb = await criarAmbiente({ relogio: relogioFalso('2026-11-09T09:00:00Z') })
    const admin = await amb.entrar()
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Estado-Maior' })
    const s = await amb.criarUtilizador('secretaria')
    sec = () => amb.com(s.token)
    ano1 = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2025/2026', nome: 'CEM 1', anoCurricular: 1 })).body
    ano2 = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM 2', anoCurricular: 2 })).body
    contas.prof = (await sec().post('/api/admin/academico/contas').send({ tipo: 'docente', nome: 'Docente Prof Teste', email: 'prof@esgfaa.gov.ao' })).body
    // a Ana fez o 1.º ano e está no 2.º; o Bruno está só no 2.º
    contas.ana = (await sec().post(`/api/admin/academico/turmas/${ano1.id}/matricula-nova`).send({ nome: 'Estudante ana Teste', email: 'ana@esgfaa.gov.ao' })).body
    await sec().put(`/api/admin/academico/matriculas/${(await sec().get(`/api/admin/academico/turmas/${ano1.id}`)).body.matriculas[0].id}`).send({ estado: 'concluida' })
    await sec().post(`/api/admin/academico/turmas/${ano2.id}/matriculas`).send({ estudanteId: contas.ana.id })
    contas.bruno = (await sec().post(`/api/admin/academico/turmas/${ano2.id}/matricula-nova`).send({ nome: 'Estudante bruno Teste', email: 'bruno@esgfaa.gov.ao' })).body
    cad1 = (await sec().post(`/api/admin/academico/turmas/${ano1.id}/cadeiras`).send({ codigo: 'HIS101', nome: 'História Militar', horas: 60 })).body
    cad2 = (await sec().post(`/api/admin/academico/turmas/${ano2.id}/cadeiras`).send({ codigo: 'EST201', nome: 'Estratégia', horas: 90 })).body
    cad3 = (await sec().post(`/api/admin/academico/turmas/${ano2.id}/cadeiras`).send({ codigo: 'LOG202', nome: 'Logística', horas: 60 })).body
    for (const c of [cad1, cad2, cad3]) await sec().put(`/api/admin/academico/cadeiras/${c.id}/docentes`).send({ docentes: [{ docenteId: contas.prof.id, papel: 'regente' }] })
    for (const k of ['prof', 'ana', 'bruno']) {
      const email = `${k}@esgfaa.gov.ao`
      const r = await amb.http().post('/api/portal/entrar').send({ email, senha: email })
      tokens[k] = (await amb.com(r.body.token).put('/api/portal/eu/senha').send({ atual: email, nova: NOVA })).body.token
    }
  })
  after(() => amb.fechar())

  it('inscrição numa cadeira de outra turma: dá acesso, entra na pauta e nas presenças; anula-se', async () => {
    const insc = (corpo) => sec().post(`/api/admin/academico/cadeiras/${cad1.id}/inscricoes`).send(corpo)
    assert.equal((await portal('bruno').get(`/api/portal/cadeiras/${cad1.id}`)).status, 404)
    const r = await insc({ estudanteId: contas.bruno.id, motivo: 'equivalencia', observacao: 'Vem de outra escola' })
    assert.equal(r.status, 201, r.body.erro)
    assert.equal(r.body.inscricoes.length, 1)
    assert.equal((await insc({ estudanteId: contas.bruno.id })).status, 409)
    assert.equal((await insc({ estudanteId: contas.prof.id })).status, 400)
    assert.equal((await portal('bruno').get(`/api/portal/cadeiras/${cad1.id}`)).status, 200)
    assert.ok((await portal('bruno').get('/api/portal/cadeiras')).body.some((c) => c.id === cad1.id))
    const pauta = (await portal('prof').get(`/api/portal/cadeiras/${cad1.id}/pauta`)).body
    assert.ok(pauta.linhas.some((l) => l.estudante.id === contas.bruno.id))
    const aulas = (await portal('prof').get(`/api/portal/cadeiras/${cad1.id}/aulas`)).body
    assert.ok(aulas.estudantes.some((e) => e.id === contas.bruno.id && e.inscrito))
    // anular tira o acesso
    const anulada = (await sec().delete(`/api/admin/academico/inscricoes/${r.body.inscricoes[0].id}`)).body
    assert.equal(anulada.inscricoes[0].estado, 'anulada')
    assert.equal((await portal('bruno').get(`/api/portal/cadeiras/${cad1.id}`)).status, 404)
  })

  it('TFC, conclusão do curso, certificado final verificável e histórico', async () => {
    // notas: a Ana aprovada em tudo; o Bruno com uma reprovação
    const pauta = (cad, linhas) => sec().put(`/api/admin/academico/cadeiras/${cad.id}/pauta`).send({ linhas })
    await pauta(cad1, [{ estudanteId: contas.ana.id, p1: 15, p2: 17 }])
    await pauta(cad2, [{ estudanteId: contas.ana.id, p1: 12, p2: 12, exame: 14 }, { estudanteId: contas.bruno.id, p1: 6, p2: 8, exame: 5, recurso: 4 }])
    await pauta(cad3, [{ estudanteId: contas.ana.id, p1: 14, p2: 14 }, { estudanteId: contas.bruno.id, p1: 15, p2: 16 }])

    // TFC só numa turma de finalistas
    const tfc = (est, corpo) => sec().put(`/api/admin/academico/turmas/${ano2.id}/tfc/${est}`).send(corpo)
    assert.equal((await tfc(contas.ana.id, { tema: 'A defesa da fronteira norte' })).status, 409)
    await sec().put(`/api/admin/academico/turmas/${ano2.id}`).send({ anoFinal: true })
    assert.equal((await tfc(contas.ana.id, { tema: 'A defesa da fronteira norte', nota: 16 })).status, 400) // sem data de defesa
    const t = await tfc(contas.ana.id, { tema: 'A defesa da fronteira norte', orientador: 'Cor. Orientador', juri: 'Gen. A; Cor. B', dataDefesa: '2026-11-05', nota: '16' })
    assert.equal(t.status, 200, t.body.erro)
    await tfc(contas.bruno.id, { tema: 'Logística em operações conjuntas', dataDefesa: '2026-11-05', nota: 12 })

    const f = (await sec().get(`/api/admin/academico/turmas/${ano2.id}/finalistas`)).body
    const ana = f.linhas.find((l) => l.estudante.id === contas.ana.id)
    const bruno = f.linhas.find((l) => l.estudante.id === contas.bruno.id)
    // Ana: HIS101 16, EST201 round(0.4*12+0.6*14)=13, LOG202 14, TFC 16 -> (16+13+14+16)/4 = 14.75 -> 14.8
    assert.deepEqual([ana.conclusao.concluido, ana.conclusao.mediaFinal, ana.conclusao.classificacaoFinal], [true, 14.8, 'Bom'])
    assert.equal(bruno.conclusao.concluido, false)
    assert.match(bruno.conclusao.emFalta[0], /EST201/)

    // certificado do curso: só com o curso concluído; é verificável publicamente
    assert.equal((await sec().post(`/api/admin/academico/turmas/${ano2.id}/certificados/${contas.bruno.id}`)).status, 409)
    const c = await sec().post(`/api/admin/academico/turmas/${ano2.id}/certificados/${contas.ana.id}`)
    assert.equal(c.status, 201, c.body.erro)
    assert.deepEqual([c.body.curso, c.body.media, c.body.notaTfc], ['Curso de Estado-Maior', 14.8, 16])
    assert.equal((await sec().post(`/api/admin/academico/turmas/${ano2.id}/certificados/${contas.ana.id}`)).body.codigo, c.body.codigo)
    const pub = (await amb.http().get(`/api/publico/certificados/${c.body.codigo}`)).body
    assert.deepEqual([pub.tipo, pub.estudante, pub.media], ['curso', 'Estudante ana Teste', 14.8])

    // histórico com os dois anos e o TFC; o estudante vê o percurso com a conclusão
    const h = (await sec().get(`/api/admin/academico/estudantes/${contas.ana.id}/historico`)).body
    assert.deepEqual(h.anos.map((a) => [a.turma.nome, a.disciplinas.map((d) => [d.cadeira.codigo, d.final])]), [['CEM 1', [['HIS101', 16]]], ['CEM 2', [['EST201', 13], ['LOG202', 14]]]])
    assert.deepEqual([h.tfc.tema, h.conclusao.mediaFinal, h.cursos], ['A defesa da fronteira norte', 14.8, ['Curso de Estado-Maior']])
    assert.equal((await sec().get(`/api/admin/academico/estudantes/${contas.prof.id}/historico`)).status, 404)
    const percurso = (await portal('ana').get('/api/portal/percurso')).body
    assert.equal(percurso.tfc.nota, 16)
    assert.equal(percurso.certificado.codigo, c.body.codigo)
  })

  it('documentos: pauta da turma, folha de presenças e lista para a prova', async () => {
    const g = (await sec().get(`/api/admin/academico/turmas/${ano2.id}/pauta-geral`)).body
    assert.deepEqual(g.cadeiras.map((c) => c.codigo), ['EST201', 'LOG202'])
    const ana = g.linhas.find((l) => l.estudante.id === contas.ana.id)
    assert.deepEqual([ana.notas[cad2.id].final, ana.media, ana.situacaoAno], [13, 13.5, 'transita'])
    assert.equal(g.linhas.find((l) => l.estudante.id === contas.bruno.id).situacaoAno, 'com_cadeiras_em_atraso')

    await portal('prof').post(`/api/portal/cadeiras/${cad2.id}/aulas`).send({ data: '2026-11-02', sumario: 'Aula 1', presencas: [{ estudanteId: contas.ana.id, estado: 'presente' }, { estudanteId: contas.bruno.id, estado: 'falta' }] })
    const folha = (await sec().get(`/api/admin/academico/cadeiras/${cad2.id}/folha-presencas`)).body
    assert.deepEqual([folha.cadeira.codigo, folha.turma.curso, folha.estudantes.length, folha.aulas.length], ['EST201', 'Curso de Estado-Maior', 2, 1])

    await portal('prof').post(`/api/portal/cadeiras/${cad2.id}/eventos`).send({ tipo: 'exame', data: '2026-12-01', inicio: '09:00', local: 'Anfiteatro A' })
    const lista = (await sec().get(`/api/admin/academico/cadeiras/${cad2.id}/lista-prova`)).body
    assert.deepEqual(lista.estudantes.map((e) => e.nome), ['Estudante ana Teste', 'Estudante bruno Teste'])
    assert.deepEqual(lista.provas.map((p) => [p.tipo, p.local]), [['exame', 'Anfiteatro A']])
  })
})
