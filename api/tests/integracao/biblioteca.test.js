import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, relogioFalso } from '../apoio/ambiente.js'
import { normalizarIsbn, dublinCore } from '../../src/dominio/biblioteca/obra.js'
import { prazoPara } from '../../src/dominio/biblioteca/emprestimo.js'

const NOVA = 'Portal2026segura'
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')
const DIA = 24 * 60

describe('biblioteca: regras do domínio', () => {
  it('ISBN-10 e ISBN-13 com dígito de controlo', () => {
    assert.equal(normalizarIsbn('978-0-306-40615-7'), '9780306406157')
    assert.equal(normalizarIsbn('0-306-40615-2'), '0306406152')
    assert.equal(normalizarIsbn('080442957X'), '080442957X')
    assert.equal(normalizarIsbn(''), null)
    assert.throws(() => normalizarIsbn('978-0-306-40615-8'), /ISBN inválido/)
    assert.throws(() => normalizarIsbn('12345'), /ISBN inválido/)
  })
  it('prazo acaba no fim do dia em Luanda; Dublin Core escapa o texto', () => {
    assert.equal(prazoPara('estudante', '2026-11-02T10:00:00Z').toISOString(), '2026-11-16T22:59:59.000Z')
    assert.equal(prazoPara('docente', '2026-11-02T23:30:00Z').toISOString(), '2026-12-03T22:59:59.000Z')
    const x = dublinCore({ tipo: 'tfc', titulo: 'Logística & <Defesa>', subtitulo: '', autores: ['A. Silva'], assuntos: ['Logística'], resumo: '', editora: '', ano: 2025, isbn: null, cota: '355', idioma: 'pt', ficheiroId: null })
    assert.match(x, /<dc:title>Logística &amp; &lt;Defesa&gt;<\/dc:title>/)
    assert.match(x, /<dc:publisher>Escola Superior de Guerra<\/dc:publisher>/)
    assert.match(x, /<dc:type>Text\/Thesis<\/dc:type>/)
  })
})

describe('biblioteca: catálogo e circulação', () => {
  let amb, relogio, bib, escola
  const tokens = {}
  const ids = {}
  const portal = (quem) => amb.com(tokens[quem])

  before(async () => {
    relogio = relogioFalso('2026-11-02T09:00:00Z')
    amb = await criarAmbiente({ relogio })
    const admin = await amb.entrar()
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Estado-Maior' })
    const tudo = amb.com((await amb.criarUtilizador('administrador')).token)
    bib = amb.com((await amb.criarUtilizador('bibliotecario')).token)
    escola = amb.com((await amb.criarUtilizador('secretaria')).token)
    const turma = (await tudo.post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM A' })).body
    await amb.registarEMatricular(tudo, turma.id, { nome: 'Estudante ana Teste', email: 'ana@esgfaa.gov.ao' })
    await amb.registarEMatricular(tudo, turma.id, { nome: 'Estudante bruno Teste', email: 'bruno@esgfaa.gov.ao' })
    await tudo.post('/api/admin/academico/contas').send({ tipo: 'docente', nome: 'Docente Prof Teste', email: 'prof@esgfaa.gov.ao' })
    for (const k of ['ana', 'bruno', 'prof']) {
      const email = `${k}@esgfaa.gov.ao`
      const r = await amb.http().post('/api/portal/entrar').send({ email, senha: email })
      tokens[k] = (await amb.com(r.body.token).put('/api/portal/eu/senha').send({ atual: email, nova: NOVA })).body.token
      ids[k] = (await portal(k).get('/api/portal/eu')).body.conta?.id ?? (await portal(k).get('/api/portal/eu')).body.id
    }
  })
  after(() => amb.fechar())

  it('o bibliotecário cataloga obras, exemplares e a versão digital; o leitor pesquisa e lê', async () => {
    // a Administração Escolar não mexe na biblioteca
    assert.equal((await escola.get('/api/admin/biblioteca')).status, 403)
    assert.equal((await bib.post('/api/admin/biblioteca/obras').send({ titulo: 'X', isbn: '9780306406158' })).status, 400)
    const o = (await bib.post('/api/admin/biblioteca/obras').send({
      tipo: 'livro', titulo: 'Da Guerra', autores: ['Carl von Clausewitz'], ano: 1832, isbn: '978-0-306-40615-7', assuntos: 'Estratégia; Teoria da guerra', cota: '355.01 CLA',
    })).body
    assert.deepEqual([o.isbn, o.assuntos], ['9780306406157', ['Estratégia', 'Teoria da guerra']])
    assert.equal((await bib.post('/api/admin/biblioteca/obras').send({ titulo: 'Outra', isbn: '9780306406157' })).status, 409)
    const com = (await bib.post(`/api/admin/biblioteca/obras/${o.id}/exemplares`).send({ quantidade: 2, localizacao: 'Estante 3' })).body
    assert.deepEqual(com.exemplares.map((x) => x.codigo), ['BIB-000001', 'BIB-000002'])
    // digital: PDF, só para docentes
    const tfc = (await bib.post('/api/admin/biblioteca/obras').field('tipo', 'tfc').field('titulo', 'Logística em operações conjuntas').field('autores', 'Maj. Silva')
      .field('acesso', 'docentes').attach('ficheiro', PDF, { filename: 'tfc.pdf', contentType: 'application/pdf' })).body
    assert.equal(tfc.ficheiro.nome, 'tfc.pdf')

    // pesquisa no portal sem acentos nem maiúsculas, por autor e por assunto
    const p = (await portal('ana').get('/api/portal/biblioteca?q=clausewitz')).body
    assert.deepEqual(p.obras.map((x) => [x.titulo, x.exemplares, x.disponiveis]), [['Da Guerra', 2, 2]])
    assert.equal((await portal('ana').get('/api/portal/biblioteca?q=estrategia')).body.obras.length, 1)
    assert.equal((await portal('ana').get('/api/portal/biblioteca?q=BIB-000002')).body.obras.length, 1)
    const t = (await portal('ana').get(`/api/portal/biblioteca/obras/${tfc.id}`)).body
    assert.equal(t.digital.podeLer, false)
    assert.equal((await portal('ana').get(`/api/portal/biblioteca/obras/${tfc.id}/digital`)).status, 404)
    const ler = await portal('prof').get(`/api/portal/biblioteca/obras/${tfc.id}/digital?ver=1`)
    assert.equal(ler.status, 200)
    assert.match(ler.headers['content-disposition'], /^inline/)
    // o leitor nunca vê quem tem o livro
    assert.ok(!JSON.stringify(p).includes('leitor'))

    const xml = await bib.get('/api/admin/biblioteca/exportar')
    assert.match(xml.headers['content-type'], /xml/)
    assert.match(xml.text, /<dc:creator>Carl von Clausewitz<\/dc:creator>/)
    ids.obra = o.id
  })

  it('empréstimo, limite, renovação, atraso que bloqueia, aviso e devolução', async () => {
    // mais três obras para chegar ao limite
    const codigos = ['BIB-000001']
    for (const titulo of ['Arte da Guerra', 'Estratégia', 'Liderança']) {
      const o = (await bib.post('/api/admin/biblioteca/obras').send({ titulo })).body
      codigos.push((await bib.post(`/api/admin/biblioteca/obras/${o.id}/exemplares`).send({})).body.exemplares[0].codigo)
    }
    const leitores = (await bib.get('/api/admin/biblioteca/leitores?q=ana')).body
    assert.deepEqual(leitores.map((l) => [l.nome, l.emprestados, l.maximo]), [['Estudante ana Teste', 0, 3]])
    const ana = leitores[0].id
    const e1 = (await bib.post('/api/admin/biblioteca/emprestimos').send({ codigo: 'bib-000001', contaId: ana })).body
    assert.equal(e1.prazo, '2026-11-16T22:59:59.000Z')
    assert.equal((await bib.post('/api/admin/biblioteca/emprestimos').send({ codigo: 'BIB-000001', contaId: ana })).status, 409) // já emprestado
    await bib.post('/api/admin/biblioteca/emprestimos').send({ codigo: codigos[1], contaId: ana })
    await bib.post('/api/admin/biblioteca/emprestimos').send({ codigo: codigos[2], contaId: ana })
    const limite = await bib.post('/api/admin/biblioteca/emprestimos').send({ codigo: codigos[3], contaId: ana })
    assert.equal(limite.status, 409)
    assert.match(limite.body.erro, /máximo 3/)

    // no portal: a Ana vê os empréstimos e renova; a obra mostra 1 disponível de 2
    const meus = (await portal('ana').get('/api/portal/biblioteca/emprestimos')).body
    assert.equal(meus.ativos.length, 3)
    assert.equal((await portal('ana').get(`/api/portal/biblioteca/obras/${ids.obra}`)).body.disponiveis, 1)
    relogio.avancar(10 * DIA)
    const r1 = (await portal('ana').post(`/api/portal/biblioteca/emprestimos/${e1.id}/renovar`)).body
    assert.equal(r1.ativos.find((e) => e.id === e1.id).prazo, '2026-11-26T22:59:59.000Z')
    // o Bruno não pode renovar o da Ana
    assert.equal((await portal('bruno').post(`/api/portal/biblioteca/emprestimos/${e1.id}/renovar`)).status, 404)
    // no mesmo dia não ganha nada: recusa sem gastar a renovação
    assert.match((await portal('ana').post(`/api/portal/biblioteca/emprestimos/${e1.id}/renovar`)).body.erro, /mais tempo/)
    relogio.avancar(DIA)
    assert.equal((await portal('ana').post(`/api/portal/biblioteca/emprestimos/${e1.id}/renovar`)).status, 200)
    relogio.avancar(DIA)
    const terceira = await portal('ana').post(`/api/portal/biblioteca/emprestimos/${e1.id}/renovar`)
    assert.equal(terceira.status, 409)

    // passa o prazo dos outros dois: atrasados, não renova, não leva mais
    relogio.avancar(3 * DIA)
    const atrasados = (await bib.get('/api/admin/biblioteca/emprestimos?estado=atrasados')).body
    assert.equal(atrasados.length, 2)
    assert.ok(atrasados.every((e) => e.emAtraso && e.diasAtraso >= 1 && e.leitor.nome === 'Estudante ana Teste'))
    const outro = atrasados[0]
    assert.equal((await bib.post(`/api/admin/biblioteca/emprestimos/${outro.id}/renovar`)).status, 409)
    await bib.post('/api/admin/biblioteca/devolucoes').send({ id: atrasados[1].id })
    const bloqueada = await bib.post('/api/admin/biblioteca/emprestimos').send({ codigo: codigos[3], contaId: ana })
    assert.match(bloqueada.body.erro, /em atraso/)
    const aviso = (await bib.post('/api/admin/biblioteca/avisar-atrasos')).body
    assert.deepEqual(aviso, { leitores: 1, emprestimos: 1 })
    const n = (await portal('ana').get('/api/portal/notificacoes')).body
    assert.ok((n.lista || n).some((x) => x.tipo === 'biblioteca' && /fora do prazo/.test(x.titulo)))

    // devolução pelo código; já não está atrasada e pode levar outro
    const dev = (await bib.post('/api/admin/biblioteca/devolucoes').send({ codigo: outro.exemplar.codigo })).body
    assert.ok(dev.diasAtrasoNaDevolucao >= 1)
    assert.equal((await bib.post('/api/admin/biblioteca/devolucoes').send({ codigo: outro.exemplar.codigo })).status, 409)
    assert.equal((await bib.post('/api/admin/biblioteca/emprestimos').send({ codigo: codigos[3], contaId: ana })).status, 201)

    // exemplar perdido não se empresta; obra com empréstimos não se apaga
    const obra = (await bib.get(`/api/admin/biblioteca/obras/${ids.obra}`)).body
    const livre = obra.exemplares.find((x) => !x.emprestimo)
    await bib.put(`/api/admin/biblioteca/exemplares/${livre.id}`).send({ estado: 'perdido' })
    assert.equal((await bib.post('/api/admin/biblioteca/emprestimos').send({ codigo: livre.codigo, contaId: ids.prof })).status, 409)
    assert.equal((await bib.delete(`/api/admin/biblioteca/obras/${ids.obra}`)).status, 409)
    const ficha = (await bib.get(`/api/admin/biblioteca/leitores/${ana}`)).body
    assert.equal(ficha.emprestimos.length, 4)
    // o estudante não entra no painel da biblioteca
    assert.equal((await portal('ana').get('/api/admin/biblioteca')).status, 401)
  })

  it('reserva no portal: a biblioteca separa, avisa e ao emprestar fica atendida; capas só de /uploads', async () => {
    assert.equal((await bib.post('/api/admin/biblioteca/obras').send({ titulo: 'Capa má', capa: 'https://mau.example/x.jpg' })).status, 400)
    const o = (await bib.post('/api/admin/biblioteca/obras').send({ titulo: 'Geopolítica de África', capa: '/uploads/2026-11/capa.webp' })).body
    assert.equal(o.capa, '/uploads/2026-11/capa.webp')
    // sem exemplares não se reserva
    assert.equal((await portal('bruno').post(`/api/portal/biblioteca/obras/${o.id}/reserva`)).status, 409)
    await bib.post(`/api/admin/biblioteca/obras/${o.id}/exemplares`).send({ codigo: 'GEO-1', localizacao: 'Estante 6' })
    const m = (await portal('bruno').post(`/api/portal/biblioteca/obras/${o.id}/reserva`)).body
    assert.equal(m.reservas[0].estado, 'pendente')
    assert.equal((await portal('bruno').post(`/api/portal/biblioteca/obras/${o.id}/reserva`)).status, 409)
    assert.equal((await portal('bruno').get(`/api/portal/biblioteca/obras/${o.id}`)).body.minhaReserva.estado, 'pendente')
    const l = (await bib.get('/api/admin/biblioteca/reservas')).body
    assert.deepEqual(l.map((r) => [r.obra.titulo, r.leitor.nome, r.naEstante.map((x) => x.codigo)]), [['Geopolítica de África', 'Estudante bruno Teste', ['GEO-1']]])
    // a Ana não cancela a reserva do Bruno
    assert.equal((await portal('ana').delete(`/api/portal/biblioteca/reservas/${l[0].id}`)).status, 404)
    const pronta = (await bib.post(`/api/admin/biblioteca/reservas/${l[0].id}/preparar`)).body
    assert.equal(pronta.estado, 'pronta')
    const n = (await portal('bruno').get('/api/portal/notificacoes')).body
    assert.ok((n.lista || n).some((x) => /Pronto a levantar/.test(x.titulo)))
    await bib.post('/api/admin/biblioteca/emprestimos').send({ codigo: 'GEO-1', contaId: l[0].leitor.id })
    const meus = (await portal('bruno').get('/api/portal/biblioteca/emprestimos')).body
    assert.deepEqual([meus.reservas.length, meus.ativos.length], [0, 1])
    // nova reserva e cancelamento pelo próprio
    const o2 = (await bib.post('/api/admin/biblioteca/obras').send({ titulo: 'Doutrina conjunta' })).body
    await bib.post(`/api/admin/biblioteca/obras/${o2.id}/exemplares`).send({})
    const r2 = (await portal('bruno').post(`/api/portal/biblioteca/obras/${o2.id}/reserva`)).body.reservas[0]
    assert.equal((await portal('bruno').delete(`/api/portal/biblioteca/reservas/${r2.id}`)).body.reservas.length, 0)
    assert.equal((await portal('bruno').post(`/api/portal/biblioteca/obras/${o2.id}/reserva`)).status, 201)
  })
})
