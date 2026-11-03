import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, militar } from '../apoio/ambiente.js'

describe('despacho do Comandante: docentes, contas e papéis', () => {
  let amb, adm, cmd
  const pendentes = async () => (await cmd.get('/api/pedidos-despacho?estado=pendente').expect(200)).body
  const decidir = (id, decisao, despacho = '') => cmd.post(`/api/pedidos-despacho/${id}/decidir`).send({ decisao, despacho })
  const docentes = async () => (await adm.get('/api/academicos?tipo=docente').expect(200)).body.pessoas

  before(async () => {
    amb = await criarAmbiente()
    adm = amb.com(await amb.entrar())
    // a primeira conta de Comandante não espera (senão ninguém despachava)
    const r = (await adm.post('/api/utilizadores').send({ nome: 'Comandante da Escola', email: 'comandante@pessoal.ao', papel: 'comandante', senha: 'Escola#Cmd2026' }).expect(201)).body
    assert.equal(r.aguardaDespacho, false)
    const t = await amb.entrar('comandante@pessoal.ao', 'Escola#Cmd2026')
    cmd = amb.com((await amb.com(t).post('/api/mudar-senha').send({ atual: 'Escola#Cmd2026', nova: 'Escola#Cmd2027' }).expect(200)).body.token)
  })
  after(() => amb.fechar())

  it('docente colaborador novo fica à espera; só o Comandante decide; ao deferir passa a docente', async () => {
    const d = (await adm.post('/api/pessoas').send({ tipo: 'civil', vinculo: 'docente', nome: 'Colaborador Despacho Teste', tipoDocente: 'colaborador', categoriaDocente: 'Professor convidado', email: 'colab.desp@esgfaa.gov.ao' }).expect(201)).body
    assert.deepEqual(d.aDespacho, ['docente_novo'])
    assert.equal((await docentes()).find((x) => x.id === d.id).docentePendente, true)
    const [p] = (await pendentes()).filter((x) => x.pessoaId === d.id)
    assert.equal(p.tipo, 'docente_novo')
    assert.match(p.resumo, /Colaborador Despacho Teste — docente colaborador \(Professor convidado\)/)
    // a Repartição vê, mas não decide
    await adm.post(`/api/pedidos-despacho/${p.id}/decidir`).send({ decisao: 'deferido' }).expect(403)
    const r = (await decidir(p.id, 'deferido', 'Autorizo').expect(200)).body
    assert.equal(r.estado, 'deferido')
    assert.equal((await docentes()).find((x) => x.id === d.id).docentePendente, false)
    await decidir(p.id, 'deferido').expect(409) // já decidido
  })

  it('indeferir exige o motivo; o colaborador indeferido sai da Escola', async () => {
    const d = (await adm.post('/api/pessoas').send({ tipo: 'civil', vinculo: 'docente', nome: 'Colaborador Indeferido Teste', tipoDocente: 'colaborador' }).expect(201)).body
    const [p] = (await pendentes()).filter((x) => x.pessoaId === d.id)
    await decidir(p.id, 'indeferido', '').expect(400)
    await decidir(p.id, 'indeferido', 'Não há vaga na Secção').expect(200)
    const f = (await adm.get(`/api/pessoas/${d.id}`).expect(200)).body
    assert.equal(f.ativo, false)
    assert.equal(f.motivoSaida, 'Indeferido pelo Comandante')
  })

  it('o efectivo juntado aos docentes: indeferido, continua na Escola mas não é docente', async () => {
    const m = (await adm.post('/api/pessoas').send(militar({ nip: 'NIP7701', nome: 'Efectivo Despacho Teste' })).expect(201)).body
    const r = (await adm.put(`/api/pessoas/${m.id}`).send({ outrosVinculos: ['docente'], tipoDocente: 'efectivo', categoriaDocente: 'Assistente' }).expect(200)).body
    assert.deepEqual(r.aDespacho, ['docente_novo'])
    const [p] = (await pendentes()).filter((x) => x.pessoaId === m.id)
    await decidir(p.id, 'indeferido', 'Fica só nas funções actuais').expect(200)
    const f = (await adm.get(`/api/pessoas/${m.id}`).expect(200)).body
    assert.deepEqual([f.ativo, f.outrosVinculos], [true, []])
  })

  it('a mudança de categoria e a saída só se aplicam depois de deferidas', async () => {
    const m = (await adm.post('/api/pessoas').send(militar({ nip: 'NIP7702', nome: 'Docente Categoria Teste', outrosVinculos: ['docente'], tipoDocente: 'efectivo', categoriaDocente: 'Assistente' })).expect(201)).body
    for (const x of await pendentes()) await decidir(x.id, 'deferido')
    const r = (await adm.put(`/api/pessoas/${m.id}`).send({ categoriaDocente: 'Professor auxiliar', telefone: '923111222' }).expect(200)).body
    assert.deepEqual(r.aDespacho, ['docente_categoria'])
    let f = (await adm.get(`/api/pessoas/${m.id}`)).body
    assert.deepEqual([f.categoriaDocente, f.telefone], ['Assistente', '923111222']) // o resto aplica-se já
    const [c] = (await pendentes()).filter((x) => x.pessoaId === m.id)
    assert.match(c.resumo, /Assistente → Professor auxiliar/)
    await decidir(c.id, 'deferido').expect(200)
    assert.equal((await adm.get(`/api/pessoas/${m.id}`)).body.categoriaDocente, 'Professor auxiliar')
    // deixar de ser docente
    assert.deepEqual((await adm.put(`/api/pessoas/${m.id}`).send({ outrosVinculos: [] }).expect(200)).body.aDespacho, ['docente_saida'])
    assert.deepEqual((await adm.get(`/api/pessoas/${m.id}`)).body.outrosVinculos, ['docente'])
    const [s] = (await pendentes()).filter((x) => x.pessoaId === m.id)
    await decidir(s.id, 'deferido').expect(200)
    assert.deepEqual((await adm.get(`/api/pessoas/${m.id}`)).body.outrosVinculos, [])
  })

  it('conta nova do sistema não entra até ao despacho; indeferida, apaga-se', async () => {
    const r = (await adm.post('/api/utilizadores').send({ nome: 'Operador Despacho', email: 'op.desp@pessoal.ao', papel: 'operador', senha: 'Operador2026x' }).expect(201)).body
    assert.deepEqual([r.aguardaDespacho, r.aDespacho], [true, ['utilizador_novo']])
    const e = await amb.http().post('/api/entrar').send({ email: 'op.desp@pessoal.ao', senha: 'Operador2026x' })
    assert.equal(e.body.codigo, 'aguarda_despacho')
    const [p] = (await pendentes()).filter((x) => x.utilizadorId === r.id)
    await decidir(p.id, 'deferido').expect(200)
    assert.ok(await amb.entrar('op.desp@pessoal.ao', 'Operador2026x'))
    // outra, indeferida
    const n = (await adm.post('/api/utilizadores').send({ nome: 'Chefe Indeferido', email: 'chefe.ind@pessoal.ao', papel: 'chefe', senha: 'Chefe2026xx' }).expect(201)).body
    const [q] = (await pendentes()).filter((x) => x.utilizadorId === n.id)
    await decidir(q.id, 'indeferido', 'Já há Chefe').expect(200)
    assert.equal((await adm.get('/api/utilizadores')).body.some((x) => x.email === 'chefe.ind@pessoal.ao'), false)
    // contas de utente não esperam
    assert.equal((await adm.post('/api/utilizadores').send({ nome: 'Utente Sem Despacho', email: 'utente.sd@pessoal.ao', papel: 'utente', senha: 'Utente2026xx' }).expect(201)).body.aguardaDespacho, false)
  })

  it('mudar o papel espera pelo despacho (a conta fica com o papel que tem)', async () => {
    const u = (await adm.get('/api/utilizadores')).body.find((x) => x.email === 'op.desp@pessoal.ao')
    const r = (await adm.put(`/api/utilizadores/${u.id}`).send({ papel: 'chefe' }).expect(200)).body
    assert.deepEqual([r.papel, r.aDespacho], ['operador', ['utilizador_papel']])
    assert.equal((await adm.get('/api/utilizadores')).body.find((x) => x.id === u.id).papelPedido, 'chefe')
    const [p] = (await pendentes()).filter((x) => x.utilizadorId === u.id)
    await decidir(p.id, 'deferido').expect(200)
    assert.equal((await adm.get('/api/utilizadores')).body.find((x) => x.id === u.id).papel, 'chefe')
    // um segundo Comandante já precisa de despacho
    assert.equal((await adm.post('/api/utilizadores').send({ nome: 'Outro Comandante', email: 'segundo.comandante@pessoal.ao', papel: 'comandante', senha: 'Escola#Cmd2026' }).expect(201)).body.aguardaDespacho, true)
  })

  it('o painel conta os pedidos por despachar só ao Comandante', async () => {
    const c = (await cmd.get('/api/avisos').expect(200)).body
    assert.ok(c.porDespachar >= 1)
    assert.equal((await adm.get('/api/avisos').expect(200)).body.porDespachar, 0)
  })
})
