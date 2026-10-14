import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, relogioFalso } from '../apoio/ambiente.js'

const NOVA = 'Portal2026segura'
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')
const anexo = (nome) => [PDF, { filename: nome, contentType: 'application/pdf' }]

describe('mais recursos: página, pasta, videoconferência, sondagem e avaliação do docente', () => {
  let amb, relogio, cadeira, turma, sec
  const contas = {}
  const tokens = {}
  const portal = (quem) => amb.com(tokens[quem])
  const vista = async (quem) => (await portal(quem).get(`/api/portal/cadeiras/${cadeira.id}`)).body

  before(async () => {
    relogio = relogioFalso('2026-11-09T09:00:00Z')
    amb = await criarAmbiente({ relogio })
    const admin = await amb.entrar()
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Estado-Maior' })
    const s = await amb.criarUtilizador('administrador')
    sec = () => amb.com(s.token)
    turma = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM A' })).body
    contas.prof = (await sec().post('/api/admin/academico/contas').send({ tipo: 'docente', nome: 'Docente Prof Teste', email: 'prof@esgfaa.gov.ao' })).body
    contas.assist = (await sec().post('/api/admin/academico/contas').send({ tipo: 'docente', nome: 'Docente Assist Teste', email: 'assist@esgfaa.gov.ao' })).body
    for (const k of ['ana', 'bruno', 'carla', 'dino']) contas[k] = (await amb.registarEMatricular(sec(), turma.id, { nome: `Estudante ${k} Teste`, email: `${k}@esgfaa.gov.ao` })).body
    cadeira = (await sec().post(`/api/admin/academico/turmas/${turma.id}/cadeiras`).send({ codigo: 'EST101', nome: 'Estratégia' })).body
    await sec().put(`/api/admin/academico/cadeiras/${cadeira.id}/docentes`).send({ docentes: [{ docenteId: contas.prof.id, papel: 'regente' }, { docenteId: contas.assist.id, papel: 'assistente' }] })
    for (const k of ['prof', 'assist', 'ana', 'bruno', 'carla', 'dino']) {
      const email = `${k}@esgfaa.gov.ao`
      const r = await amb.http().post('/api/portal/entrar').send({ email, senha: email })
      tokens[k] = (await amb.com(r.body.token).put('/api/portal/eu/senha').send({ atual: email, nova: NOVA })).body.token
    }
  })
  after(() => amb.fechar())

  it('página com texto filtrado; edição', async () => {
    const criar = (corpo) => portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/materiais`).send(corpo)
    assert.equal((await criar({ tipo: 'pagina', titulo: 'Vazia', conteudo: '<p>  </p>' })).status, 400)
    const r = await criar({ tipo: 'pagina', titulo: 'Introdução', conteudo: '<h2>Objetivos</h2><p>Ler <b>Clausewitz</b>.</p><script>alert(1)</script><img src=x onerror="alert(2)">' })
    assert.equal(r.status, 201, r.body.erro)
    assert.match(r.body.conteudo, /<h2>Objetivos<\/h2>/)
    assert.doesNotMatch(r.body.conteudo, /script|onerror/)
    const e = await portal('prof').put(`/api/portal/materiais/${r.body.id}`).send({ conteudo: '<p>Novo texto.</p>', titulo: 'Introdução à cadeira' })
    assert.equal(e.status, 200, e.body.erro)
    assert.deepEqual([e.body.titulo, e.body.conteudo], ['Introdução à cadeira', '<p>Novo texto.</p>'])
    assert.equal((await portal('ana').put(`/api/portal/materiais/${r.body.id}`).send({ titulo: 'x' })).status, 403)
    assert.equal((await vista('ana')).materiais.find((m) => m.id === r.body.id).conteudo, '<p>Novo texto.</p>')
  })

  it('pasta com vários ficheiros: juntar, retirar e abrir só quem pode', async () => {
    assert.equal((await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/materiais`).field('tipo', 'pasta').field('titulo', 'Vazia')).status, 400)
    const r = await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/materiais`).field('tipo', 'pasta').field('titulo', 'Leituras')
      .attach('ficheiros', ...anexo('a.pdf')).attach('ficheiros', ...anexo('b.pdf'))
    assert.equal(r.status, 201, r.body.erro)
    assert.deepEqual(r.body.ficheiros.map((f) => f.nome), ['a.pdf', 'b.pdf'])
    for (const f of r.body.ficheiros) assert.equal((await portal('ana').get(`/api/portal/ficheiros/${f.id}`)).status, 200)
    const e = await portal('prof').put(`/api/portal/materiais/${r.body.id}`).field('retirarFicheiros', JSON.stringify([r.body.ficheiros[0].id])).attach('ficheiros', ...anexo('c.pdf'))
    assert.equal(e.status, 200, e.body.erro)
    assert.deepEqual(e.body.ficheiros.map((f) => f.nome), ['b.pdf', 'c.pdf'])
    // escondida: os ficheiros da pasta deixam de abrir
    await portal('prof').put('/api/portal/atividades/restricoes').send({ tipo: 'material', id: r.body.id, visivel: false })
    assert.equal((await portal('ana').get(`/api/portal/ficheiros/${e.body.ficheiros[1].id}`)).status, 404)
    await portal('prof').put('/api/portal/atividades/restricoes').send({ tipo: 'material', id: r.body.id, visivel: true })
  })

  it('videoconferência: endereço, início e duração', async () => {
    const criar = (corpo) => portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/materiais`).send({ tipo: 'videoconferencia', titulo: 'Aula síncrona', ...corpo })
    assert.equal((await criar({ url: 'https://meet.example.org/abc' })).status, 400) // sem hora
    assert.equal((await criar({ url: 'javascript:alert(1)', inicio: '2026-11-12T14:00:00Z' })).status, 400)
    assert.equal((await criar({ url: 'https://meet.example.org/abc', inicio: '2026-11-12T14:00:00Z', duracao: 2 })).status, 400)
    const r = await criar({ url: 'https://meet.example.org/abc', inicio: '2026-11-12T14:00:00Z', duracao: 90 })
    assert.equal(r.status, 201, r.body.erro)
    assert.deepEqual([r.body.inicio, r.body.duracao], ['2026-11-12T14:00:00.000Z', 90])
  })

  it('sondagem: responder, mudar a resposta, resultados e restrições', async () => {
    const criar = (corpo) => portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/sondagens`).send({ titulo: 'Data da visita', pergunta: 'Que dia prefere para a visita de estudo?', ...corpo })
    assert.equal((await criar({ opcoes: ['Sexta'] })).status, 400)
    assert.equal((await criar({ opcoes: ['Sexta', 'sexta'] })).status, 400)
    assert.equal((await portal('ana').post(`/api/portal/cadeiras/${cadeira.id}/sondagens`).send({ titulo: 'x', pergunta: 'y?', opcoes: ['a', 'b'] })).status, 403)
    const s = (await criar({ opcoes: ['Quinta', 'Sexta', 'Sábado'], mostrarResultados: 'apos_responder', fecha: '2026-11-20T23:59:00Z' })).body
    assert.ok(s.id)
    assert.ok((await vista('ana')).inqueritos.some((i) => i.id === s.id && i.respondido === false))

    let v = (await portal('ana').get(`/api/portal/inqueritos/${s.id}`)).body
    assert.deepEqual([v.respondido, v.podeResponder, v.resultados], [false, true, null])
    assert.equal((await portal('ana').post(`/api/portal/inqueritos/${s.id}/respostas`).send({ respostas: { 0: [0, 1] } })).status, 400) // só uma
    v = (await portal('ana').post(`/api/portal/inqueritos/${s.id}/respostas`).send({ respostas: { 0: [1] } })).body
    assert.deepEqual([v.respondido, v.minhaResposta[0], v.resultados.perguntas[0].contagens], [true, [1], [0, 1, 0]])
    // não anónima: pode mudar até ao fecho
    v = (await portal('ana').post(`/api/portal/inqueritos/${s.id}/respostas`).send({ respostas: { 0: [2] } })).body
    assert.deepEqual(v.resultados.perguntas[0].contagens, [0, 0, 1])
    await portal('bruno').post(`/api/portal/inqueritos/${s.id}/respostas`).send({ respostas: { 0: [2] } })
    const docente = (await portal('prof').get(`/api/portal/inqueritos/${s.id}`)).body
    assert.deepEqual([docente.resultados.total, docente.estudantes], [2, 4])
    assert.deepEqual(docente.porEstudante.map((x) => x.estudante).sort(), ['Estudante ana Teste', 'Estudante bruno Teste'])
    assert.equal((await portal('prof').put(`/api/portal/inqueritos/${s.id}`).send({ opcoes: ['A', 'B'], pergunta: 'Outra?' })).status, 409)
    // conta para o progresso e serve de condição
    const p = (await portal('ana').get(`/api/portal/cadeiras/${cadeira.id}/progresso`)).body
    assert.equal(p.itens.find((i) => i.tipo === 'inquerito' && i.id === s.id).feita, true)
    const t = (await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/trabalhos`).send({ titulo: 'Relatório da visita', prazo: '2026-11-30T23:59:00Z' })).body
    assert.equal((await portal('prof').put('/api/portal/atividades/restricoes').send({ tipo: 'trabalho', id: t.id, requisitos: [{ tipo: 'inquerito', id: s.id, notaMinima: 10 }] })).status, 400)
    await portal('prof').put('/api/portal/atividades/restricoes').send({ tipo: 'trabalho', id: t.id, requisitos: [{ tipo: 'inquerito', id: s.id }] })
    assert.equal((await vista('ana')).trabalhos.find((x) => x.id === t.id).bloqueio, null)
    assert.equal((await vista('carla')).trabalhos.find((x) => x.id === t.id).bloqueio[0].titulo, 'Data da visita')
    // fechada: já não se responde
    relogio.avancar(60 * 24 * 12)
    assert.equal((await portal('carla').post(`/api/portal/inqueritos/${s.id}/respostas`).send({ respostas: { 0: [0] } })).status, 409)
    await portal('prof').delete(`/api/portal/trabalhos/${t.id}`)
  })

  it('sondagem anónima: não guarda quem respondeu o quê; responder uma só vez', async () => {
    const s = (await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/sondagens`).send({ titulo: 'Ritmo das aulas', pergunta: 'O ritmo está adequado?', opcoes: ['Lento', 'Bom', 'Rápido'], anonimo: true, mostrarResultados: 'nunca' })).body
    const v = (await portal('ana').post(`/api/portal/inqueritos/${s.id}/respostas`).send({ respostas: { 0: [1] } })).body
    assert.deepEqual([v.respondido, v.minhaResposta, v.resultados, v.podeResponder], [true, null, null, false])
    assert.equal((await portal('ana').post(`/api/portal/inqueritos/${s.id}/respostas`).send({ respostas: { 0: [0] } })).status, 409)
    const docente = (await portal('prof').get(`/api/portal/inqueritos/${s.id}`)).body
    assert.equal(docente.porEstudante, undefined)
    assert.equal(docente.resultados.total, 1)
    const linhas = await amb.contentor.prisma.respostaInquerito.findMany({ where: { inqueritoId: s.id } })
    assert.deepEqual(linhas.map((l) => l.estudanteId), [null])
  })

  it('avaliação dos docentes: lançada pela Administração Escolar, anónima, resultados com mínimo de respostas', async () => {
    assert.equal((await sec().post(`/api/admin/academico/turmas/${turma.id}/avaliacao`).send({ fecha: '2020-01-01T00:00:00Z' })).status, 400)
    const l = await sec().post(`/api/admin/academico/turmas/${turma.id}/avaliacao`).send({ fecha: '2026-12-15T23:59:00Z' })
    assert.equal(l.status, 201, l.body.erro)
    assert.equal(l.body.criados, 2) // regente e assistente
    assert.equal((await sec().post(`/api/admin/academico/turmas/${turma.id}/avaliacao`).send({ fecha: '2026-12-15T23:59:00Z' })).body.criados, 0) // não repete

    const lista = (await vista('ana')).inqueritos.filter((i) => i.tipo === 'avaliacao')
    assert.equal(lista.length, 2)
    const daProf = lista.find((i) => i.docenteId === contas.prof.id)
    // o docente não esconde, não muda nem apaga a sua avaliação
    assert.equal((await portal('prof').put('/api/portal/atividades/restricoes').send({ tipo: 'inquerito', id: daProf.id, visivel: false })).status, 403)
    assert.equal((await portal('prof').put('/api/portal/atividades/capitulo').send({ tipo: 'inquerito', id: daProf.id, secaoId: null })).status, 403)
    assert.equal((await portal('prof').delete(`/api/portal/inqueritos/${daProf.id}`)).status, 403)

    const v = (await portal('ana').get(`/api/portal/inqueritos/${daProf.id}`)).body
    assert.equal(v.perguntas.length, 10)
    const completas = { 0: 5, 1: 4, 2: 5, 3: 4, 4: 5, 5: 3, 6: 4, 7: 5, 8: 'Aulas muito práticas.', 9: '' }
    assert.equal((await portal('ana').post(`/api/portal/inqueritos/${daProf.id}/respostas`).send({ respostas: { 0: 5 } })).status, 400) // faltam afirmações
    assert.equal((await portal('ana').post(`/api/portal/inqueritos/${daProf.id}/respostas`).send({ respostas: completas })).status, 200)
    assert.equal((await portal('ana').post(`/api/portal/inqueritos/${daProf.id}/respostas`).send({ respostas: completas })).status, 409)
    await portal('bruno').post(`/api/portal/inqueritos/${daProf.id}/respostas`).send({ respostas: { ...completas, 0: 3, 8: 'Bom docente.' } })

    // antes do fecho, o docente não vê nada; o colega nunca vê
    assert.equal((await portal('prof').get(`/api/portal/inqueritos/${daProf.id}`)).body.resultados, undefined)
    assert.match((await portal('assist').get(`/api/portal/inqueritos/${daProf.id}`)).body.aviso, /Só o docente avaliado/)
    // a Administração Escolar vê a síntese e o detalhe
    const resumo = (await sec().get(`/api/admin/academico/turmas/${turma.id}/avaliacao`)).body
    assert.deepEqual(resumo.find((x) => x.id === daProf.id).respostas, 2)
    const det = (await sec().get(`/api/admin/academico/inqueritos/${daProf.id}`)).body
    assert.deepEqual([det.resultados.total, det.resultados.perguntas[0].media, det.resultados.perguntas[8].comentarios], [2, 4, ['Aulas muito práticas.', 'Bom docente.']])

    // depois do fecho: com 2 respostas ainda não; com 3, sim
    await portal('carla').post(`/api/portal/inqueritos/${daProf.id}/respostas`).send({ respostas: completas })
    relogio.avancar(60 * 24 * 40)
    const fim = (await portal('prof').get(`/api/portal/inqueritos/${daProf.id}`)).body
    assert.equal(fim.resultados.total, 3)
    assert.equal(fim.porEstudante, undefined)
    const daAssist = lista.find((i) => i.docenteId === contas.assist.id)
    assert.match((await portal('assist').get(`/api/portal/inqueritos/${daAssist.id}`)).body.aviso, /pelo menos 3 respostas/)
    assert.equal((await amb.com(tokens.ana).get(`/api/admin/academico/turmas/${turma.id}/avaliacao`)).status, 401)
  })

  it('a cópia leva páginas, pastas, videoconferências e sondagens, mas não as avaliações', async () => {
    const nova = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2027/2028', nome: 'CEM B' })).body
    const r = await sec().post(`/api/admin/academico/turmas/${nova.id}/copiar`).send({ origemTurmaId: turma.id, docentes: true })
    assert.equal(r.status, 200, r.body.erro)
    const destino = (await sec().get(`/api/admin/academico/turmas/${nova.id}`)).body.cadeiras[0]
    const v = (await portal('prof').get(`/api/portal/cadeiras/${destino.id}`)).body
    assert.deepEqual(v.inqueritos.map((i) => i.tipo), ['sondagem', 'sondagem'])
    const pasta = v.materiais.find((m) => m.tipo === 'pasta')
    assert.deepEqual(pasta.ficheiros.map((f) => f.nome), ['b.pdf', 'c.pdf'])
    assert.equal(v.materiais.find((m) => m.tipo === 'videoconferencia').inicio, '2027-11-12T14:00:00.000Z')
    assert.equal(v.materiais.find((m) => m.tipo === 'pagina').conteudo, '<p>Novo texto.</p>')
  })
})
