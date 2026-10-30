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
    const r = await amb.http().post('/api/portal/entrar').send({ email, senha: amb.senhaInicial(email) })
    assert.equal(r.status, 200, r.body.erro)
    assert.equal(r.body.deveMudarSenha, true)
    const m = await amb.com(r.body.token).put('/api/portal/eu/senha').send({ atual: amb.senhaInicial(email), nova: NOVA })
    assert.equal(m.status, 200, m.body.erro)
    return m.body.token
  }

  before(async () => {
    amb = await criarAmbiente({ relogio: relogioFalso('2026-10-13T10:00:00Z') })
    admin = await amb.entrar()
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Estado-Maior' })
    secretaria = await amb.criarUtilizador('administrador')

    turmaId = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM 2026/2027' })).body.id
    outraTurmaId = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM B' })).body.id

    for (const [chave, tipo, nome] of [['prof', 'docente', 'Professor Teste Silva'], ['prof2', 'docente', 'Professora Outra Turma'], ['assist', 'docente', 'Assistente Teste Costa']]) {
      const r = await sec().post('/api/admin/academico/contas').send({ tipo, nome, email: `${chave}@esgfaa.gov.ao` })
      assert.equal(r.status, 201, r.body.erro)
      contas[chave] = r.body
    }
    for (const chave of ['ana', 'bruno']) {
      const r = await amb.registarEMatricular(sec(), turmaId, { nome: `Estudante ${chave} Teste`, email: `${chave}@esgfaa.gov.ao`, dados: { posto: 'Major' } })
      assert.equal(r.status, 201, r.body.erro)
      contas[chave] = r.body
    }
    contas.carla = (await amb.registarEMatricular(sec(), outraTurmaId, { nome: 'Estudante Carla Teste', email: 'carla@esgfaa.gov.ao' })).body

    // as cadeiras são criadas sem docente; a alocação faz-se depois
    cadeira = (await sec().post(`/api/admin/academico/turmas/${turmaId}/cadeiras`).send({ codigo: 'EST101', nome: 'Estratégia Militar', periodo: '1', horas: 90 })).body
    cadeiraOutra = (await sec().post(`/api/admin/academico/turmas/${outraTurmaId}/cadeiras`).send({ codigo: 'LOG101', nome: 'Logística', periodo: 'anual' })).body
    assert.deepEqual(cadeira.docentes, [])
    await sec().put(`/api/admin/academico/cadeiras/${cadeira.id}/docentes`).send({ docentes: [{ docenteId: contas.prof.id, papel: 'regente', horas: 60 }] })
    await sec().put(`/api/admin/academico/cadeiras/${cadeiraOutra.id}/docentes`).send({ docentes: [{ docenteId: contas.prof2.id, papel: 'regente', horas: 45 }] })
    await sec().post(`/api/admin/academico/cadeiras/${cadeira.id}/horarios`).send({ diaSemana: 2, inicio: '08:00', fim: '10:00', sala: 'Anfiteatro' })

    for (const q of ['prof', 'prof2', 'assist', 'ana', 'bruno', 'carla']) tokens[q] = await primeiraEntrada(`${q}@esgfaa.gov.ao`)
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
    const t = (await amb.http().post('/api/portal/entrar').send({ email: 'novo@esgfaa.gov.ao', senha: amb.senhaInicial('novo@esgfaa.gov.ao') })).body.token
    assert.equal((await amb.com(t).get('/api/portal/eu')).status, 200)
    const bloqueado = await amb.com(t).get('/api/portal/cadeiras')
    assert.equal(bloqueado.status, 403)
    assert.equal(bloqueado.body.codigo, 'mudar_senha')
    // a nova não pode ser o e-mail nem fraca
    assert.equal((await amb.com(t).put('/api/portal/eu/senha').send({ atual: amb.senhaInicial('novo@esgfaa.gov.ao'), nova: 'novo@esgfaa.gov.ao' })).status, 400)
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
      .field('titulo', 'Sebenta 1').field('tipo', 'ficheiro')
      .attach('ficheiro', PDF, { filename: 'sebenta.pdf', contentType: 'application/pdf' })
    assert.equal(m.status, 201, m.body.erro)
    const ligacao = await portal('prof').post(`/api/portal/cadeiras/${cadeira.id}/materiais`).send({ titulo: 'Leitura', tipo: 'ligacao', url: 'javascript:alert(1)' })
    assert.equal(ligacao.status, 400)

    // outro docente não publica nesta cadeira; estudantes também não
    assert.equal((await portal('prof2').post(`/api/portal/cadeiras/${cadeira.id}/avisos`).send({ titulo: 'x', texto: 'yy' })).status, 404)
    assert.equal((await portal('ana').post(`/api/portal/cadeiras/${cadeira.id}/avisos`).send({ titulo: 'xx', texto: 'yy' })).status, 403)

    const detalhe = (await portal('ana').get(`/api/portal/cadeiras/${cadeira.id}`)).body
    const fid = detalhe.materiais[0].ficheiroId
    // o portal recebe o nome e o tipo, para mostrar o PDF na página (e pedi-lo para ver, não descarregar)
    assert.deepEqual({ ...detalhe.materiais[0].ficheiro, tamanho: undefined }, { id: fid, nome: 'sebenta.pdf', tipo: 'application/pdf', tamanho: undefined })
    assert.match((await portal('ana').get(`/api/portal/ficheiros/${fid}?ver=1`)).headers['content-disposition'], /^inline/)
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

  it('pauta (1.ª e 2.ª prova, MAC, exame, recurso): o estudante só vê o publicado e só o seu', async () => {
    const url = `/api/portal/cadeiras/${cadeira.id}/pauta`
    const pauta = await portal('prof').put(url).send({ linhas: [
      { estudanteId: contas.ana.id, p1: '15,5', p2: 16 },
      { estudanteId: contas.bruno.id, p1: 9, p2: 12, exame: 8 },
    ] })
    assert.equal(pauta.status, 200, pauta.body.erro)
    const [ana, bruno] = [contas.ana.id, contas.bruno.id].map((id) => pauta.body.linhas.find((l) => l.estudante.id === id))
    assert.deepEqual({ mac: ana.mac, final: ana.final, situacao: ana.situacao }, { mac: 15.8, final: 16, situacao: 'dispensado' })
    // MAC 10,5; 0,4 × 10,5 + 0,6 × 8 = 9 → recurso
    assert.deepEqual({ final: bruno.final, situacao: bruno.situacao }, { final: 9, situacao: 'recurso' })

    // estudante de outra turma, repetido, nota fora da escala, componente inventada
    assert.equal((await portal('prof').put(url).send({ linhas: [{ estudanteId: contas.carla.id, p1: 10 }] })).status, 400)
    assert.equal((await portal('prof').put(url).send({ linhas: [{ estudanteId: ana.estudante.id, p1: 10 }, { estudanteId: ana.estudante.id, p1: 11 }] })).status, 400)
    const fora = await portal('prof').put(url).send({ linhas: [{ estudanteId: contas.ana.id, exame: 25 }] })
    assert.equal(fora.status, 400)
    assert.match(fora.body.erro, /Exame/)
    assert.equal((await portal('prof').put(`${url}/publicacao`).send({ publicadas: ['p1', 'final'] })).status, 400)
    // outro docente não vê nem lança notas aqui; o estudante também não
    assert.equal((await portal('prof2').put(url).send({ linhas: [] })).status, 404)
    assert.equal((await portal('prof2').put(`${url}/publicacao`).send({ publicadas: ['p1'] })).status, 404)
    assert.equal((await portal('ana').get(url)).status, 403)

    let boletim = (await portal('ana').get('/api/portal/notas')).body
    assert.deepEqual([boletim[0].p1, boletim[0].mac, boletim[0].situacao], [null, null, 'em_curso']) // nada publicado
    assert.equal((await portal('prof').put(`${url}/publicacao`).send({ publicadas: ['p1'] })).status, 200)
    boletim = (await portal('ana').get('/api/portal/notas')).body
    assert.deepEqual([boletim[0].p1, boletim[0].p2, boletim[0].mac], [15.5, null, null]) // a 2.ª prova ainda não
    await portal('prof').put(`${url}/publicacao`).send({ publicadas: ['p2', 'p1'] })
    boletim = (await portal('ana').get('/api/portal/notas')).body
    assert.deepEqual([boletim[0].mac, boletim[0].final, boletim[0].situacao, boletim[0].classificacao], [15.8, 16, 'dispensado', 'Bom'])

    // o exame do Bruno ainda não foi publicado: para ele, aguarda exame
    let detalhe = (await portal('bruno').get(`/api/portal/cadeiras/${cadeira.id}`)).body
    assert.deepEqual([detalhe.notas.p1, detalhe.notas.exame, detalhe.notas.situacao], [9, null, 'exame'])
    assert.ok(!JSON.stringify(detalhe).includes('15.5')) // não vê as notas dos colegas
    await portal('prof').put(`${url}/publicacao`).send({ publicadas: ['p1', 'p2', 'exame'] })
    detalhe = (await portal('bruno').get(`/api/portal/cadeiras/${cadeira.id}`)).body
    assert.equal(detalhe.notas.situacao, 'recurso')

    // notas publicadas: o docente já não as apaga nem muda sem autorização do Comandante (pedido por estudante)
    const limpa = await portal('prof').put(url).send({ linhas: [{ estudanteId: contas.bruno.id }] })
    assert.equal(limpa.status, 409)
    assert.match(limpa.body.erro, /peça a alteração ao Comandante/)
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
    assert.equal((await portal('bruno').get(`/api/portal/ficheiros/${daAna.ficheiros[0].id}`)).status, 404)
    assert.equal((await portal('prof').get(`/api/portal/ficheiros/${daAna.ficheiros[0].id}`)).status, 200)

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

  it('pedidos de documentos: o estudante pede, a Administração Escolar trata e anexa o documento', async () => {
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
    const todos = (await sec().post('/api/admin/academico/avisos').send({ titulo: 'Para todos', texto: 'Aviso geral.' })).body
    const turmaB = (await sec().post('/api/admin/academico/avisos').send({ turmaId: outraTurmaId, titulo: 'Só turma B', texto: 'Aviso.' })).body
    // só chegam aos estudantes depois de o Comandante aprovar
    assert.equal(todos.estado, 'pendente')
    assert.ok(!(await portal('ana').get('/api/portal/avisos')).body.some((a) => a.titulo === 'Para todos'))
    await amb.aprovar('avisos_gerais', todos.id)
    await amb.aprovar('avisos_gerais', turmaB.id)
    const avisos = (await portal('ana').get('/api/portal/avisos')).body.map((a) => a.titulo)
    assert.ok(avisos.includes('Para todos'))
    assert.ok(!avisos.includes('Só turma B'))
    const inicio = (await portal('ana').get('/api/portal/inicio')).body
    assert.equal(inicio.cadeiras.length, 1)
    assert.ok(inicio.prazos.some((p) => p.titulo === 'Ensaio estratégico' && p.entregue))
  })

  it('alocação: regente + assistentes, sem repetidos nem dois regentes; o assistente também entra na cadeira', async () => {
    const url = `/api/admin/academico/cadeiras/${cadeira.id}/docentes`
    const dois = await sec().put(url).send({ docentes: [{ docenteId: contas.prof.id, papel: 'regente' }, { docenteId: contas.assist.id, papel: 'regente' }] })
    assert.equal(dois.status, 400)
    assert.match(dois.body.erro, /um regente/)
    assert.equal((await sec().put(url).send({ docentes: [{ docenteId: contas.prof.id }, { docenteId: contas.prof.id }] })).status, 400)
    assert.equal((await sec().put(url).send({ docentes: [{ docenteId: contas.ana.id, papel: 'assistente' }] })).status, 400) // é estudante
    assert.equal((await portal('assist').get(`/api/portal/cadeiras/${cadeira.id}`)).status, 404) // ainda não alocado

    const r = await sec().put(url).send({ docentes: [{ docenteId: contas.assist.id, papel: 'assistente', horas: 30 }, { docenteId: contas.prof.id, papel: 'regente', horas: 60 }] })
    assert.equal(r.status, 200, r.body.erro)
    assert.deepEqual(r.body.docentes.map((d) => [d.nome, d.papel, d.horas]), [['Professor Teste Silva', 'regente', 60], ['Assistente Teste Costa', 'assistente', 30]])
    assert.equal(r.body.docente.id, contas.prof.id) // o regente

    assert.equal((await portal('assist').get(`/api/portal/cadeiras/${cadeira.id}`)).status, 200)
    assert.ok((await portal('assist').get('/api/portal/cadeiras')).body.some((c) => c.id === cadeira.id))
    assert.equal((await portal('assist').get(`/api/portal/cadeiras/${cadeira.id}/pauta`)).status, 200)

    const geral = (await sec().get('/api/admin/academico/alocacao')).body
    const prof = geral.docentes.find((d) => d.docente.id === contas.prof.id)
    assert.equal(prof.horas, 60)
    assert.equal(geral.cadeiras.find((c) => c.id === cadeira.id).horasAlocadas, 90)
    // só a Administração Escolar aloca
    assert.equal((await portal('prof').put(url).send({ docentes: [] })).status, 401)
  })

  it('período: 1.º semestre, 2.º semestre ou anual', async () => {
    const url = `/api/admin/academico/cadeiras/${cadeiraOutra.id}`
    assert.equal((await sec().put(url).send({ periodo: '3' })).status, 400)
    assert.equal((await sec().put(url).send({ periodo: '2' })).body.periodo, '2')
  })

  it('programa da cadeira: escrito no portal (HTML filtrado) ou em documento; os estudantes da turma consultam', async () => {
    const url = `/api/admin/academico/cadeiras/${cadeira.id}/programa`
    const r = await sec().put(url).send({ texto: '<h2>Objetivos</h2><p onclick="x()">Planear</p><script>alert(1)</script>' })
    assert.equal(r.status, 200, r.body.erro)
    assert.equal(r.body.programa, '<h2>Objetivos</h2><p>Planear</p>')
    const doc = await sec().put(url).attach('ficheiro', PDF, { filename: 'programa.pdf', contentType: 'application/pdf' })
    assert.equal(doc.status, 200, doc.body.erro)
    assert.equal(doc.body.programaFicheiro.nome, 'programa.pdf')

    const vista = (await portal('ana').get(`/api/portal/cadeiras/${cadeira.id}`)).body
    assert.equal(vista.programa, '<h2>Objetivos</h2><p>Planear</p>')
    assert.equal((await portal('ana').get(`/api/portal/ficheiros/${vista.programaFicheiroId}`)).status, 200)
    assert.equal((await portal('carla').get(`/api/portal/ficheiros/${vista.programaFicheiroId}`)).status, 404) // outra turma
    assert.equal((await portal('prof').put(url).send({ texto: 'x' })).status, 401)

    const sem = await sec().put(url).send({ removerFicheiro: true })
    assert.equal(sem.body.programaFicheiroId, null)
  })

  it('a Administração Escolar também lança e publica notas; quem não tem permissão não', async () => {
    const url = `/api/admin/academico/cadeiras/${cadeira.id}/pauta`
    const r = await sec().put(url).send({ linhas: [{ estudanteId: contas.ana.id, p1: 15, p2: 16 }] })
    assert.equal(r.status, 200, r.body.erro)
    assert.equal(r.body.linhas.find((l) => l.estudante.id === contas.ana.id).situacao, 'dispensado')
    assert.equal((await sec().put(`${url}/publicacao`).send({ publicadas: ['p1', 'p2'] })).status, 200)
    assert.equal((await portal('ana').get('/api/portal/notas')).body[0].final, 16)

    const redator = await amb.criarUtilizador('redator')
    assert.equal((await amb.com(redator.token).put(url).send({ linhas: [] })).status, 403)
    assert.equal((await amb.com(redator.token).get(url)).status, 403)
  })

  it('percurso académico: todos os anos do estudante, com resumo', async () => {
    // um 1.º ano já concluído, com uma disciplina aprovada e outra reprovada
    const t1 = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2025/2026', anoCurricular: 1, nome: 'CEM 1.º ano' })).body
    await sec().post(`/api/admin/academico/turmas/${t1.id}/matriculas`).send({ estudanteId: contas.ana.id })
    const c1 = (await sec().post(`/api/admin/academico/turmas/${t1.id}/cadeiras`).send({ codigo: 'HIS001', nome: 'História Militar', periodo: '1', horas: 60 })).body
    const c2 = (await sec().post(`/api/admin/academico/turmas/${t1.id}/cadeiras`).send({ codigo: 'DIR002', nome: 'Direito Humanitário', periodo: 'anual', horas: 40 })).body
    await sec().put(`/api/admin/academico/cadeiras/${c1.id}/pauta`).send({ linhas: [{ estudanteId: contas.ana.id, p1: 12, p2: 13, exame: 14 }] })
    await sec().put(`/api/admin/academico/cadeiras/${c2.id}/pauta`).send({ linhas: [{ estudanteId: contas.ana.id, p1: 8, p2: 9, exame: 7, recurso: 6 }] })
    for (const c of [c1, c2]) await sec().put(`/api/admin/academico/cadeiras/${c.id}/pauta/publicacao`).send({ publicadas: ['p1', 'p2', 'exame', 'recurso'] })
    const m = (await sec().get(`/api/admin/academico/turmas/${t1.id}`)).body.matriculas[0]
    await sec().put(`/api/admin/academico/matriculas/${m.id}`).send({ estado: 'concluida' })

    const p = await portal('ana').get('/api/portal/percurso')
    assert.equal(p.status, 200, p.body.erro)
    assert.deepEqual(p.body.anos.map((a) => [a.turma.anoLetivo, a.turma.anoCurricular, a.matricula.estado]), [['2025/2026', 1, 'concluida'], ['2026/2027', 1, 'ativa']])
    const ano1 = p.body.anos[0]
    // 0,4 × 12,5 + 0,6 × 14 = 13,4 → 13
    assert.deepEqual(ano1.disciplinas.map((d) => [d.cadeira.codigo, d.final, d.situacao]), [['HIS001', 13, 'aprovado'], ['DIR002', 7, 'reprovado']])
    assert.deepEqual(
      { aprovadas: ano1.resumo.aprovadas, reprovadas: ano1.resumo.reprovadas, horas: ano1.resumo.horas, horasAprovadas: ano1.resumo.horasAprovadas, media: ano1.resumo.media },
      { aprovadas: 1, reprovadas: 1, horas: 100, horasAprovadas: 60, media: 13 },
    )
    assert.equal(p.body.resumo.aprovadas, 2) // + EST101 dispensada no 2.º ano
    // a matrícula concluída não dá acesso à cadeira antiga nem às dos colegas
    assert.equal((await portal('ana').get(`/api/portal/cadeiras/${c1.id}`)).status, 404)
    assert.equal((await portal('prof').get('/api/portal/percurso')).status, 403)
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
    const r = await amb.http().post('/api/portal/entrar').send({ email: 'ana@esgfaa.gov.ao', senha: amb.senhaInicial('ana@esgfaa.gov.ao') })
    assert.equal(r.body.deveMudarSenha, true)
  })

})
