import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, relogioFalso } from '../apoio/ambiente.js'

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')
const NOVA = 'Portal2026segura'

describe('portal académico', () => {
  let amb, admin, secretaria, turmaId, outraTurmaId, cadeira, cadeiraOutra
  const contas = {}
  const tokens = {}
  const sec = () => amb.com(secretaria.token)
  const portal = (quem) => amb.com(tokens[quem])

  // entra com a palavra-passe inicial (o e-mail) e muda-a
  async function primeiraEntrada(email) {
    const r = await amb.http().post('/api/portal/entrar').send({ email, senha: email })
    assert.equal(r.status, 200, r.body.erro)
    assert.equal(r.body.deveMudarSenha, true)
    const m = await amb.com(r.body.token).put('/api/portal/eu/senha').send({ atual: email, nova: NOVA })
    assert.equal(m.status, 200, m.body.erro)
    return m.body.token
  }

  before(async () => {
    amb = await criarAmbiente({ relogio: relogioFalso('2026-10-13T10:00:00Z') })
    admin = await amb.entrar()
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Estado-Maior' })
    secretaria = await amb.criarUtilizador('secretaria')

    turmaId = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM 2026/2027' })).body.id
    outraTurmaId = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM B' })).body.id

    for (const [chave, tipo, nome] of [['prof', 'docente', 'Professor Teste Silva'], ['prof2', 'docente', 'Professora Outra Turma']]) {
      const r = await sec().post('/api/admin/academico/contas').send({ tipo, nome, email: `${chave}@esgfaa.gov.ao` })
      assert.equal(r.status, 201, r.body.erro)
      contas[chave] = r.body
    }
    for (const chave of ['ana', 'bruno']) {
      const r = await sec().post(`/api/admin/academico/turmas/${turmaId}/matricula-nova`).send({ nome: `Estudante ${chave} Teste`, email: `${chave}@esgfaa.gov.ao`, dados: { posto: 'Major' } })
      assert.equal(r.status, 201, r.body.erro)
      contas[chave] = r.body
    }
    contas.carla = (await sec().post(`/api/admin/academico/turmas/${outraTurmaId}/matricula-nova`).send({ nome: 'Estudante Carla Teste', email: 'carla@esgfaa.gov.ao' })).body

    cadeira = (await sec().post(`/api/admin/academico/turmas/${turmaId}/cadeiras`).send({ codigo: 'EST101', nome: 'Estratégia Militar', semestre: 1, horas: 90, docenteId: contas.prof.id })).body
    cadeiraOutra = (await sec().post(`/api/admin/academico/turmas/${outraTurmaId}/cadeiras`).send({ codigo: 'LOG101', nome: 'Logística', docenteId: contas.prof2.id })).body
    await sec().post(`/api/admin/academico/cadeiras/${cadeira.id}/horarios`).send({ diaSemana: 2, inicio: '08:00', fim: '10:00', sala: 'Anfiteatro' })

    for (const q of ['prof', 'prof2', 'ana', 'bruno', 'carla']) tokens[q] = await primeiraEntrada(`${q}@esgfaa.gov.ao`)
  })
  after(() => amb.fechar())

  it('contas: e-mail da Escola obrigatório, números automáticos, palavra-passe inicial é o e-mail', async () => {
    assert.match(contas.ana.numero, /^E2026-\d{4}$/)
    assert.match(contas.prof.numero, /^D2026-\d{4}$/)
    const fora = await sec().post('/api/admin/academico/contas').send({ tipo: 'estudante', nome: 'Pessoa de Fora', email: 'fora@gmail.com' })
    assert.equal(fora.status, 400)
    assert.equal((await sec().post('/api/admin/academico/contas').send({ tipo: 'estudante', nome: 'Duplicado Teste', email: 'ana@esgfaa.gov.ao' })).status, 409)
  })

  it('com a palavra-passe inicial só se pode mudá-la', async () => {
    const r = await sec().post('/api/admin/academico/contas').send({ tipo: 'estudante', nome: 'Novo Estudante', email: 'novo@esgfaa.gov.ao' })
    const t = (await amb.http().post('/api/portal/entrar').send({ email: 'novo@esgfaa.gov.ao', senha: 'novo@esgfaa.gov.ao' })).body.token
    assert.equal((await amb.com(t).get('/api/portal/eu')).status, 200)
    const bloqueado = await amb.com(t).get('/api/portal/cadeiras')
    assert.equal(bloqueado.status, 403)
    assert.equal(bloqueado.body.codigo, 'mudar_senha')
    // a nova não pode ser o e-mail nem fraca
    assert.equal((await amb.com(t).put('/api/portal/eu/senha').send({ atual: 'novo@esgfaa.gov.ao', nova: 'novo@esgfaa.gov.ao' })).status, 400)
    void r
  })

  it('sessões do portal e do painel não se misturam', async () => {
    assert.equal((await amb.com(admin).get('/api/portal/eu')).status, 401)
    assert.equal((await portal('ana').get('/api/admin/eu')).status, 401)
    assert.equal((await amb.http().post('/api/portal/entrar').send({ email: 'ana@esgfaa.gov.ao', senha: 'errada123x' })).status, 401)
  })

  it('o estudante vê as suas cadeiras e horário; não vê cadeiras de outras turmas', async () => {
    const lista = (await portal('ana').get('/api/portal/cadeiras')).body
    assert.deepEqual(lista.map((c) => c.codigo), ['EST101'])
    assert.equal((await portal('ana').get(`/api/portal/cadeiras/${cadeiraOutra.id}`)).status, 404)
    assert.equal((await portal('carla').get(`/api/portal/cadeiras/${cadeira.id}`)).status, 404)
    const horario = (await portal('ana').get('/api/portal/horario')).body
    assert.equal(horario[0].sala, 'Anfiteatro')
  })

  it('o docente publica materiais privados; só os inscritos os descarregam', async () => {
    const m = await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/materiais`)
      .field('titulo', 'Sebenta 1').field('topico', 'Semana 1').field('tipo', 'ficheiro')
      .attach('ficheiro', PDF, { filename: 'sebenta.pdf', contentType: 'application/pdf' })
    assert.equal(m.status, 201, m.body.erro)
    const ligacao = await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/materiais`).send({ titulo: 'Leitura', tipo: 'ligacao', url: 'javascript:alert(1)' })
    assert.equal(ligacao.status, 400)

    // outro docente não publica nesta cadeira; estudantes também não
    assert.equal((await portal('prof2').post(`/api/portal/cadeiras/${cadeira.id}/avisos`).send({ titulo: 'x', texto: 'yy' })).status, 404)
    assert.equal((await portal('ana').post(`/api/portal/cadeiras/${cadeira.id}/avisos`).send({ titulo: 'xx', texto: 'yy' })).status, 403)

    const detalhe = (await portal('ana').get(`/api/portal/cadeiras/${cadeira.id}`)).body
    const fid = detalhe.materiais[0].ficheiroId
    const ok = await portal('ana').get(`/api/portal/ficheiros/${fid}`)
    assert.equal(ok.status, 200)
    assert.match(ok.headers['content-disposition'], /attachment; filename="sebenta.pdf"/)
    assert.equal(ok.headers['cache-control'], 'private, no-store')
    assert.equal((await portal('carla').get(`/api/portal/ficheiros/${fid}`)).status, 404)
    assert.equal((await amb.http().get(`/api/portal/ficheiros/${fid}`)).status, 401)
    // não está na pasta pública
    assert.equal((await amb.http().get(`/uploads/${fid}.pdf`)).status, 404)
  })

  it('ficheiro disfarçado é recusado e apagado', async () => {
    const r = await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/materiais`)
      .field('titulo', 'Falso').field('tipo', 'ficheiro')
      .attach('ficheiro', Buffer.from('<script>alert(1)</script>'), { filename: 'x.pdf', contentType: 'application/pdf' })
    assert.equal(r.status, 400)
  })

  it('notas: o estudante só vê as publicadas e só as suas; a pauta valida tudo', async () => {
    const t1 = (await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/avaliacoes`).send({ nome: 'Teste 1', tipo: 'teste', peso: 40 })).body
    const ex = (await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/avaliacoes`).send({ nome: 'Exame', tipo: 'exame', peso: 60 })).body
    assert.equal((await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/avaliacoes`).send({ nome: 'A mais', peso: 10 })).status, 400)

    const pauta = await portal('prof').put(`/api/portal/avaliacoes/${t1.id}/notas`).send({ notas: [
      { estudanteId: contas.ana.id, valor: '15,5' }, { estudanteId: contas.bruno.id, valor: 9 },
    ] })
    assert.equal(pauta.status, 200, pauta.body.erro)
    // estudante de outra turma ou nota fora da escala
    assert.equal((await portal('prof').put(`/api/portal/avaliacoes/${t1.id}/notas`).send({ notas: [{ estudanteId: contas.carla.id, valor: 10 }] })).status, 400)
    assert.equal((await portal('prof').put(`/api/portal/avaliacoes/${t1.id}/notas`).send({ notas: [{ estudanteId: contas.ana.id, valor: 25 }] })).status, 400)
    // outro docente não lança notas aqui
    assert.equal((await portal('prof2').put(`/api/portal/avaliacoes/${t1.id}/notas`).send({ notas: [] })).status, 404)

    let boletim = (await portal('ana').get('/api/portal/notas')).body
    assert.equal(boletim[0].avaliacoes.length, 0) // ainda não publicada
    await portal('prof').put(`/api/portal/avaliacoes/${t1.id}`).send({ publicada: true })
    boletim = (await portal('ana').get('/api/portal/notas')).body
    assert.deepEqual(boletim[0].avaliacoes.map((a) => a.nota), [15.5])
    assert.equal(boletim[0].media, 15.5)
    assert.equal(boletim[0].completa, false)

    const detalhe = (await portal('bruno').get(`/api/portal/cadeiras/${cadeira.id}`)).body
    assert.deepEqual(detalhe.avaliacoes.map((a) => a.nota), [9]) // só a sua
    assert.ok(!JSON.stringify(detalhe).includes('15.5'))
    assert.equal((await portal('ana').get(`/api/portal/cadeiras/${cadeira.id}/pauta`)).status, 403)
    void ex
  })

  it('trabalhos: entrega dentro do prazo, substituição, correção e prazo fechado', async () => {
    const t = (await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/trabalhos`).send({ titulo: 'Ensaio estratégico', enunciado: 'Analise…', prazo: '2026-10-20T23:59:00Z' })).body
    const fechado = (await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/trabalhos`).send({ titulo: 'Já passou', prazo: '2026-10-01T23:59:00Z' })).body

    const e1 = await portal('ana').post(`/api/portal/trabalhos/${t.id}/entrega`).field('comentario', 'Versão 1').attach('ficheiro', PDF, { filename: 'ensaio.pdf', contentType: 'application/pdf' })
    assert.equal(e1.status, 201, e1.body.erro)
    const e2 = await portal('ana').post(`/api/portal/trabalhos/${t.id}/entrega`).field('comentario', 'Versão final').attach('ficheiro', PDF, { filename: 'ensaio-final.pdf', contentType: 'application/pdf' })
    assert.equal(e2.status, 201)
    assert.equal((await portal('carla').post(`/api/portal/trabalhos/${t.id}/entrega`).attach('ficheiro', PDF, { filename: 'x.pdf', contentType: 'application/pdf' })).status, 404)
    assert.equal((await portal('ana').post(`/api/portal/trabalhos/${fechado.id}/entrega`).attach('ficheiro', PDF, { filename: 'x.pdf', contentType: 'application/pdf' })).status, 400)

    const lista = (await portal('prof').get(`/api/portal/trabalhos/${t.id}/entregas`)).body
    assert.equal(lista.linhas.length, 2) // inclui quem não entregou
    const daAna = lista.linhas.find((l) => l.estudante.id === contas.ana.id).entrega
    assert.equal(daAna.comentario, 'Versão final')
    // o colega não descarrega a entrega da Ana; o docente sim
    assert.equal((await portal('bruno').get(`/api/portal/ficheiros/${daAna.ficheiroId}`)).status, 404)
    assert.equal((await portal('prof').get(`/api/portal/ficheiros/${daAna.ficheiroId}`)).status, 200)

    const c = await portal('prof').put(`/api/portal/entregas/${daAna.id}`).send({ nota: 17, correcao: 'Bom trabalho.' })
    assert.equal(c.status, 200)
    const meu = (await portal('ana').get(`/api/portal/cadeiras/${cadeira.id}`)).body.trabalhos.find((x) => x.id === t.id)
    assert.equal(meu.entrega.nota, 17)
    assert.equal(meu.estado, 'aberto')
    assert.equal((await portal('bruno').put(`/api/portal/entregas/${daAna.id}`).send({ nota: 20 })).status, 403)
  })

  it('aulas e presenças: só estudantes da turma; o estudante vê a sua assiduidade', async () => {
    const ok = await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/aulas`).send({
      data: '2026-10-13', sumario: 'Introdução', presencas: [{ estudanteId: contas.ana.id, estado: 'presente' }, { estudanteId: contas.bruno.id, estado: 'falta' }],
    })
    assert.equal(ok.status, 201, ok.body.erro)
    assert.equal((await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/aulas`).send({ data: '2026-10-14', presencas: [{ estudanteId: contas.carla.id, estado: 'presente' }] })).status, 400)
    const p = (await portal('bruno').get('/api/portal/presencas')).body
    assert.deepEqual(p[0], { cadeira: { id: cadeira.id, nome: 'Estratégia Militar' }, aulas: 1, faltas: 1, assiduidade: 0 })
  })

  it('pedidos de documentos: o estudante pede, a Secretaria trata e anexa o documento', async () => {
    const p = await portal('ana').post('/api/portal/pedidos').send({ tipo: 'Declaração de matrícula', motivo: 'Para o ramo' })
    assert.equal(p.status, 201)
    assert.equal((await portal('ana').post('/api/portal/pedidos').send({ tipo: 'Inventado' })).status, 400)
    assert.equal((await portal('prof').post('/api/portal/pedidos').send({ tipo: 'Declaração de matrícula' })).status, 403)

    const pronto = await sec().put(`/api/admin/academico/pedidos/${p.body.id}`).field('estado', 'pronto').field('resposta', 'Pode levantar ou descarregar.')
      .attach('ficheiro', PDF, { filename: 'declaracao.pdf', contentType: 'application/pdf' })
    assert.equal(pronto.status, 200, pronto.body.erro)
    const meus = (await portal('ana').get('/api/portal/pedidos')).body
    assert.equal(meus[0].estado, 'pronto')
    assert.equal((await portal('ana').get(`/api/portal/ficheiros/${meus[0].ficheiroId}`)).status, 200)
    assert.equal((await portal('bruno').get(`/api/portal/ficheiros/${meus[0].ficheiroId}`)).status, 404)
  })

  it('avisos gerais por turma e página inicial', async () => {
    await sec().post('/api/admin/academico/avisos').send({ titulo: 'Para todos', texto: 'Aviso geral.' })
    await sec().post('/api/admin/academico/avisos').send({ turmaId: outraTurmaId, titulo: 'Só turma B', texto: 'Aviso.' })
    const avisos = (await portal('ana').get('/api/portal/avisos')).body.map((a) => a.titulo)
    assert.ok(avisos.includes('Para todos'))
    assert.ok(!avisos.includes('Só turma B'))
    const inicio = (await portal('ana').get('/api/portal/inicio')).body
    assert.equal(inicio.cadeiras.length, 1)
    assert.ok(inicio.prazos.some((p) => p.titulo === 'Ensaio estratégico' && p.entregue))
  })

  it('suspender a matrícula corta o acesso às cadeiras; desativar a conta termina a sessão', async () => {
    const turma = (await sec().get(`/api/admin/academico/turmas/${turmaId}`)).body
    const mBruno = turma.matriculas.find((m) => m.estudante.id === contas.bruno.id)
    await sec().put(`/api/admin/academico/matriculas/${mBruno.id}`).send({ estado: 'suspensa' })
    assert.equal((await portal('bruno').get(`/api/portal/cadeiras/${cadeira.id}`)).status, 404)
    await sec().put(`/api/admin/academico/contas/${contas.bruno.id}`).send({ ativo: false })
    assert.equal((await portal('bruno').get('/api/portal/eu')).status, 401)
  })

  it('a gestão académica exige permissão no painel', async () => {
    const redator = await amb.criarUtilizador('redator')
    assert.equal((await amb.com(redator.token).get('/api/admin/academico/turmas')).status, 403)
    assert.equal((await amb.com(redator.token).post('/api/admin/academico/contas').send({ tipo: 'docente', nome: 'Intruso Docente', email: 'x@esgfaa.gov.ao' })).status, 403)
  })

  it('repor a palavra-passe volta a exigir a mudança', async () => {
    await sec().post(`/api/admin/academico/contas/${contas.ana.id}/repor-senha`)
    assert.equal((await portal('ana').get('/api/portal/eu')).status, 401) // sessões terminadas
    const r = await amb.http().post('/api/portal/entrar').send({ email: 'ana@esgfaa.gov.ao', senha: 'ana@esgfaa.gov.ao' })
    assert.equal(r.body.deveMudarSenha, true)
  })
})
