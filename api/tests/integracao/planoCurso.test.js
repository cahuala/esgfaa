import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, relogioFalso } from '../apoio/ambiente.js'

const NOVA = 'Portal2026segura'

describe('plano de curso da ESG: TAI/TAG, recuperação, blocos e nota final (32.º CSCD)', () => {
  let amb, relogio, escola, turma, ucs, contas
  const tokens = {}
  const portal = (quem) => amb.com(tokens[quem])

  before(async () => {
    relogio = relogioFalso('2026-11-10T09:00:00Z') // terça-feira
    amb = await criarAmbiente({ relogio })
    const admin = await amb.entrar()
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso Superior de Comando e Direcção' })
    const tudo = amb.com((await amb.criarUtilizador('administrador')).token)
    escola = amb.com((await amb.criarUtilizador('secretaria')).token)
    turma = (await tudo.post('/api/admin/academico/turmas').send({ curso: 'curso-superior-de-comando-e-direccao', anoLetivo: '2026/2027', nome: '32.º CSCD' })).body
    contas = {}
    for (const k of ['ana', 'bruno']) contas[k] = (await amb.registarEMatricular(tudo, turma.id, { nome: `Auditor ${k} Teste`, email: `${k}@esgfaa.gov.ao` })).body
    contas.prof = (await tudo.post('/api/admin/academico/contas').send({ tipo: 'docente', nome: 'Docente Prof Teste', email: 'prof@esgfaa.gov.ao' })).body
    for (const k of ['ana', 'bruno', 'prof']) {
      const email = `${k}@esgfaa.gov.ao`
      const r = await amb.http().post('/api/portal/entrar').send({ email, senha: email })
      tokens[k] = (await amb.com(r.body.token).put('/api/portal/eu/senha').send({ atual: email, nova: NOVA })).body.token
    }
  })
  after(() => amb.fechar())

  it('carrega o modelo do CSCD 2026/2027 na turma: o plano e as 20 UC com blocos, horas e créditos', async () => {
    const r = await escola.post(`/api/admin/academico/turmas/${turma.id}/plano-curso`).send({ modelo: 'cscd-2026' })
    assert.equal(r.status, 201, r.body.erro)
    assert.deepEqual([r.body.criadas, r.body.plano.blocos.map((b) => b.coeficiente)], [20, [2, 3, 1, 2, 2]])
    const d = (await escola.get(`/api/admin/academico/turmas/${turma.id}/plano-curso`)).body
    ucs = Object.fromEntries(d.ucs.map((u) => [u.codigo, u]))
    assert.deepEqual([ucs.CEO.bloco, ucs.CEO.creditos, ucs.CEO.horasContacto, ucs.TII.tii], ['ADM', 3, 33, true])
    assert.equal((await escola.post(`/api/admin/academico/turmas/${turma.id}/plano-curso`).send({ modelo: 'cscd-2026' })).body.criadas, 0) // não repete
    await escola.put(`/api/admin/academico/cadeiras/${ucs.CEO.id}/docentes`).send({ docentes: [{ docenteId: contas.prof.id, papel: 'regente' }] })
  })

  it('o docente cria TAI e TAG, lança e publica; o auditor vê só o publicado e pede a recuperação do TAI negativo', async () => {
    let p = (await portal('prof').post(`/api/portal/cadeiras/${ucs.CEO.id}/provas`).send({ tipo: 'TAI', forma: 'teste', titulo: 'Teste escrito 1' })).body
    assert.equal(p.modo, 'esg')
    p = (await portal('prof').post(`/api/portal/cadeiras/${ucs.CEO.id}/provas`).send({ tipo: 'TAG', titulo: 'Trabalho de grupo' })).body
    const [tai, tag] = p.avaliacoes
    const lancar = (prova, linhas) => portal('prof').put(`/api/portal/cadeiras/${ucs.CEO.id}/provas/${prova.id}/notas`).send({ linhas })
    assert.equal((await lancar(tai, [{ estudanteId: contas.ana.id, nota: 15, recuperacao: 12 }])).status, 400) // recuperação só com negativa
    await lancar(tai, [{ estudanteId: contas.ana.id, nota: 15.5 }, { estudanteId: contas.bruno.id, nota: 8 }])
    await lancar(tag, [{ estudanteId: contas.ana.id, nota: 14 }, { estudanteId: contas.bruno.id, nota: 17 }])
    // ainda nada publicado: o auditor não vê notas
    let v = (await portal('bruno').get('/api/portal/notas')).body.find((x) => x.cadeira.codigo === 'CEO')
    assert.deepEqual([v.modo, v.provas.length, v.final], ['esg', 0, null])
    await portal('prof').put(`/api/portal/cadeiras/${ucs.CEO.id}/provas/${tai.id}/publicacao`).send({ publicar: true })
    await portal('prof').put(`/api/portal/cadeiras/${ucs.CEO.id}/provas/${tag.id}/publicacao`).send({ publicar: true })
    v = (await portal('bruno').get('/api/portal/notas')).body.find((x) => x.cadeira.codigo === 'CEO')
    // média 12,5, mas o teste escrito negativo ainda pode ir a recuperação
    assert.deepEqual([v.final, v.situacao], [12.5, 'recuperacao'])
    assert.equal(v.provas[0].podePedirRecuperacao, true)
    assert.equal(v.provas[0].prazoRecuperacao, '2026-11-11T16:00:00.000Z') // 17h de quarta
    // a Ana (positiva) não pode; o Bruno pede, uma só vez
    assert.equal((await portal('ana').post(`/api/portal/cadeiras/${ucs.CEO.id}/provas/${tai.id}/recuperacao`)).status, 409)
    assert.equal((await portal('bruno').post(`/api/portal/cadeiras/${ucs.CEO.id}/provas/${tai.id}/recuperacao`)).status, 200)
    assert.equal((await portal('bruno').post(`/api/portal/cadeiras/${ucs.CEO.id}/provas/${tai.id}/recuperacao`)).status, 409)
    // o docente vê o pedido e lança a recuperação (16 conta 10)
    const pauta = (await portal('prof').get(`/api/portal/cadeiras/${ucs.CEO.id}/pauta`)).body
    assert.equal(pauta.avaliacoes[0].pedidos, 1)
    await lancar(tai, [{ estudanteId: contas.ana.id, nota: 15.5 }, { estudanteId: contas.bruno.id, nota: 8, recuperacao: 16 }])
    v = (await portal('bruno').get('/api/portal/notas')).body.find((x) => x.cadeira.codigo === 'CEO')
    assert.deepEqual([v.final, v.situacao, v.mencao], [13.5, 'aprovado', 'Regular'])
    const ana = (await portal('ana').get('/api/portal/notas')).body.find((x) => x.cadeira.codigo === 'CEO')
    assert.deepEqual([ana.final, ana.mencao], [14.75, 'Bom'])
  })

  it('revisão da prova: o auditor reclama uma vez; o Director de Ensino decide e a nota pode baixar', async () => {
    const director = amb.com((await amb.criarUtilizador('director_ensino')).token)
    const p = (await portal('prof').get(`/api/portal/cadeiras/${ucs.CEO.id}/pauta`)).body
    const tag = p.avaliacoes.find((a) => a.tipo === 'TAG')
    const pedir = (quem, motivo) => portal(quem).post(`/api/portal/cadeiras/${ucs.CEO.id}/provas/${tag.id}/revisao`).send({ motivo })
    assert.equal((await pedir('ana', 'curto')).status, 400) // a fundamentação tem de ter pelo menos 10 letras
    const v = (await pedir('ana', 'Discordo da classificação da apresentação oral do grupo.').expect(200)).body
    assert.ok(v.provas.find((x) => x.id === tag.id).revisao.pedidaEm)
    assert.equal((await pedir('ana', 'Outra vez o mesmo pedido de revisão.')).status, 409) // uma só vez por prova
    // a secretaria vê; só o Director de Ensino decide
    const lista = (await escola.get(`/api/admin/academico/turmas/${turma.id}/revisoes`).expect(200)).body
    assert.deepEqual(lista.map((x) => [x.estudante.id, x.cadeira.codigo, x.nota, x.revisao.motivo.slice(0, 8)]), [[contas.ana.id, 'CEO', 14, 'Discordo']])
    const decidir = (quem, nota) => quem.put(`/api/admin/academico/turmas/${turma.id}/revisoes`).send({ avaliacaoId: tag.id, estudanteId: contas.ana.id, nota, fundamento: 'Reapreciada a prova.' })
    assert.equal((await decidir(escola, 13)).status, 403)
    assert.equal((await decidir(director, 21)).status, 400)
    const d = (await decidir(director, 13).expect(200)).body
    assert.deepEqual([d[0].nota, d[0].revisao.notaAnterior, d[0].revisao.decisao, d[0].decisaoNome], [13, 14, 'baixou', 'A nota baixou'])
    assert.equal((await decidir(director, 15)).status, 409) // já decidido
    const ana = (await portal('ana').get('/api/portal/notas')).body.find((x) => x.cadeira.codigo === 'CEO')
    assert.equal(ana.final, 14.25) // (15,5 + 13) / 2
  })

  it('fora do prazo (depois das 17h do dia útil seguinte) já não se pede a recuperação', async () => {
    const p = (await escola.post(`/api/admin/academico/cadeiras/${ucs.GP.id}/provas`).send({ tipo: 'TAI', forma: 'teste', titulo: 'Teste GP' })).body
    const tai = p.avaliacoes[0]
    await escola.put(`/api/admin/academico/cadeiras/${ucs.GP.id}/provas/${tai.id}/notas`).send({ linhas: [{ estudanteId: contas.ana.id, nota: 7 }] })
    await escola.put(`/api/admin/academico/cadeiras/${ucs.GP.id}/provas/${tai.id}/publicacao`).send({ publicar: true })
    relogio.avancar(60 * 32) // quarta às 17h00 + 1 min (Luanda)
    const r = await portal('ana').post(`/api/portal/cadeiras/${ucs.GP.id}/provas/${tai.id}/recuperacao`)
    assert.equal(r.status, 409)
    assert.match(r.body.erro, /prazo/)
    const v = (await portal('ana').get('/api/portal/notas')).body.find((x) => x.cadeira.codigo === 'GP')
    assert.deepEqual([v.final, v.situacao, v.mencao], [7, 'reprovado', 'Reprovado'])
  })

  it('pauta geral pelo plano: os blocos e o que falta; o percurso mostra o plano', async () => {
    const g = (await escola.get(`/api/admin/academico/turmas/${turma.id}/pauta-plano`)).body
    assert.equal(g.plano.formula, 'ponderada')
    const ana = g.linhas.find((l) => l.estudante.id === contas.ana.id)
    assert.equal(ana.blocos.length, 5)
    assert.equal(ana.concluido, false)
    assert.ok(ana.emFalta.some((t) => t.startsWith('GP') && t.includes('reprovada')))
    const percurso = (await portal('ana').get('/api/portal/percurso')).body
    assert.equal(percurso.planoCurso.nome, '32.º Curso Superior de Comando e Direcção — Plano de Curso 2026/2027')
    assert.equal(percurso.conclusao.concluido, false)
  })
})
