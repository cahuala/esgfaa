import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, relogioFalso } from '../apoio/ambiente.js'

const NOVA = 'Portal2026segura'

describe('livro e lição: capítulos com índice; lição guiada pelo servidor, com perguntas, saltos e nota', () => {
  let amb, cadeira
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
    contas.ana = (await amb.registarEMatricular(sec(), turma.id, { nome: 'Estudante ana Teste', email: 'ana@esgfaa.gov.ao' })).body
    cadeira = (await sec().post(`/api/admin/academico/turmas/${turma.id}/cadeiras`).send({ codigo: 'EST101', nome: 'Estratégia' })).body
    await sec().put(`/api/admin/academico/cadeiras/${cadeira.id}/docentes`).send({ docentes: [{ docenteId: contas.prof.id, papel: 'regente' }] })
    for (const k of ['prof', 'prof2', 'ana']) {
      const email = `${k}@esgfaa.gov.ao`
      const r = await amb.http().post('/api/portal/entrar').send({ email, senha: amb.senhaInicial(email) })
      tokens[k] = (await amb.com(r.body.token).put('/api/portal/eu/senha').send({ atual: amb.senhaInicial(email), nova: NOVA })).body.token
    }
  })
  after(() => amb.fechar())

  it('livro: começa com um capítulo; o docente escreve os capítulos e o estudante lê-os', async () => {
    const l = await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/materiais`).send({ tipo: 'livro', titulo: 'Manual de planeamento' })
    assert.equal(l.status, 201, l.body.erro)
    assert.equal(l.body.estrutura.length, 1)
    const capitulos = [
      { titulo: 'Introdução', conteudo: '<p>O que é planear.</p><script>alert(1)</script>' },
      { titulo: 'A missão', conteudo: '<h2>Análise</h2><p>Tarefas explícitas e implícitas.</p>' },
      { titulo: 'Tarefas implícitas', conteudo: '<p>Exemplos.</p>', sub: true },
    ]
    const r = await portal('prof').put(`/api/portal/materiais/${l.body.id}`).send({ estrutura: capitulos })
    assert.equal(r.status, 200, r.body.erro)
    assert.equal((await portal('prof').put(`/api/portal/materiais/${l.body.id}`).send({ estrutura: [] })).status, 400)
    const m = (await portal('ana').get(`/api/portal/cadeiras/${cadeira.id}`)).body.materiais.find((x) => x.id === l.body.id)
    assert.deepEqual(m.estrutura.map((x) => [x.titulo, x.sub]), [['Introdução', false], ['A missão', false], ['Tarefas implícitas', true]])
    assert.ok(!m.estrutura[0].conteudo.includes('<script'), 'o HTML é filtrado')
  })

  it('lição: o estudante não vê as respostas; o servidor decide a página seguinte; a primeira resposta conta', async () => {
    const paginas = [
      { id: 'p1', titulo: 'A análise da missão', conteudo: '<p>Começa pelas tarefas.</p>' },
      { id: 'p2', titulo: 'Verificação', conteudo: '<p>Responda.</p>', pergunta: { enunciado: 'Que tarefas se identificam primeiro?', opcoes: [
        { texto: 'As implícitas', correta: false, resposta: 'Ainda não: reveja a página anterior.', salto: 'p1' },
        { texto: 'As explícitas', correta: true, resposta: 'Certo: estão escritas na missão.', salto: 'seguinte' },
      ] } },
      { id: 'p3', titulo: 'Conclusão', conteudo: '<p>Fim.</p>' },
    ]
    assert.equal((await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/materiais`).send({ tipo: 'licao', titulo: 'Má', estrutura: [{ id: 'a', titulo: 'x', pergunta: { enunciado: 'Pergunta?', opcoes: [{ texto: 'a' }, { texto: 'b' }] } }] })).status, 400) // sem opção certa
    const l = await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/materiais`).send({ tipo: 'licao', titulo: 'Lição: análise da missão', estrutura: paginas })
    assert.equal(l.status, 201, l.body.erro)
    const id = l.body.id

    const vista = JSON.stringify((await portal('ana').get(`/api/portal/cadeiras/${cadeira.id}`)).body.materiais.find((x) => x.id === id))
    for (const segredo of ['correta', 'salto', 'reveja a página', 'estão escritas']) assert.ok(!vista.includes(segredo), segredo)
    assert.equal((await portal('ana').put(`/api/portal/materiais/${id}/conclusao`).send({ concluido: true })).status, 409) // conclui-se chegando ao fim

    let e = (await portal('ana').get(`/api/portal/materiais/${id}/licao`)).body
    assert.equal(e.pagina, 'p1')
    assert.ok(!JSON.stringify(e.paginas).includes('correta'))
    assert.equal((await portal('ana').post(`/api/portal/materiais/${id}/licao/resposta`).send({ paginaId: 'p1', opcao: 0 })).status, 400) // sem pergunta
    assert.equal((await portal('ana').post(`/api/portal/materiais/${id}/licao/avancar`).send({ paginaId: 'p2' })).status, 409) // não salta
    e = (await portal('ana').post(`/api/portal/materiais/${id}/licao/avancar`).send({ paginaId: 'p1' })).body
    assert.equal(e.pagina, 'p2')
    assert.equal((await portal('ana').post(`/api/portal/materiais/${id}/licao/avancar`).send({ paginaId: 'p2' })).status, 400) // tem de responder
    // errada: volta à página 1 com o comentário; depois certa
    let r = (await portal('ana').post(`/api/portal/materiais/${id}/licao/resposta`).send({ paginaId: 'p2', opcao: 0 })).body
    assert.deepEqual([r.certa, r.resposta, r.pagina], [false, 'Ainda não: reveja a página anterior.', 'p1'])
    await portal('ana').post(`/api/portal/materiais/${id}/licao/avancar`).send({ paginaId: 'p1' })
    r = (await portal('ana').post(`/api/portal/materiais/${id}/licao/resposta`).send({ paginaId: 'p2', opcao: 1 })).body
    assert.deepEqual([r.certa, r.pagina], [true, 'p3'])
    e = (await portal('ana').post(`/api/portal/materiais/${id}/licao/avancar`).send({ paginaId: 'p3' })).body
    assert.deepEqual([e.concluida, e.nota, e.pagina], [true, 0, null]) // a primeira resposta estava errada
    const progresso = (await portal('ana').get(`/api/portal/cadeiras/${cadeira.id}/progresso`)).body
    assert.equal(progresso.itens.find((x) => x.tipo === 'material' && x.id === id).feita, true)

    // recomeçar: desta vez certa à primeira → 20; fica a melhor nota
    e = (await portal('ana').post(`/api/portal/materiais/${id}/licao/recomecar`)).body
    assert.equal(e.pagina, 'p1')
    await portal('ana').post(`/api/portal/materiais/${id}/licao/avancar`).send({ paginaId: 'p1' })
    await portal('ana').post(`/api/portal/materiais/${id}/licao/resposta`).send({ paginaId: 'p2', opcao: 1 })
    e = (await portal('ana').post(`/api/portal/materiais/${id}/licao/avancar`).send({ paginaId: 'p3' })).body
    assert.deepEqual([e.nota, e.melhorNota, e.visitas], [20, 20, 2])

    const res = (await portal('prof').get(`/api/portal/materiais/${id}/licao/resultados`)).body
    assert.deepEqual([res[0].estudante.nome, res[0].concluida, res[0].melhorNota], ['Estudante ana Teste', true, 20])
    assert.equal((await portal('prof2').get(`/api/portal/materiais/${id}/licao/resultados`)).status, 404)
    assert.equal((await portal('prof').get(`/api/portal/materiais/${id}/licao`)).status, 403) // o docente não faz a lição
  })
})
