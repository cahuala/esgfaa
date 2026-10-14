import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, relogioFalso } from '../apoio/ambiente.js'

const NOVA = 'Portal2026segura'
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')

describe('restrições de acesso, conclusão da cadeira e certificado', () => {
  let amb, relogio, cadeira
  const contas = {}
  const tokens = {}
  const portal = (quem) => amb.com(tokens[quem])
  const restringir = (corpo) => portal('prof').put('/api/portal/atividades/restricoes').send(corpo)
  const vista = async (quem) => (await portal(quem).get(`/api/portal/cadeiras/${cadeira.id}`)).body

  before(async () => {
    relogio = relogioFalso('2026-11-09T09:00:00Z')
    amb = await criarAmbiente({ relogio })
    const admin = await amb.entrar()
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Estado-Maior' })
    const s = await amb.criarUtilizador('secretaria')
    const sec = () => amb.com(s.token)
    const turma = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM A' })).body
    contas.prof = (await sec().post('/api/admin/academico/contas').send({ tipo: 'docente', nome: 'Docente Prof Teste', email: 'prof@esgfaa.gov.ao' })).body
    for (const k of ['ana', 'bruno']) contas[k] = (await sec().post(`/api/admin/academico/turmas/${turma.id}/matricula-nova`).send({ nome: `Estudante ${k} Teste`, email: `${k}@esgfaa.gov.ao` })).body
    cadeira = (await sec().post(`/api/admin/academico/turmas/${turma.id}/cadeiras`).send({ codigo: 'EST101', nome: 'Estratégia' })).body
    await sec().put(`/api/admin/academico/cadeiras/${cadeira.id}/docentes`).send({ docentes: [{ docenteId: contas.prof.id, papel: 'regente' }] })
    for (const k of ['prof', 'ana', 'bruno']) {
      const email = `${k}@esgfaa.gov.ao`
      const r = await amb.http().post('/api/portal/entrar').send({ email, senha: email })
      tokens[k] = (await amb.com(r.body.token).put('/api/portal/eu/senha').send({ atual: email, nova: NOVA })).body.token
    }
  })
  after(() => amb.fechar())

  it('escondida, data de abertura e condições com nota mínima', async () => {
    const leitura = (await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/materiais`).field('titulo', 'Leitura base').field('tipo', 'ligacao').field('url', 'https://example.org/l')).body
    const doc = (await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/materiais`).field('titulo', 'Apontamentos').field('tipo', 'ficheiro')
      .attach('ficheiro', PDF, { filename: 'apontamentos.pdf', contentType: 'application/pdf' })).body
    const ensaio = (await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/trabalhos`).send({ titulo: 'Ensaio', prazo: '2026-11-30T23:59:00Z' })).body
    const final = (await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/trabalhos`).send({ titulo: 'Trabalho final', prazo: '2026-12-15T23:59:00Z' })).body

    // validação
    assert.equal((await restringir({ tipo: 'trabalho', id: final.id, requisitos: [{ tipo: 'trabalho', id: final.id }] })).status, 400) // de si própria
    assert.equal((await restringir({ tipo: 'trabalho', id: final.id, requisitos: [{ tipo: 'material', id: leitura.id, notaMinima: 10 }] })).status, 400) // material sem nota
    assert.equal((await restringir({ tipo: 'trabalho', id: final.id, requisitos: [{ tipo: 'trabalho', id: 99999 }] })).status, 400)
    assert.equal((await portal('ana').put('/api/portal/atividades/restricoes').send({ tipo: 'trabalho', id: final.id, visivel: false })).status, 403)

    // escondida: desaparece para o estudante e o ficheiro deixa de abrir
    const esc = await restringir({ tipo: 'material', id: doc.id, visivel: false })
    assert.equal(esc.status, 200, JSON.stringify(esc.body))
    assert.ok(!(await vista('ana')).materiais.some((m) => m.id === doc.id))
    assert.ok((await vista('prof')).materiais.some((m) => m.id === doc.id))
    assert.equal((await portal('ana').get(`/api/portal/ficheiros/${doc.ficheiroId}`)).status, 404)
    assert.equal((await portal('prof').get(`/api/portal/ficheiros/${doc.ficheiroId}`)).status, 200)
    await restringir({ tipo: 'material', id: doc.id, visivel: true })
    assert.equal((await portal('ana').get(`/api/portal/ficheiros/${doc.ficheiroId}`)).status, 200)

    // data de abertura: aparece fechada, com o motivo, e não aceita entregas
    await restringir({ tipo: 'trabalho', id: ensaio.id, disponivelDe: '2026-11-10T08:00:00Z' })
    const fechado = (await vista('ana')).trabalhos.find((t) => t.id === ensaio.id)
    assert.equal(fechado.bloqueio[0].tipo, 'data')
    const cedo = await portal('ana').post(`/api/portal/trabalhos/${ensaio.id}/entrega`).send({ texto: 'x' })
    assert.equal(cedo.status, 409)
    assert.match(cedo.body.erro, /ainda não está disponível/)
    relogio.avancar(24 * 60)
    assert.equal((await vista('ana')).trabalhos.find((t) => t.id === ensaio.id).bloqueio, null)

    // condições: concluir a leitura e ter pelo menos 12 no ensaio
    await restringir({ tipo: 'trabalho', id: final.id, requisitos: [{ tipo: 'material', id: leitura.id }, { tipo: 'trabalho', id: ensaio.id, notaMinima: '12' }] })
    let f = (await vista('ana')).trabalhos.find((t) => t.id === final.id)
    assert.deepEqual(f.bloqueio.map((m) => m.titulo), ['Leitura base', 'Ensaio'])
    await portal('ana').put(`/api/portal/materiais/${leitura.id}/conclusao`).send({ concluido: true })
    const e = (await portal('ana').post(`/api/portal/trabalhos/${ensaio.id}/entrega`).attach('ficheiro', PDF, { filename: 'ensaio.pdf', contentType: 'application/pdf' })).body
    await portal('prof').put(`/api/portal/entregas/${e.id}`).send({ nota: 10 })
    f = (await vista('ana')).trabalhos.find((t) => t.id === final.id)
    assert.deepEqual(f.bloqueio.map((m) => [m.titulo, m.notaMinima]), [['Ensaio', 12]])
    assert.equal((await portal('ana').post(`/api/portal/trabalhos/${final.id}/entrega`).send({ texto: 'x' })).status, 409)
    await portal('prof').put(`/api/portal/entregas/${e.id}`).send({ nota: 14 })
    assert.equal((await vista('ana')).trabalhos.find((t) => t.id === final.id).bloqueio, null)
    // o colega continua com tudo por cumprir
    assert.equal((await vista('bruno')).trabalhos.find((t) => t.id === final.id).bloqueio.length, 2)
  })

  it('questionário fechado por data; capítulo com data de abertura', async () => {
    const q = (await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/questionarios`).send({ titulo: 'Teste rápido', duracao: 0, tentativas: 1 })).body
    await portal('prof').post(`/api/portal/questionarios/${q.id}/perguntas`).send({ tipo: 'vf', enunciado: 'A SADC tem sede em Gaborone.', correta: 'verdadeiro' })
    await portal('prof').put(`/api/portal/questionarios/${q.id}`).send({ publicado: true })
    const cap = (await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/secoes`).send({ titulo: 'Capítulo 2', disponivelDe: '2026-12-01T08:00:00Z' })).body
    assert.ok(cap.disponivelDe)
    assert.equal((await portal('prof').put('/api/portal/atividades/capitulo').send({ tipo: 'questionario', id: q.id, secaoId: cap.id })).status, 204)
    const v = await vista('ana')
    assert.ok(v.questionarios.find((x) => x.id === q.id).bloqueio)
    assert.equal(v.secoes.find((s) => s.id === cap.id).fechado, true)
    assert.equal((await portal('ana').post(`/api/portal/questionarios/${q.id}/tentativas`)).status, 409)
    assert.equal((await portal('ana').get(`/api/portal/questionarios/${q.id}`)).status, 409)
    await restringir({ tipo: 'questionario', id: q.id, visivel: false })
    assert.equal((await portal('ana').get(`/api/portal/questionarios/${q.id}`)).status, 404)
    await portal('prof').delete(`/api/portal/questionarios/${q.id}`)
    await portal('prof').delete(`/api/portal/secoes/${cap.id}`)
  })

  it('conclusão a 100% dá certificado, verificável publicamente', async () => {
    const antes = (await portal('bruno').get(`/api/portal/cadeiras/${cadeira.id}/conclusao`)).body
    assert.equal(antes.concluida, false)
    assert.equal((await portal('bruno').post(`/api/portal/cadeiras/${cadeira.id}/certificado`)).status, 409)
    assert.equal((await portal('prof').get(`/api/portal/cadeiras/${cadeira.id}/conclusao`)).status, 403)

    // a Ana conclui tudo o que falta
    const c0 = (await portal('ana').get(`/api/portal/cadeiras/${cadeira.id}/conclusao`)).body
    const v = await vista('ana')
    for (const m of v.materiais) await portal('ana').put(`/api/portal/materiais/${m.id}/conclusao`).send({ concluido: true })
    for (const t of v.trabalhos.filter((x) => !x.entrega)) await portal('ana').post(`/api/portal/trabalhos/${t.id}/entrega`).attach('ficheiro', PDF, { filename: 'final.pdf', contentType: 'application/pdf' })
    const c = (await portal('ana').get(`/api/portal/cadeiras/${cadeira.id}/conclusao`)).body
    assert.ok(c.feitas > c0.feitas)
    assert.deepEqual([c.concluida, c.percentagem, c.certificado], [true, 100, null])

    const cert = await portal('ana').post(`/api/portal/cadeiras/${cadeira.id}/certificado`)
    assert.equal(cert.status, 201, cert.body.erro)
    assert.match(cert.body.codigo, /^[A-Z0-9]{12}$/)
    assert.deepEqual([cert.body.estudante, cert.body.cadeira], ['Estudante ana Teste', 'Estratégia'])
    assert.equal((await portal('ana').get(`/api/portal/cadeiras/${cadeira.id}/conclusao`)).body.certificado.codigo, cert.body.codigo)
    // emitir outra vez devolve o mesmo
    assert.equal((await portal('ana').post(`/api/portal/cadeiras/${cadeira.id}/certificado`)).body.codigo, cert.body.codigo)

    const codigo = cert.body.codigo
    const pub = await amb.http().get(`/api/publico/certificados/${codigo.slice(0, 4)}-${codigo.slice(4, 8)}-${codigo.slice(8).toLowerCase()}`)
    assert.equal(pub.status, 200, pub.body.erro)
    assert.deepEqual([pub.body.estudante, pub.body.cadeira, pub.body.codigoCadeira], ['Estudante ana Teste', 'Estratégia', 'EST101'])
    assert.equal((await amb.http().get('/api/publico/certificados/AAAAAAAAAAAA')).status, 404)
    assert.equal((await amb.http().get('/api/publico/certificados/x')).status, 404)
  })
})
