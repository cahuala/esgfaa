import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, relogioFalso } from '../apoio/ambiente.js'

const NOVA = 'Portal2026segura'

describe('portal: fórum, calendário, progresso e questionários', () => {
  let amb, relogio, sec, cadeira, outra
  const contas = {}
  const tokens = {}
  const portal = (quem) => amb.com(tokens[quem])

  before(async () => {
    relogio = relogioFalso('2026-11-09T09:00:00Z') // segunda-feira
    amb = await criarAmbiente({ relogio })
    const admin = await amb.entrar()
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Estado-Maior' })
    const s = await amb.criarUtilizador('administrador')
    sec = () => amb.com(s.token)

    const turma = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM A' })).body
    const turmaB = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM B' })).body
    for (const k of ['prof', 'prof2']) contas[k] = (await sec().post('/api/admin/academico/contas').send({ tipo: 'docente', nome: `Docente ${k} Teste`, email: `${k}@esgfaa.gov.ao` })).body
    for (const k of ['ana', 'bruno']) contas[k] = (await amb.registarEMatricular(sec(), turma.id, { nome: `Estudante ${k} Teste`, email: `${k}@esgfaa.gov.ao` })).body
    contas.carla = (await amb.registarEMatricular(sec(), turmaB.id, { nome: 'Estudante carla Teste', email: 'carla@esgfaa.gov.ao' })).body

    cadeira = (await sec().post(`/api/admin/academico/turmas/${turma.id}/cadeiras`).send({ codigo: 'EST101', nome: 'Estratégia', horas: 60 })).body
    outra = (await sec().post(`/api/admin/academico/turmas/${turmaB.id}/cadeiras`).send({ codigo: 'LOG101', nome: 'Logística' })).body
    await sec().put(`/api/admin/academico/cadeiras/${cadeira.id}/docentes`).send({ docentes: [{ docenteId: contas.prof.id, papel: 'regente' }] })
    await sec().put(`/api/admin/academico/cadeiras/${outra.id}/docentes`).send({ docentes: [{ docenteId: contas.prof2.id, papel: 'regente' }] })
    await sec().post(`/api/admin/academico/cadeiras/${cadeira.id}/horarios`).send({ diaSemana: 1, inicio: '08:00', fim: '10:00', sala: 'A' })
    await sec().post(`/api/admin/academico/cadeiras/${cadeira.id}/horarios`).send({ diaSemana: 3, inicio: '08:00', fim: '10:00', sala: 'A' })

    for (const k of ['prof', 'prof2', 'ana', 'bruno', 'carla']) {
      const email = `${k}@esgfaa.gov.ao`
      const r = await amb.http().post('/api/portal/entrar').send({ email, senha: amb.senhaInicial(email) })
      tokens[k] = (await amb.com(r.body.token).put('/api/portal/eu/senha').send({ atual: amb.senhaInicial(email), nova: NOVA })).body.token
    }
  })
  after(() => amb.fechar())

  it('fórum: tópicos e respostas; o docente fixa, fecha e modera', async () => {
    const novo = await portal('ana').post(`/api/portal/cadeiras/${cadeira.id}/forum`).send({ titulo: 'Dúvida sobre o ensaio', texto: 'Qual é o limite de páginas?' })
    assert.equal(novo.status, 201, novo.body.erro)
    const id = novo.body.id
    assert.equal((await portal('carla').get(`/api/portal/forum/${id}`)).status, 404) // outra turma
    assert.equal((await portal('carla').post(`/api/portal/cadeiras/${cadeira.id}/forum`).send({ titulo: 'Intrusa aqui', texto: 'olá' })).status, 404)

    const r = await portal('prof').post(`/api/portal/forum/${id}/respostas`).send({ texto: 'Dez páginas.' })
    assert.equal(r.status, 201)
    assert.deepEqual(r.body.respostas.map((x) => [x.autor.nome, x.texto]), [['Docente prof Teste', 'Dez páginas.']])
    assert.equal((await portal('ana').put(`/api/portal/forum/${id}`).send({ fechado: true })).status, 403)
    assert.equal((await portal('prof').put(`/api/portal/forum/${id}`).send({ fixado: true, fechado: true })).body.fechado, true)
    assert.equal((await portal('bruno').post(`/api/portal/forum/${id}/respostas`).send({ texto: 'E as margens?' })).status, 409)

    const lista = (await portal('bruno').get(`/api/portal/cadeiras/${cadeira.id}/forum`)).body
    assert.deepEqual(lista.map((t) => [t.titulo, t.respostas, t.fixado]), [['Dúvida sobre o ensaio', 1, true]])
    // o estudante não apaga o tópico de outro nem um com respostas; o docente sim
    assert.equal((await portal('bruno').delete(`/api/portal/forum/${id}`)).status, 403)
    assert.equal((await portal('ana').delete(`/api/portal/forum/${id}`)).status, 409)
    const resposta = r.body.respostas[0].id
    assert.equal((await portal('ana').delete(`/api/portal/forum-respostas/${resposta}`)).status, 403)
    assert.equal((await portal('prof').delete(`/api/portal/forum/${id}`)).status, 204)
  })

  it('calendário: provas da cadeira, eventos da Administração Escolar, aulas sem feriados e prazos', async () => {
    const exame = await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/eventos`).send({ tipo: 'exame', data: '2026-11-20', inicio: '09:00', fim: '12:00', local: 'Anfiteatro' })
    assert.equal(exame.status, 201, exame.body.erro)
    assert.equal((await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/eventos`).send({ tipo: 'feriado', data: '2026-11-11' })).status, 400)
    assert.equal((await portal('ana').post(`/api/portal/cadeiras/${cadeira.id}/eventos`).send({ tipo: 'p1', data: '2026-11-12' })).status, 403)
    assert.equal((await sec().post('/api/admin/academico/eventos').send({ tipo: 'feriado', titulo: 'Dia da Independência', data: '2026-11-11' })).status, 201)
    await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/trabalhos`).send({ titulo: 'Ensaio estratégico', prazo: '2026-11-13T23:59:00Z' })

    const cal = await portal('ana').get('/api/portal/calendario?de=2026-11-09&ate=2026-11-22')
    assert.equal(cal.status, 200, cal.body.erro)
    const resumo = cal.body.map((e) => `${e.data} ${e.tipo}`)
    assert.ok(resumo.includes('2026-11-20 exame'))
    assert.ok(resumo.includes('2026-11-11 feriado'))
    assert.ok(resumo.includes('2026-11-13 prazo'))
    // aulas às segundas e quartas, menos a quarta-feira de feriado
    assert.deepEqual(cal.body.filter((e) => e.tipo === 'aula').map((e) => e.data), ['2026-11-09', '2026-11-16', '2026-11-18'])
    // outra turma não vê o exame desta cadeira (mas vê o feriado geral)
    const carla = (await portal('carla').get('/api/portal/calendario?de=2026-11-09&ate=2026-11-22')).body.map((e) => e.tipo)
    assert.ok(!carla.includes('exame') && carla.includes('feriado'))
    assert.equal((await portal('ana').get('/api/portal/calendario?de=2026-01-01&ate=2026-12-31')).status, 400)
    assert.equal((await portal('prof2').delete(`/api/portal/eventos/${exame.body.id}`)).status, 404)
  })

  it('questionários: sem respostas certas para o estudante, tempo controlado pelo servidor, correção automática', async () => {
    const criar = await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/questionarios`).send({ titulo: 'Teste formativo 1', duracao: 20, tentativas: 2 })
    assert.equal(criar.status, 201, criar.body.erro)
    const q = criar.body.id
    assert.equal((await portal('prof').put(`/api/portal/questionarios/${q}`).send({ publicado: true })).status, 400) // sem perguntas
    const p1 = await portal('prof').post(`/api/portal/questionarios/${q}/perguntas`).send({ tipo: 'unica', enunciado: 'Autor de "Da Guerra"?', pontos: 2, opcoes: [{ texto: 'Sun Tzu' }, { texto: 'Clausewitz', correta: true }] })
    assert.equal(p1.status, 201, p1.body.erro)
    await portal('prof').post(`/api/portal/questionarios/${q}/perguntas`).send({ tipo: 'vf', enunciado: 'A SADC tem sede em Gaborone.', correta: 'verdadeiro' })
    assert.equal((await portal('ana').get(`/api/portal/questionarios/${q}`)).status, 404) // ainda não publicado
    assert.equal((await portal('prof').put(`/api/portal/questionarios/${q}`).send({ publicado: true })).body.publicado, true)

    // o estudante não recebe as respostas certas
    const t = await portal('ana').post(`/api/portal/questionarios/${q}/tentativas`)
    assert.equal(t.status, 201, t.body.erro)
    assert.ok(!JSON.stringify(t.body).includes('correta'))
    const [perg1, perg2] = t.body.perguntas
    assert.deepEqual(perg1.opcoes, [{ i: 0, texto: 'Sun Tzu' }, { i: 1, texto: 'Clausewitz' }])
    // recomeçar devolve a mesma tentativa em curso
    assert.equal((await portal('ana').post(`/api/portal/questionarios/${q}/tentativas`)).body.id, t.body.id)
    assert.equal((await portal('bruno').put(`/api/portal/tentativas/${t.body.id}/respostas`).send({ respostas: {} })).status, 404) // de outro

    // grava a meio; depois o tempo acaba e a entrega tardia só conta o que estava gravado
    await portal('ana').put(`/api/portal/tentativas/${t.body.id}/respostas`).send({ respostas: { [perg1.id]: [1] } })
    relogio.avancar(25)
    assert.equal((await portal('ana').put(`/api/portal/tentativas/${t.body.id}/respostas`).send({ respostas: { [perg2.id]: [0] } })).status, 409)
    const tarde = await portal('ana').post(`/api/portal/tentativas/${t.body.id}/entrega`).send({ respostas: { [perg1.id]: [1], [perg2.id]: [0] } })
    assert.equal(tarde.status, 200, tarde.body.erro)
    assert.deepEqual([tarde.body.foraDeTempo, tarde.body.obtidos, tarde.body.total, tarde.body.nota], [true, 2, 3, 13.33])
    assert.equal((await portal('ana').post(`/api/portal/tentativas/${t.body.id}/entrega`).send({})).status, 409) // já entregue

    // segunda tentativa dentro do tempo: 20 valores; a terceira não é permitida
    const t2 = (await portal('ana').post(`/api/portal/questionarios/${q}/tentativas`)).body
    const certo = await portal('ana').post(`/api/portal/tentativas/${t2.id}/entrega`).send({ respostas: { [perg1.id]: [1], [perg2.id]: [0] } })
    assert.equal(certo.body.nota, 20)
    assert.ok(certo.body.correcao.every((c) => c.certa))
    assert.equal((await portal('ana').post(`/api/portal/questionarios/${q}/tentativas`)).status, 409)

    // tentativa abandonada fecha-se sozinha com o que estava gravado
    const tb = (await portal('bruno').post(`/api/portal/questionarios/${q}/tentativas`)).body
    relogio.avancar(30)
    const visto = (await portal('bruno').get(`/api/portal/questionarios/${q}`)).body
    assert.deepEqual([visto.emCurso, visto.feitas.length, visto.feitas[0].nota], [null, 1, 0])
    void tb

    // com tentativas, as perguntas ficam bloqueadas; o docente vê os resultados
    assert.equal((await portal('prof').post(`/api/portal/questionarios/${q}/perguntas`).send({ tipo: 'vf', enunciado: 'Mais uma?', correta: true })).status, 409)
    const edicao = (await portal('prof').get(`/api/portal/questionarios/${q}/edicao`)).body
    assert.equal(edicao.perguntas[0].opcoes[1].correta, true)
    assert.deepEqual(edicao.resultados.map((r) => r.nota).sort((a, b) => a - b), [0, 13.33, 20])
    assert.equal((await portal('ana').get(`/api/portal/questionarios/${q}/edicao`)).status, 403)
    const lista = (await portal('ana').get(`/api/portal/cadeiras/${cadeira.id}/questionarios`)).body
    assert.deepEqual([lista[0].feitas, lista[0].melhorNota], [2, 20])
  })

  it('progresso: materiais concluídos, trabalhos entregues e questionários feitos', async () => {
    const fd = (await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/materiais`).field('titulo', 'Leitura').field('tipo', 'ligacao').field('url', 'https://example.org/l')).body
    const p = (await portal('ana').put(`/api/portal/materiais/${fd.id}/conclusao`).send({ concluido: true })).body
    // atividades: 1 material + 1 trabalho + 1 questionário; a Ana concluiu o material e o questionário
    assert.deepEqual([p.feitas, p.total, p.percentagem], [2, 3, 67])
    assert.equal((await portal('carla').put(`/api/portal/materiais/${fd.id}/conclusao`).send({ concluido: true })).status, 404)
    assert.equal((await portal('prof').put(`/api/portal/materiais/${fd.id}/conclusao`).send({ concluido: true })).status, 403)

    const geral = (await portal('ana').get('/api/portal/progresso')).body
    assert.equal(geral[cadeira.id].percentagem, 67)
    const relatorio = (await portal('prof').get(`/api/portal/cadeiras/${cadeira.id}/progresso`)).body
    assert.equal(relatorio.atividades.length, 3)
    const ana = relatorio.linhas.find((l) => l.estudante.id === contas.ana.id)
    assert.equal(ana.feitas, 2)
    assert.ok(ana.concluidas.includes(`material-${fd.id}`))
    assert.ok(ana.concluidas.some((f) => f.startsWith('questionario-')))
    const desmarcar = (await portal('ana').put(`/api/portal/materiais/${fd.id}/conclusao`).send({ concluido: false })).body
    assert.equal(desmarcar.feitas, 1)
  })

  it('capítulos: o docente organiza; capítulos escondidos e o que têm não chegam aos estudantes', async () => {
    const url = `/api/portal/cadeiras/${cadeira.id}/secoes`
    const c1 = (await portal('prof').post(url).send({ titulo: 'Capítulo 1 — Teoria', resumo: 'Clássicos.' })).body
    const c2 = (await portal('prof').post(url).send({ titulo: 'Capítulo 2 — Prática', visivel: false })).body
    assert.equal((await portal('ana').post(url).send({ titulo: 'Intruso' })).status, 403)
    assert.equal((await portal('prof2').post(url).send({ titulo: 'Intruso' })).status, 404)

    const m = (await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/materiais`).send({ titulo: 'Sebenta escondida', tipo: 'ligacao', url: 'https://example.org/s', secaoId: c2.id })).body
    assert.equal(m.secaoId, c2.id)
    // capítulo de outra cadeira é recusado
    const alheio = (await portal('prof2').post(`/api/portal/cadeiras/${outra.id}/secoes`).send({ titulo: 'Da outra' })).body
    assert.equal((await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/materiais`).send({ titulo: 'X', tipo: 'ligacao', url: 'https://example.org/x', secaoId: alheio.id })).status, 400)

    let vista = (await portal('ana').get(`/api/portal/cadeiras/${cadeira.id}`)).body
    assert.deepEqual(vista.secoes.map((x) => x.titulo), ['Capítulo 1 — Teoria'])
    assert.ok(!vista.materiais.some((x) => x.id === m.id))
    assert.equal((await portal('prof').get(`/api/portal/cadeiras/${cadeira.id}`)).body.secoes.length, 2)

    // mostrar, reordenar, mover e apagar
    await portal('prof').put(`/api/portal/secoes/${c2.id}`).send({ visivel: true })
    vista = (await portal('ana').get(`/api/portal/cadeiras/${cadeira.id}`)).body
    assert.ok(vista.materiais.some((x) => x.id === m.id))
    const ordem = await portal('prof').put(`${url}/ordem`).send({ ids: [c2.id, c1.id] })
    assert.deepEqual(ordem.body.map((x) => x.id), [c2.id, c1.id])
    assert.equal((await portal('prof').put(`${url}/ordem`).send({ ids: [c2.id] })).status, 400)
    assert.equal((await portal('prof').put('/api/portal/atividades/capitulo').send({ tipo: 'material', id: m.id, secaoId: c1.id })).status, 204)
    assert.equal((await portal('prof').delete(`/api/portal/secoes/${c1.id}`)).status, 204)
    vista = (await portal('ana').get(`/api/portal/cadeiras/${cadeira.id}`)).body
    assert.equal(vista.materiais.find((x) => x.id === m.id).secaoId, null) // passou para a secção geral

    const part = (await portal('ana').get(`/api/portal/cadeiras/${cadeira.id}/participantes`)).body
    assert.deepEqual([part.docentes.length, part.estudantes.length], [1, 2])
    assert.equal((await portal('carla').get(`/api/portal/cadeiras/${cadeira.id}/participantes`)).status, 404)
  })
})
