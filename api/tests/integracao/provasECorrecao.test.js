import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, relogioFalso } from '../apoio/ambiente.js'
import { pdfComTexto } from '../apoio/documentos.js'
import { validarAnotacoes } from '../../src/dominio/academico/atividades/anotacoes.js'

const NOVA = 'Portal2026segura'

describe('provas: palavra-passe, páginas só para a frente, lacunas, ordenar, comentário por nota e exceções; correção no PDF', () => {
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
    for (const k of ['ana', 'bruno']) contas[k] = (await amb.registarEMatricular(sec(), turma.id, { nome: `Estudante ${k} Teste`, email: `${k}@esgfaa.gov.ao` })).body
    contas.fora = (await sec().post('/api/admin/academico/contas').send({ tipo: 'estudante', nome: 'Estudante Fora Teste', email: 'fora@esgfaa.gov.ao' })).body
    cadeira = (await sec().post(`/api/admin/academico/turmas/${turma.id}/cadeiras`).send({ codigo: 'EST101', nome: 'Estratégia' })).body
    await sec().put(`/api/admin/academico/cadeiras/${cadeira.id}/docentes`).send({ docentes: [{ docenteId: contas.prof.id, papel: 'regente' }] })
    for (const k of ['prof', 'prof2', 'ana', 'bruno']) {
      const email = `${k}@esgfaa.gov.ao`
      const r = await amb.http().post('/api/portal/entrar').send({ email, senha: amb.senhaInicial(email) })
      tokens[k] = (await amb.com(r.body.token).put('/api/portal/eu/senha').send({ atual: amb.senhaInicial(email), nova: NOVA })).body.token
    }
  })
  after(() => amb.fechar())

  it('prova com palavra-passe, uma pergunta por página e só para a frente; lacunas e ordenar com crédito parcial', async () => {
    const q = (await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/questionarios`).send({
      titulo: 'Prova do capítulo 1', senha: 'KWANZA-26', porPagina: 1, sequencial: true, duracao: 0,
      comentarios: [{ minimo: 0, texto: 'Reveja o capítulo 1.' }, { minimo: 14, texto: 'Muito bem, siga para o capítulo 2.' }],
    })).body
    assert.ok(q.id, JSON.stringify(q))
    // só para a frente sem páginas não faz sentido
    assert.equal((await portal('prof').put(`/api/portal/questionarios/${q.id}`).send({ porPagina: 0 })).status, 400)
    let r = await portal('prof').post(`/api/portal/questionarios/${q.id}/perguntas`).send({ tipo: 'lacunas', enunciado: 'Complete.', pontos: 2, opcoes: { texto: 'A capital de Angola é [[Luanda]] e o rio mais longo é o [[Kwanza|Cuanza]].' } })
    assert.equal(r.status, 201, r.body.erro)
    assert.equal((await portal('prof').post(`/api/portal/questionarios/${q.id}/perguntas`).send({ tipo: 'lacunas', enunciado: 'Sem lacunas', opcoes: { texto: 'Não tem nada para preencher.' } })).status, 400)
    r = await portal('prof').post(`/api/portal/questionarios/${q.id}/perguntas`).send({ tipo: 'ordenar', enunciado: 'Ordene as fases do planeamento.', pontos: 3, opcoes: { itens: ['Receção da missão', 'Análise da missão', 'Modalidades de ação', 'Decisão'] } })
    assert.equal(r.status, 201, r.body.erro)
    r = await portal('prof').post(`/api/portal/questionarios/${q.id}/perguntas`).send({ tipo: 'curta', enunciado: 'Autor de "Da Guerra"?', opcoes: { respostas: ['Clausewitz'] } })
    assert.equal(r.status, 201)
    await portal('prof').put(`/api/portal/questionarios/${q.id}`).send({ publicado: true })

    // a palavra-passe nunca chega ao estudante (nem na lista, nem na cadeira, nem no questionário)
    for (const url of [`/api/portal/cadeiras/${cadeira.id}/questionarios`, `/api/portal/cadeiras/${cadeira.id}`, `/api/portal/questionarios/${q.id}`]) {
      const corpo = JSON.stringify((await portal('ana').get(url)).body)
      assert.ok(!corpo.includes('KWANZA-26'), url)
    }
    assert.equal((await portal('ana').get(`/api/portal/questionarios/${q.id}`)).body.pedeSenha, true)
    assert.equal((await portal('prof').get(`/api/portal/questionarios/${q.id}/edicao`)).body.senha, 'KWANZA-26')

    assert.equal((await portal('ana').post(`/api/portal/questionarios/${q.id}/tentativas`).send({})).status, 400)
    assert.equal((await portal('ana').post(`/api/portal/questionarios/${q.id}/tentativas`).send({ senha: 'errada' })).status, 400)
    const inicio = await portal('ana').post(`/api/portal/questionarios/${q.id}/tentativas`).send({ senha: 'KWANZA-26' })
    assert.equal(inicio.status, 201, inicio.body.erro)
    const t = inicio.body
    assert.equal(t.paginas.length, 3)
    assert.equal(t.sequencial, true)
    assert.ok(!JSON.stringify(t).includes('Luanda'), 'as respostas das lacunas não vão para o estudante')
    assert.equal(t.permutacoes, undefined)
    const [pLac, pOrd, pCurta] = t.paginas.map((ids) => t.perguntas.find((p) => p.id === ids[0]))
    assert.deepEqual(pLac.partes.map((x) => ('lacuna' in x ? '_' : 'texto')), ['texto', '_', 'texto', '_', 'texto'])
    assert.notDeepEqual(pOrd.itens.map((x) => x.texto), ['Receção da missão', 'Análise da missão', 'Modalidades de ação', 'Decisão'])

    // página 1: as lacunas (uma certa, sem contar acentos nem maiúsculas); a resposta da página 2 ainda não conta
    await portal('ana').put(`/api/portal/tentativas/${t.id}/respostas`).send({ respostas: { [pLac.id]: ['luanda', 'Zambeze'], [pCurta.id]: 'Clausewitz' } })
    assert.equal((await portal('ana').put(`/api/portal/tentativas/${t.id}/pagina`).send({ pagina: 2 })).status, 409) // não salta páginas
    assert.equal((await portal('ana').put(`/api/portal/tentativas/${t.id}/pagina`).send({ pagina: 1 })).status, 200)
    assert.equal((await portal('ana').put(`/api/portal/tentativas/${t.id}/pagina`).send({ pagina: 0 })).status, 409) // não volta atrás
    // página 2: a ordem certa (pelas posições mostradas); tentar mudar a página 1 não tem efeito
    const certa = ['Receção da missão', 'Análise da missão', 'Modalidades de ação', 'Decisão'].map((tx) => pOrd.itens.find((x) => x.texto === tx).i)
    await portal('ana').put(`/api/portal/tentativas/${t.id}/respostas`).send({ respostas: { [pLac.id]: ['Luanda', 'Kwanza'], [pOrd.id]: certa } })
    assert.equal((await portal('ana').put(`/api/portal/tentativas/${t.id}/pagina`).send({ pagina: 2 })).status, 200)
    const fim = await portal('ana').post(`/api/portal/tentativas/${t.id}/entrega`).send({ respostas: { [pLac.id]: ['Luanda', 'Kwanza'], [pOrd.id]: certa, [pCurta.id]: 'clausewitz' } })
    assert.equal(fim.status, 200, fim.body.erro)
    // 1 de 2 lacunas (1 pt) + ordem certa (3 pt) + curta (1 pt) = 5 de 6 → 16,67
    assert.equal(fim.body.nota, 16.67)
    assert.equal(fim.body.comentarioNota, 'Muito bem, siga para o capítulo 2.')
    const rev = (await portal('ana').get(`/api/portal/tentativas/${t.id}`)).body
    assert.deepEqual(rev.correcao.find((c) => c.perguntaId === pOrd.id).textos.dadas, ['Receção da missão', 'Análise da missão', 'Modalidades de ação', 'Decisão'])
  })

  it('exceções: outro fecho e mais tentativas só para um estudante da turma', async () => {
    const q = (await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/questionarios`).send({ titulo: 'Teste de ontem', abre: '2026-11-07T08:00:00Z', fecha: '2026-11-08T18:00:00Z', tentativas: 1 })).body
    await portal('prof').post(`/api/portal/questionarios/${q.id}/perguntas`).send({ tipo: 'vf', enunciado: 'A SADC tem sede em Gaborone.', correta: 'verdadeiro' })
    await portal('prof').put(`/api/portal/questionarios/${q.id}`).send({ publicado: true })
    assert.equal((await portal('bruno').post(`/api/portal/questionarios/${q.id}/tentativas`).send({})).status, 409) // já fechou

    assert.equal((await portal('prof').put(`/api/portal/questionarios/${q.id}/excecoes`).send({ estudanteId: contas.fora.id, fecha: '2026-11-12T18:00:00Z' })).status, 400) // não é da turma
    assert.equal((await portal('prof2').put(`/api/portal/questionarios/${q.id}/excecoes`).send({ estudanteId: contas.bruno.id, fecha: '2026-11-12T18:00:00Z' })).status, 404)
    assert.equal((await portal('prof').put(`/api/portal/questionarios/${q.id}/excecoes`).send({ estudanteId: contas.bruno.id })).status, 400) // nada a mudar
    const ex = await portal('prof').put(`/api/portal/questionarios/${q.id}/excecoes`).send({ estudanteId: contas.bruno.id, fecha: '2026-11-12T18:00:00Z', tentativas: 2, motivo: 'Missão de serviço' })
    assert.equal(ex.status, 200, ex.body.erro)
    assert.equal((await portal('prof').get(`/api/portal/questionarios/${q.id}/edicao`)).body.excecoes[0].estudante.nome, 'Estudante bruno Teste')

    // o Bruno vê-o aberto e faz duas tentativas; a Ana continua com ele fechado
    assert.equal((await portal('bruno').get(`/api/portal/questionarios/${q.id}`)).body.estado, 'aberto')
    assert.equal((await portal('ana').get(`/api/portal/questionarios/${q.id}`)).body.estado, 'fechado')
    for (let i = 0; i < 2; i++) {
      const t = await portal('bruno').post(`/api/portal/questionarios/${q.id}/tentativas`).send({})
      assert.equal(t.status, 201, t.body.erro)
      assert.equal(new Date(t.body.limite).toISOString(), '2026-11-12T18:00:00.000Z')
      await portal('bruno').post(`/api/portal/tentativas/${t.body.id}/entrega`).send({ respostas: {} })
    }
    assert.equal((await portal('bruno').post(`/api/portal/questionarios/${q.id}/tentativas`).send({})).status, 409)
    assert.equal((await portal('ana').post(`/api/portal/questionarios/${q.id}/tentativas`).send({})).status, 409)
    // retirar a exceção
    assert.equal((await portal('prof').delete(`/api/portal/questionarios/${q.id}/excecoes/${contas.bruno.id}`)).status, 204)
    assert.equal((await portal('bruno').get(`/api/portal/questionarios/${q.id}`)).body.estado, 'fechado')
  })

  it('correção no PDF: as anotações guardam-se com a correção e só sobre os ficheiros da entrega', async () => {
    const t = (await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/trabalhos`).field('titulo', 'Ensaio').field('prazo', '2026-11-20T23:59:00Z')).body
    const e = await portal('ana').post(`/api/portal/trabalhos/${t.id}/entrega`).attach('ficheiros', pdfComTexto('O meu ensaio sobre a defesa regional.'), { filename: 'ensaio.pdf', contentType: 'application/pdf' })
    assert.equal(e.status, 201, e.body.erro)
    const entregas = (await portal('prof').get(`/api/portal/trabalhos/${t.id}/entregas`)).body.linhas
    const minha = entregas.find((x) => x.estudante.id === contas.ana.id).entrega
    const fid = minha.ficheiros[0].id
    const anotacoes = { [fid]: [
      { pagina: 1, tipo: 'caneta', cor: '#e53917', pontos: [[10, 10], [40, 12]] },
      { pagina: 1, tipo: 'texto', cor: '#2f5fa8', x: 50, y: 80, texto: 'Desenvolva este ponto.' },
      { pagina: 1, tipo: 'certo', x: 300, y: 120 },
    ] }
    const r = await portal('prof').put(`/api/portal/entregas/${minha.id}`).field('nota', '14').field('anotacoes', JSON.stringify(anotacoes))
    assert.equal(r.status, 200, r.body.erro)
    const depois = (await portal('prof').get(`/api/portal/trabalhos/${t.id}/entregas`)).body.linhas.find((x) => x.estudante.id === contas.ana.id).entrega
    assert.equal(depois.anotacoes[fid].length, 3)
    assert.equal(depois.anotacoes[fid][2].cor, '#e53917') // sem cor válida: a cor por omissão
    // anotações sobre outro ficheiro, ou mal formadas, são recusadas
    assert.equal((await portal('prof').put(`/api/portal/entregas/${minha.id}`).field('nota', '14').field('anotacoes', JSON.stringify({ outro: [] }))).status, 400)
    assert.equal((await portal('prof').put(`/api/portal/entregas/${minha.id}`).field('nota', '14').field('anotacoes', JSON.stringify({ [fid]: [{ pagina: 0, tipo: 'certo', x: 1, y: 1 }] }))).status, 400)
  })

  it('validação das anotações (unidade)', () => {
    assert.throws(() => validarAnotacoes('{', ['a']), /inválidas/)
    assert.throws(() => validarAnotacoes({ a: [{ pagina: 1, tipo: 'caneta', pontos: [[1, 1]] }] }, ['a']), /Traço/)
    assert.throws(() => validarAnotacoes({ a: [{ pagina: 1, tipo: 'texto', x: 1, y: 1, texto: '  ' }] }, ['a']), /vazio/)
    assert.deepEqual(validarAnotacoes({ a: [{ pagina: 2, tipo: 'realce', cor: '#F2C200', x: 1, y: 2, w: 30, h: 8 }] }, ['a']), { a: [{ pagina: 2, tipo: 'realce', cor: '#F2C200', x: 1, y: 2, w: 30, h: 8 }] })
  })
})
