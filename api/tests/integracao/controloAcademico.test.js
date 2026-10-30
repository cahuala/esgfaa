import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, relogioFalso } from '../apoio/ambiente.js'

const NOVA = 'Portal2026segura'
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')

describe('controlo centralizado: provas escritas, alteração de notas pelo Comandante, verificação dos docentes', () => {
  let amb, cadeira, sec, cmd, dir
  const contas = {}
  const tokens = {}
  const portal = (quem) => amb.com(tokens[quem])

  before(async () => {
    amb = await criarAmbiente({ relogio: relogioFalso('2026-11-09T09:00:00Z') })
    const admin = await amb.entrar()
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Estado-Maior' })
    // o registo das pessoas é do Pessoal e Quadros: aqui faz-se com um administrador
    const adm = amb.com((await amb.criarUtilizador('administrador')).token)
    sec = amb.com((await amb.criarUtilizador('secretaria')).token)
    cmd = amb.com((await amb.criarUtilizador('comandante')).token)
    dir = amb.com((await amb.criarUtilizador('director_ensino')).token)
    const turma = (await adm.post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM A' })).body
    contas.prof = (await adm.post('/api/admin/academico/contas').send({ tipo: 'docente', nome: 'Docente Prof Teste', email: 'prof@esgfaa.gov.ao' })).body
    for (const k of ['ana', 'bruno', 'carla']) contas[k] = (await amb.registarEMatricular(adm, turma.id, { nome: `Estudante ${k} Teste`, email: `${k}@esgfaa.gov.ao` })).body
    cadeira = (await adm.post(`/api/admin/academico/turmas/${turma.id}/cadeiras`).send({ codigo: 'EST101', nome: 'Estratégia' })).body
    await adm.put(`/api/admin/academico/cadeiras/${cadeira.id}/docentes`).send({ docentes: [{ docenteId: contas.prof.id, papel: 'regente' }] })
    for (const k of ['prof', 'ana']) {
      const email = `${k}@esgfaa.gov.ao`
      const r = await amb.http().post('/api/portal/entrar').send({ email, senha: amb.senhaInicial(email) })
      tokens[k] = (await amb.com(r.body.token).put('/api/portal/eu/senha').send({ atual: amb.senhaInicial(email), nova: NOVA })).body.token
    }
  })
  after(() => amb.fechar())

  it('prova escrita: o docente envia, a Repartição vê, abre e marca como impressa; os estudantes não a abrem', async () => {
    const url = `/api/portal/cadeiras/${cadeira.id}/provas-escritas`
    const enviar = (quem, ficheiro = [PDF, { filename: 'tai1.pdf', contentType: 'application/pdf' }]) => portal(quem).post(url).field('titulo', '1.º TAI — teste escrito').field('data', '2026-11-20').attach('ficheiro', ...ficheiro)
    assert.equal((await enviar('ana')).status, 403)
    assert.equal((await enviar('prof', [Buffer.from('ola'), { filename: 'x.txt', contentType: 'text/plain' }])).status, 400)
    const e = await enviar('prof')
    assert.equal(e.status, 201, e.body.erro)
    assert.deepEqual([e.body.copias, e.body.estado], [3, 'enviado']) // uma cópia por estudante
    assert.equal((await portal('ana').get(`/api/portal/ficheiros/${e.body.ficheiroId}`)).status, 404)
    assert.equal((await portal('prof').get(`/api/portal/ficheiros/${e.body.ficheiroId}`)).status, 200)

    const lista = (await sec.get('/api/admin/academico/provas-escritas?estado=enviado')).body
    assert.deepEqual(lista.map((x) => [x.titulo, x.docente, x.cadeira.codigo]), [['1.º TAI — teste escrito', 'Docente Prof Teste', 'EST101']])
    assert.equal((await sec.get(`/api/admin/academico/ficheiros/${e.body.ficheiroId}`)).status, 200)
    assert.equal((await sec.get('/api/admin/academico/pendentes')).body.provasPorImprimir, 1)
    assert.equal((await dir.put(`/api/admin/academico/provas-escritas/${e.body.id}`).send({ impresso: true })).status, 403)
    const imp = await sec.put(`/api/admin/academico/provas-escritas/${e.body.id}`).send({ impresso: true })
    assert.equal(imp.body.estado, 'impresso')
    assert.equal((await portal('prof').delete(`/api/portal/provas-escritas/${e.body.id}`)).status, 409) // já impressa
    const avisos = (await portal('prof').get('/api/portal/notificacoes')).body
    assert.ok(JSON.stringify(avisos).includes('Prova impressa'))
  })

  it('notas publicadas: o docente pede a alteração de um estudante; o Comandante autoriza; muda só essa, uma vez', async () => {
    const pauta = `/api/portal/cadeiras/${cadeira.id}/pauta`
    const linhas = (p1) => ({ linhas: [{ estudanteId: contas.ana.id, p1: p1.ana }, { estudanteId: contas.bruno.id, p1: p1.bruno }, { estudanteId: contas.carla.id, p1: p1.carla }] })
    assert.equal((await portal('prof').put(pauta).send(linhas({ ana: 9, bruno: 12, carla: 14 }))).status, 200)
    assert.equal((await portal('prof').put(pauta).send(linhas({ ana: 9.5, bruno: 12, carla: 14 }))).status, 200) // ainda não publicada: muda à vontade
    assert.equal((await portal('prof').put(`${pauta}/publicacao`).send({ publicadas: ['p1'] })).status, 200)

    // publicada: não muda sem autorização, nem se retira a publicação
    const fechado = await portal('prof').put(pauta).send(linhas({ ana: 11, bruno: 12, carla: 14 }))
    assert.equal(fechado.status, 409)
    assert.match(fechado.body.erro, /Estudante ana Teste/)
    assert.equal((await portal('prof').put(`${pauta}/publicacao`).send({ publicadas: [] })).status, 409)

    const url = `/api/portal/cadeiras/${cadeira.id}/alteracoes-notas`
    assert.equal((await portal('prof').post(url).send({ componente: 'p1', estudanteIds: [contas.ana.id], motivo: 'curto' })).status, 400)
    const p = await portal('prof').post(url).send({ componente: 'p1', estudanteIds: [contas.ana.id], motivo: 'Erro de soma na correção da pergunta 3.' })
    assert.equal(p.status, 201, p.body.erro)
    assert.deepEqual(p.body.map((x) => [x.estudante.nome, x.notaAtual, x.estado]), [['Estudante ana Teste', 9.5, 'pendente']])
    assert.equal((await portal('prof').post(url).send({ componente: 'p1', estudanteIds: [contas.ana.id], motivo: 'Outra vez o mesmo pedido.' })).status, 409)

    // o Comandante decide (o Director de Ensino e a Repartição veem, mas não decidem)
    const pend = (await cmd.get('/api/admin/academico/alteracoes-notas?estado=pendente')).body
    assert.deepEqual(pend.map((x) => [x.cadeira.codigo, x.docente, x.motivo]), [['EST101', 'Docente Prof Teste', 'Erro de soma na correção da pergunta 3.']])
    assert.equal((await sec.post('/api/admin/academico/alteracoes-notas/decidir').send({ ids: [pend[0].id], decisao: 'autorizar' })).status, 403)
    assert.equal((await cmd.post('/api/admin/academico/alteracoes-notas/decidir').send({ ids: [pend[0].id], decisao: 'recusar' })).status, 400) // recusar exige fundamento
    assert.equal((await cmd.post('/api/admin/academico/alteracoes-notas/decidir').send({ ids: [pend[0].id], decisao: 'autorizar' })).body.decididos, 1)

    // autorizado só a Ana: mudar o Bruno continua fechado; a Ana muda uma vez
    assert.equal((await portal('prof').put(pauta).send(linhas({ ana: 11, bruno: 13, carla: 14 }))).status, 409)
    assert.equal((await portal('prof').put(pauta).send(linhas({ ana: 11, bruno: 12, carla: 14 }))).status, 200)
    assert.equal((await portal('prof').put(pauta).send(linhas({ ana: 12, bruno: 12, carla: 14 }))).status, 409) // a autorização gastou-se
    const feito = (await portal('prof').get(url)).body
    assert.deepEqual(feito.map((x) => [x.estado, x.notaAtual, x.notaNova]), [['usado', 9.5, 11]])
    const notas = (await portal('ana').get('/api/portal/notas')).body
    assert.ok(JSON.stringify(notas).includes('11'))
  })

  it('provas do plano de curso (TAI/TAG): o mesmo, por prova e por estudante', async () => {
    const base = `/api/portal/cadeiras/${cadeira.id}/provas`
    const criada = await portal('prof').post(base).send({ tipo: 'TAI', forma: 'teste', titulo: 'Teste 1', data: '2026-11-10' })
    assert.equal(criada.status, 201, criada.body.erro)
    const prova = criada.body.avaliacoes.find((a) => a.titulo === 'Teste 1')
    const notas = (ana, bruno) => portal('prof').put(`${base}/${prova.id}/notas`).send({ linhas: [{ estudanteId: contas.ana.id, nota: ana }, { estudanteId: contas.bruno.id, nota: bruno }] })
    assert.equal((await notas(8, 15)).status, 200)
    assert.equal((await portal('prof').put(`${base}/${prova.id}/publicacao`).send({ publicar: true })).status, 200)
    assert.equal((await notas(10, 15)).status, 409)
    assert.equal((await portal('prof').put(`${base}/${prova.id}/publicacao`).send({ publicar: false })).status, 409)
    const url = `/api/portal/cadeiras/${cadeira.id}/alteracoes-notas`
    const p = (await portal('prof').post(url).send({ avaliacaoId: prova.id, estudanteIds: [contas.ana.id], motivo: 'Pergunta 2 corrigida com a chave errada.' })).body
    const pedido = p.find((x) => x.avaliacaoId === prova.id)
    assert.deepEqual([pedido.prova.titulo, pedido.notaAtual], ['Teste 1', 8])
    await cmd.post('/api/admin/academico/alteracoes-notas/decidir').send({ ids: [pedido.id], decisao: 'autorizar' })
    assert.equal((await notas(10, 15)).status, 200)
  })

  it('docentes novos chegam ao Comandante, que verifica a lista', async () => {
    const antes = (await cmd.get('/api/admin/academico/docentes-verificacao')).body
    const prof = antes.find((d) => d.email === 'prof@esgfaa.gov.ao')
    assert.equal(prof.verificadoEm, null)
    assert.deepEqual(prof.docencias.map((d) => d.cadeira.codigo), ['EST101'])
    assert.ok((await cmd.get('/api/admin/academico/pendentes')).body.docentesPorVerificar >= 1)
    assert.equal((await sec.post('/api/admin/academico/docentes-verificacao').send({ ids: [prof.id] })).status, 403)
    assert.equal((await cmd.post('/api/admin/academico/docentes-verificacao').send({ ids: [prof.id] })).body.verificados, 1)
    const depois = (await cmd.get('/api/admin/academico/docentes-verificacao')).body.find((d) => d.id === prof.id)
    assert.ok(depois.verificadoEm && depois.verificadoPor)
  })
})
