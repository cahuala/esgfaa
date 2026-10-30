import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, relogioFalso } from '../apoio/ambiente.js'

const NOVA = 'Portal2026segura'
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')

describe('livro de notas: componentes da pauta calculadas a partir das atividades', () => {
  let amb, relogio, sec, cadeira, outra
  const contas = {}
  const tokens = {}
  const portal = (quem) => amb.com(tokens[quem])
  const linha = (pauta, quem) => pauta.linhas.find((l) => l.estudante.id === contas[quem].id)

  before(async () => {
    relogio = relogioFalso('2026-11-09T09:00:00Z')
    amb = await criarAmbiente({ relogio })
    const admin = await amb.entrar()
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Estado-Maior' })
    const s = await amb.criarUtilizador('administrador')
    sec = () => amb.com(s.token)
    const turma = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM A' })).body
    contas.prof = (await sec().post('/api/admin/academico/contas').send({ tipo: 'docente', nome: 'Docente Prof Teste', email: 'prof@esgfaa.gov.ao' })).body
    for (const k of ['ana', 'bruno']) contas[k] = (await amb.registarEMatricular(sec(), turma.id, { nome: `Estudante ${k} Teste`, email: `${k}@esgfaa.gov.ao` })).body
    cadeira = (await sec().post(`/api/admin/academico/turmas/${turma.id}/cadeiras`).send({ codigo: 'EST101', nome: 'Estratégia' })).body
    outra = (await sec().post(`/api/admin/academico/turmas/${turma.id}/cadeiras`).send({ codigo: 'LOG101', nome: 'Logística' })).body
    for (const c of [cadeira, outra]) await sec().put(`/api/admin/academico/cadeiras/${c.id}/docentes`).send({ docentes: [{ docenteId: contas.prof.id, papel: 'regente' }] })
    for (const k of ['prof', 'ana', 'bruno']) {
      const email = `${k}@esgfaa.gov.ao`
      const r = await amb.http().post('/api/portal/entrar').send({ email, senha: amb.senhaInicial(email) })
      tokens[k] = (await amb.com(r.body.token).put('/api/portal/eu/senha').send({ atual: amb.senhaInicial(email), nova: NOVA })).body.token
    }
  })
  after(() => amb.fechar())

  it('a 1.ª prova = 60 % do ensaio + 40 % do teste; zeros depois dos prazos; não se escreve à mão', async () => {
    const t = (await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/trabalhos`).send({ titulo: 'Ensaio', prazo: '2026-11-12T23:59:00Z' })).body
    const q = (await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/questionarios`).send({ titulo: 'Teste', fecha: '2026-11-13T23:59:00Z' })).body
    await portal('prof').post(`/api/portal/questionarios/${q.id}/perguntas`).send({ tipo: 'vf', enunciado: 'Clausewitz escreveu "Da Guerra".', correta: 'verdadeiro' })
    await portal('prof').put(`/api/portal/questionarios/${q.id}`).send({ publicado: true })
    const tOutra = (await portal('prof').post(`/api/portal/cadeiras/${outra.id}/trabalhos`).send({ titulo: 'De outra cadeira', prazo: '2026-11-12T23:59:00Z' })).body

    const url = `/api/portal/cadeiras/${cadeira.id}/pauta`
    assert.equal((await portal('prof').put(`${url}/composicao`).send({ componente: 'p1', itens: [{ tipo: 'trabalho', id: tOutra.id }] })).status, 400)
    assert.equal((await portal('ana').put(`${url}/composicao`).send({ componente: 'p1', itens: null })).status, 403)
    const def = await portal('prof').put(`${url}/composicao`).send({ componente: 'p1', itens: [{ tipo: 'trabalho', id: t.id, peso: 60 }, { tipo: 'questionario', id: q.id, peso: 40 }] })
    assert.equal(def.status, 200, def.body.erro)
    assert.deepEqual(Object.keys(def.body.composicoes), ['p1'])
    assert.equal(def.body.atividades.length, 2)
    assert.equal(linha(def.body, 'ana').p1, null) // ainda sem notas

    // a Ana entrega e é corrigida (15) e faz o teste (20): 0,6 × 15 + 0,4 × 20 = 17
    const e = (await portal('ana').post(`/api/portal/trabalhos/${t.id}/entrega`).attach('ficheiro', PDF, { filename: 'e.pdf', contentType: 'application/pdf' })).body
    await portal('prof').put(`/api/portal/entregas/${e.id}`).send({ nota: 15 })
    const tent = (await portal('ana').post(`/api/portal/questionarios/${q.id}/tentativas`)).body
    await portal('ana').post(`/api/portal/tentativas/${tent.id}/entrega`).send({ respostas: { [tent.perguntas[0].id]: [0] } })
    let p = (await portal('prof').get(url)).body
    assert.equal(linha(p, 'ana').p1, 17)
    assert.equal(linha(p, 'bruno').p1, null) // ainda dentro dos prazos

    // escrever à mão numa componente calculada não muda nada
    await portal('prof').put(url).send({ linhas: [{ estudanteId: contas.ana.id, p1: 3, p2: 12 }, { estudanteId: contas.bruno.id, p2: 11 }] })
    p = (await portal('prof').get(url)).body
    assert.deepEqual([linha(p, 'ana').p1, linha(p, 'ana').p2], [17, 12])

    // passaram os prazos: o Bruno não entregou nem fez o teste → 0
    relogio.avancar(6 * 24 * 60)
    p = (await portal('prof').get(url)).body
    assert.equal(linha(p, 'bruno').p1, 0)

    // o estudante vê no boletim depois de publicada
    await portal('prof').put(`${url}/publicacao`).send({ publicadas: ['p1', 'p2'] })
    const boletim = (await portal('ana').get('/api/portal/notas')).body.find((l) => l.cadeira.id === cadeira.id)
    assert.deepEqual([boletim.p1, boletim.p2, boletim.mac], [17, 12, 14.5])

    // retirar a composição: a 1.ª prova volta a ser escrita à mão (fica o último valor)
    p = (await portal('prof').put(`${url}/composicao`).send({ componente: 'p1', itens: null })).body
    assert.deepEqual(p.composicoes, {})
    // a 1.ª prova já está publicada: mudar a nota da Ana pede autorização ao Comandante
    assert.equal((await portal('prof').put(url).send({ linhas: [{ estudanteId: contas.ana.id, p1: 18, p2: 12 }] })).status, 409)
    assert.equal(linha((await portal('prof').get(url)).body, 'ana').p1, 17)

    // a Administração Escolar também define composições
    assert.equal((await sec().put(`/api/admin/academico/cadeiras/${cadeira.id}/pauta/composicao`).send({ componente: 'p2', itens: [{ tipo: 'trabalho', id: t.id }] })).status, 200)
  })
})
