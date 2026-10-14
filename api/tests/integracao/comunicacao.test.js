import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, relogioFalso } from '../apoio/ambiente.js'

const NOVA = 'Portal2026segura'
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')

describe('portal: notificações, e-mails, lembretes e mensagens', () => {
  let amb, relogio, sec, cadeira, outra
  const contas = {}
  const tokens = {}
  const portal = (quem) => amb.com(tokens[quem])
  const caixa = async (quem) => (await portal(quem).get('/api/portal/notificacoes')).body
  const correio = () => amb.contentor.correio
  const esvaziar = () => amb.contentor.servicos.comunicacao.esvaziar()

  before(async () => {
    relogio = relogioFalso('2026-11-09T09:00:00Z')
    amb = await criarAmbiente({ relogio })
    const admin = await amb.entrar()
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Estado-Maior' })
    const s = await amb.criarUtilizador('secretaria')
    sec = () => amb.com(s.token)
    const turma = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM A' })).body
    const turmaB = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM B' })).body
    contas.prof = (await sec().post('/api/admin/academico/contas').send({ tipo: 'docente', nome: 'Docente Prof Teste', email: 'prof@esgfaa.gov.ao' })).body
    for (const k of ['ana', 'bruno']) contas[k] = (await sec().post(`/api/admin/academico/turmas/${turma.id}/matricula-nova`).send({ nome: `Estudante ${k} Teste`, email: `${k}@esgfaa.gov.ao` })).body
    contas.carla = (await sec().post(`/api/admin/academico/turmas/${turmaB.id}/matricula-nova`).send({ nome: 'Estudante carla Teste', email: 'carla@esgfaa.gov.ao' })).body
    cadeira = (await sec().post(`/api/admin/academico/turmas/${turma.id}/cadeiras`).send({ codigo: 'EST101', nome: 'Estratégia', horas: 60 })).body
    outra = (await sec().post(`/api/admin/academico/turmas/${turmaB.id}/cadeiras`).send({ codigo: 'LOG101', nome: 'Logística' })).body
    await sec().put(`/api/admin/academico/cadeiras/${cadeira.id}/docentes`).send({ docentes: [{ docenteId: contas.prof.id, papel: 'regente' }] })
    for (const k of ['prof', 'ana', 'bruno', 'carla']) {
      const email = `${k}@esgfaa.gov.ao`
      const r = await amb.http().post('/api/portal/entrar').send({ email, senha: email })
      tokens[k] = (await amb.com(r.body.token).put('/api/portal/eu/senha').send({ atual: email, nova: NOVA })).body.token
    }
    void outra
  })
  after(() => amb.fechar())

  it('material novo: notifica os estudantes da turma (no portal e por e-mail), não o docente nem outras turmas', async () => {
    const antes = correio().enviados.length
    await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/materiais`).send({ titulo: 'Sebenta 1', tipo: 'ligacao', url: 'https://example.org/s1' })
    await esvaziar()
    const ana = await caixa('ana')
    assert.equal(ana.naoLidas, 1)
    assert.equal(ana.lista[0].titulo, 'Novo material em Estratégia')
    assert.equal(ana.lista[0].ligacao, `/cadeiras/${cadeira.id}`)
    assert.equal((await caixa('carla')).naoLidas, 0)
    assert.equal((await caixa('prof')).naoLidas, 0)
    const novos = correio().enviados.slice(antes)
    assert.deepEqual(novos.map((m) => m.para).sort(), ['ana@esgfaa.gov.ao', 'bruno@esgfaa.gov.ao'])
    assert.match(novos[0].assunto, /\[ESG\] Novo material/)
    assert.match(novos[0].html, /Sebenta 1/)
  })

  it('capítulo escondido não gera notificações; o e-mail escapa o HTML dos títulos', async () => {
    const cap = (await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/secoes`).send({ titulo: 'Em preparação', visivel: false })).body
    const antes = (await caixa('ana')).naoLidas
    await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/materiais`).send({ titulo: 'Rascunho', tipo: 'ligacao', url: 'https://example.org/r', secaoId: cap.id })
    assert.equal((await caixa('ana')).naoLidas, antes)

    const n = correio().enviados.length
    await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/avisos`).send({ titulo: '<script>x</script> Aula', texto: 'Amanhã às 8h.' })
    await esvaziar()
    const html = correio().enviados.slice(n).map((m) => m.html).join('')
    assert.ok(html.includes('&lt;script&gt;') && !html.includes('<script>'))
  })

  it('correção, notas publicadas e respostas no fórum chegam a quem interessa', async () => {
    const t = (await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/trabalhos`).send({ titulo: 'Ensaio', prazo: '2026-11-20T23:59:00Z' })).body
    const e = (await portal('ana').post(`/api/portal/trabalhos/${t.id}/entrega`).attach('ficheiro', PDF, { filename: 'e.pdf', contentType: 'application/pdf' })).body
    await portal('prof').put(`/api/portal/entregas/${e.id}`).send({ nota: 15 })
    assert.equal((await caixa('ana')).lista[0].titulo, 'Trabalho corrigido: Ensaio')
    assert.notEqual((await caixa('bruno')).lista[0].titulo, 'Trabalho corrigido: Ensaio')

    await portal('prof').put(`/api/portal/cadeiras/${cadeira.id}/pauta`).send({ linhas: [{ estudanteId: contas.ana.id, p1: 14 }] })
    await portal('prof').put(`/api/portal/cadeiras/${cadeira.id}/pauta/publicacao`).send({ publicadas: ['p1'] })
    assert.equal((await caixa('bruno')).lista[0].titulo, 'Notas publicadas: 1.ª Prova')

    const topico = (await portal('ana').post(`/api/portal/cadeiras/${cadeira.id}/forum`).send({ titulo: 'Dúvida do ensaio', texto: 'Quantas páginas?' })).body
    await portal('prof').post(`/api/portal/forum/${topico.id}/respostas`).send({ texto: 'Dez.' })
    assert.match((await caixa('ana')).lista[0].titulo, /respondeu em "Dúvida do ensaio"/)
    assert.equal((await caixa('prof')).lista.filter((x) => x.tipo === 'forum').length, 0) // quem respondeu não é avisado
  })

  it('marcar como lidas, resumo do cabeçalho e preferência de e-mail', async () => {
    const r = await portal('ana').get('/api/portal/eu/avisos')
    assert.ok(r.body.notificacoes > 0)
    const primeira = (await caixa('ana')).lista[0].id
    assert.equal((await portal('ana').put('/api/portal/notificacoes/lidas').send({ ids: [primeira] })).status, 200)
    assert.equal((await portal('ana').put('/api/portal/notificacoes/lidas').send({ todas: true })).body.naoLidas, 0)
    // não mexe nas notificações de outra pessoa
    assert.ok((await caixa('bruno')).naoLidas > 0)

    assert.equal((await portal('ana').put('/api/portal/eu/preferencias').send({ notificarEmail: false })).body.notificarEmail, false)
    const n = correio().enviados.length
    await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/avisos`).send({ titulo: 'Sem e-mail para a Ana', texto: 'Teste.' })
    await esvaziar()
    const para = correio().enviados.slice(n).map((m) => m.para)
    assert.ok(!para.includes('ana@esgfaa.gov.ao') && para.includes('bruno@esgfaa.gov.ao'))
    assert.equal((await caixa('ana')).lista[0].titulo, 'Aviso em Estratégia: Sem e-mail para a Ana') // no portal continua
  })

  it('lembrete de prazo 24 h antes, só a quem não entregou e só uma vez', async () => {
    const t = (await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/trabalhos`).send({ titulo: 'Relatório curto', prazo: '2026-11-09T20:00:00Z' })).body
    await portal('ana').post(`/api/portal/trabalhos/${t.id}/entrega`).attach('ficheiro', PDF, { filename: 'r.pdf', contentType: 'application/pdf' })
    const s = amb.contentor.servicos.comunicacao
    assert.equal(await s.lembrarPrazos(), 1)
    assert.match((await caixa('bruno')).lista[0].titulo, /^Faltam 11 h para entregar: Relatório curto/)
    assert.ok(!(await caixa('ana')).lista.some((x) => x.tipo === 'prazo'))
    assert.equal(await s.lembrarPrazos(), 0) // já lembrado
  })

  it('aviso geral da Administração Escolar e pedido pronto', async () => {
    await sec().post('/api/admin/academico/avisos').send({ titulo: 'Matrículas abertas', texto: 'Até dia 30.' })
    for (const k of ['ana', 'bruno', 'carla']) assert.equal((await caixa(k)).lista[0].titulo, 'Administração Escolar: Matrículas abertas')
    const p = (await portal('carla').post('/api/portal/pedidos').send({ tipo: 'Declaração de matrícula' })).body
    await sec().put(`/api/admin/academico/pedidos/${p.id}`).send({ estado: 'pronto', resposta: 'Pode levantar.' })
    assert.equal((await caixa('carla')).lista[0].titulo, 'O seu pedido "Declaração de matrícula" está pronto')
  })

  it('mensagens: só entre quem partilha uma cadeira; conversa, lidas e aviso ao destinatário', async () => {
    const contactos = (await portal('ana').get('/api/portal/contactos')).body
    assert.deepEqual(contactos.map((c) => c.nome), ['Docente Prof Teste', 'Estudante bruno Teste'])
    assert.equal((await portal('ana').post(`/api/portal/mensagens/${contas.carla.id}`).send({ texto: 'Olá' })).status, 404)
    assert.equal((await portal('ana').post(`/api/portal/mensagens/${contas.prof.id}`).send({ texto: '   ' })).status, 400)

    const m = await portal('ana').post(`/api/portal/mensagens/${contas.prof.id}`).send({ texto: 'Professor, posso entregar amanhã?' })
    assert.equal(m.status, 201, m.body.erro)
    assert.equal((await portal('prof').get('/api/portal/eu/avisos')).body.mensagens, 1)
    assert.equal((await caixa('prof')).lista[0].titulo, 'Nova mensagem de Estudante ana Teste')

    const conversas = (await portal('prof').get('/api/portal/mensagens')).body
    assert.deepEqual([conversas[0].pessoa.id, conversas[0].naoLidas], [contas.ana.id, 1])
    const conversa = (await portal('prof').get(`/api/portal/mensagens/${contas.ana.id}`)).body
    assert.deepEqual(conversa.mensagens.map((x) => [x.texto, x.minha]), [['Professor, posso entregar amanhã?', false]])
    assert.equal((await portal('prof').get('/api/portal/eu/avisos')).body.mensagens, 0) // ao abrir, ficam lidas
    await portal('prof').post(`/api/portal/mensagens/${contas.ana.id}`).send({ texto: 'Pode.' })
    assert.deepEqual((await portal('ana').get(`/api/portal/mensagens/${contas.prof.id}`)).body.mensagens.map((x) => x.minha), [true, false])
    // terceiros não leem a conversa
    assert.equal((await portal('carla').get(`/api/portal/mensagens/${contas.ana.id}`)).status, 404)
  })
})
