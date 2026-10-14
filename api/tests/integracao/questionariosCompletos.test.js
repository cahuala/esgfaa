import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, relogioFalso } from '../apoio/ambiente.js'

const NOVA = 'Portal2026segura'

describe('questionários completos: tipos novos, banco, ordem aleatória, correção manual e estatísticas', () => {
  let amb, cadeira, q
  const contas = {}
  const tokens = {}
  const portal = (quem) => amb.com(tokens[quem])

  before(async () => {
    amb = await criarAmbiente({ relogio: relogioFalso('2026-11-09T09:00:00Z') })
    const admin = await amb.entrar()
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Estado-Maior' })
    const s = await amb.criarUtilizador('administrador')
    const sec = () => amb.com(s.token)
    const turma = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM A' })).body
    for (const k of ['prof', 'prof2']) contas[k] = (await sec().post('/api/admin/academico/contas').send({ tipo: 'docente', nome: `Docente ${k} Teste`, email: `${k}@esgfaa.gov.ao` })).body
    for (const k of ['ana', 'bruno']) contas[k] = (await amb.registarEMatricular(sec(), turma.id, { nome: `Estudante ${k} Teste`, email: `${k}@esgfaa.gov.ao` })).body
    cadeira = (await sec().post(`/api/admin/academico/turmas/${turma.id}/cadeiras`).send({ codigo: 'EST101', nome: 'Estratégia' })).body
    await sec().put(`/api/admin/academico/cadeiras/${cadeira.id}/docentes`).send({ docentes: [{ docenteId: contas.prof.id, papel: 'regente' }] })
    for (const k of ['prof', 'prof2', 'ana', 'bruno']) {
      const email = `${k}@esgfaa.gov.ao`
      const r = await amb.http().post('/api/portal/entrar').send({ email, senha: email })
      tokens[k] = (await amb.com(r.body.token).put('/api/portal/eu/senha').send({ atual: email, nova: NOVA })).body.token
    }
  })
  after(() => amb.fechar())

  it('banco de perguntas: guardar, listar, juntar a um questionário; só o dono', async () => {
    const b1 = await portal('prof').post('/api/portal/banco').send({ categoria: 'Clássicos', tipo: 'curta', enunciado: 'Autor de "Da Guerra"?', opcoes: { respostas: ['Clausewitz', 'Carl von Clausewitz'] } })
    assert.equal(b1.status, 201, b1.body.erro)
    const b2 = (await portal('prof').post('/api/portal/banco').send({ categoria: 'Datas', tipo: 'numerica', enunciado: 'Ano da independência de Angola?', opcoes: { valor: 1975, tolerancia: 0 } })).body
    const b3 = (await portal('prof').post('/api/portal/banco').send({
      categoria: 'Clássicos', tipo: 'correspondencia', enunciado: 'Ligue o autor à obra.', pontos: 3,
      opcoes: { pares: [{ a: 'Sun Tzu', b: 'A Arte da Guerra' }, { a: 'Clausewitz', b: 'Da Guerra' }, { a: 'Maquiavel', b: 'O Príncipe' }] },
    })).body
    assert.equal((await portal('ana').get('/api/portal/banco')).status, 403)
    assert.equal((await portal('prof2').get('/api/portal/banco')).body.length, 0)
    assert.equal((await portal('prof').get('/api/portal/banco')).body.length, 3)

    q = (await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/questionarios`).send({ titulo: 'Teste completo', baralhar: true, perguntasPorTentativa: 0 })).body
    assert.equal((await portal('prof2').post(`/api/portal/questionarios/${q.id}/do-banco`).send({ ids: [b1.body.id] })).status, 404)
    const junto = await portal('prof').post(`/api/portal/questionarios/${q.id}/do-banco`).send({ ids: [b1.body.id, b2.id, b3.id] })
    assert.equal(junto.status, 200, junto.body.erro)
    assert.equal(junto.body.perguntas.length, 3)
    const diss = await portal('prof').post(`/api/portal/questionarios/${q.id}/perguntas`).send({ tipo: 'dissertacao', enunciado: 'Comente: "A guerra é a continuação da política".', pontos: 5, opcoes: { orientacao: 'Até 300 palavras.' } })
    assert.equal(diss.status, 201, diss.body.erro)
    // e o caminho inverso: guardar no banco uma pergunta do questionário
    const daq = await portal('prof').post(`/api/portal/perguntas/${diss.body.perguntas.at(-1).id}/banco`).send({ categoria: 'Ensaios' })
    assert.equal(daq.status, 201)
    assert.equal((await portal('prof').get('/api/portal/banco')).body.length, 4)
    assert.equal((await portal('prof2').delete(`/api/portal/banco/${b2.id}`)).status, 404)
    await portal('prof').put(`/api/portal/questionarios/${q.id}`).send({ publicado: true })
  })

  it('tentativa: sem soluções; correspondência baralhada e respondida pela posição; dissertação espera pelo docente', async () => {
    const t = (await portal('ana').post(`/api/portal/questionarios/${q.id}/tentativas`)).body
    const texto = JSON.stringify(t)
    for (const segredo of ['Carl von Clausewitz', '1975', 'tolerancia', 'correta']) assert.ok(!texto.includes(segredo), segredo)
    const porTipo = Object.fromEntries(t.perguntas.map((p) => [p.tipo, p]))
    const cor = porTipo.correspondencia
    assert.deepEqual(cor.itens, ['Sun Tzu', 'Clausewitz', 'Maquiavel'])
    assert.deepEqual(cor.escolhas.map((e) => e.i), [0, 1, 2]) // numeradas pela posição mostrada
    // responde certo: para cada autor, a posição da obra certa
    const certas = ['A Arte da Guerra', 'Da Guerra', 'O Príncipe'].map((b) => cor.escolhas.find((e) => e.texto === b).i)
    const respostas = { [porTipo.curta.id]: 'clausewitz', [porTipo.numerica.id]: '1975', [cor.id]: certas, [porTipo.dissertacao.id]: 'A política dá os fins…' }
    await portal('ana').put(`/api/portal/tentativas/${t.id}/respostas`).send({ respostas })
    // retomar devolve as respostas na mesma numeração
    assert.deepEqual((await portal('ana').get(`/api/portal/questionarios/${q.id}`)).body.emCurso.respostas[cor.id], certas)

    const r = (await portal('ana').post(`/api/portal/tentativas/${t.id}/entrega`).send({ respostas })).body
    assert.deepEqual([r.porCorrigir, r.nota, r.obtidos, r.total], [true, null, 5, 10])
    assert.equal(r.correcao, undefined) // só depois de corrigida
    const avisos = (await portal('prof').get('/api/portal/notificacoes')).body.lista
    assert.match(avisos[0].titulo, /Dissertação por corrigir/)
  })

  it('o docente corrige a dissertação; a nota sai e o estudante é avisado; estatísticas', async () => {
    const edicao = (await portal('prof').get(`/api/portal/questionarios/${q.id}/edicao`)).body
    const [res] = edicao.resultados
    assert.deepEqual([res.porCorrigir, res.nota], [true, null])
    const c = (await portal('prof').get(`/api/portal/tentativas/${res.id}/correcao`)).body
    const diss = c.perguntas.find((p) => p.tipo === 'dissertacao')
    assert.equal(c.detalhe.find((d) => d.perguntaId === diss.id).dada, 'A política dá os fins…')
    assert.equal((await portal('prof').put(`/api/portal/tentativas/${res.id}/correcao`).send({ pontos: { [diss.id]: 6 } })).status, 400) // acima do máximo
    assert.equal((await portal('prof2').put(`/api/portal/tentativas/${res.id}/correcao`).send({ pontos: { [diss.id]: 4 } })).status, 404)
    const ok = await portal('prof').put(`/api/portal/tentativas/${res.id}/correcao`).send({ pontos: { [diss.id]: 4 }, comentario: 'Boa ligação aos fins políticos.' })
    assert.equal(ok.status, 200, ok.body.erro)
    assert.deepEqual([ok.body.porCorrigir, ok.body.nota], [false, 18])
    assert.match((await portal('ana').get('/api/portal/notificacoes')).body.lista[0].titulo, /Questionário corrigido/)
    const rev = (await portal('ana').get(`/api/portal/tentativas/${res.id}`)).body
    assert.equal(rev.nota, 18)
    assert.equal(rev.comentario, 'Boa ligação aos fins políticos.')
    assert.deepEqual(rev.correcao.find((d) => d.textos).textos.certas, ['A Arte da Guerra', 'Da Guerra', 'O Príncipe'])

    // o Bruno erra a numérica e não responde ao resto
    const tb = (await portal('bruno').post(`/api/portal/questionarios/${q.id}/tentativas`)).body
    const num = tb.perguntas.find((p) => p.tipo === 'numerica')
    await portal('bruno').post(`/api/portal/tentativas/${tb.id}/entrega`).send({ respostas: { [num.id]: '1974' } })
    const e = (await portal('prof').get(`/api/portal/questionarios/${q.id}/estatisticas`)).body
    assert.equal(e.tentativas, 2)
    const pnum = e.porPergunta.find((p) => p.tipo === 'numerica')
    assert.deepEqual([pnum.respondidas, pnum.facilidade], [2, 50])
    assert.equal((await portal('ana').get(`/api/portal/questionarios/${q.id}/estatisticas`)).status, 403)
  })

  it('subconjunto de perguntas por tentativa', async () => {
    const q2 = (await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/questionarios`).send({ titulo: 'Sorteio', perguntasPorTentativa: 2 })).body
    for (const n of [1, 2, 3, 4]) await portal('prof').post(`/api/portal/questionarios/${q2.id}/perguntas`).send({ tipo: 'vf', enunciado: `Afirmação número ${n}.`, correta: true })
    await portal('prof').put(`/api/portal/questionarios/${q2.id}`).send({ publicado: true })
    const t = (await portal('ana').post(`/api/portal/questionarios/${q2.id}/tentativas`)).body
    assert.equal(t.perguntas.length, 2)
    const r = (await portal('ana').post(`/api/portal/tentativas/${t.id}/entrega`).send({ respostas: Object.fromEntries(t.perguntas.map((p) => [p.id, [0]])) })).body
    assert.deepEqual([r.total, r.nota], [2, 20]) // só contam as perguntas sorteadas
  })
})
