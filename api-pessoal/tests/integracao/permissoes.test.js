import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente } from '../apoio/ambiente.js'

describe('dar e tirar tarefas a uma conta (ecrã a ecrã), com o despacho do Comandante', () => {
  let amb, adm, conta, op
  const entrarComo = async (email, senha, nova) => {
    const t = await amb.entrar(email, senha)
    return amb.com((await amb.com(t).post('/api/mudar-senha').send({ atual: senha, nova }).expect(200)).body.token)
  }
  before(async () => {
    amb = await criarAmbiente()
    adm = amb.com(await amb.entrar())
    conta = (await amb.criarConta(adm, { nome: 'Consulta Licencas', email: 'consulta.lic@pessoal.ao', papel: 'consulta', senha: 'Inicial2026x' })).body
    op = await entrarComo('consulta.lic@pessoal.ao', 'Inicial2026x', 'Licencas#2026y')
  })
  after(() => amb.fechar())

  it('a consulta vê, mas não marca licenças nem vê a auditoria', async () => {
    await op.get('/api/licencas').expect(200)
    await op.post('/api/licencas').send({}).expect(403)
    await op.get('/api/auditoria').expect(403)
    const eu = (await op.get('/api/eu').expect(200)).body
    assert.equal(eu.areas.licencas, 'ver')
    assert.equal(eu.permissoesProprias, false)
  })

  it('dar «alterar» nas licenças e tirar o livro de ponto: espera pelo despacho; deferido, vale', async () => {
    const atuais = (await adm.get('/api/utilizadores')).body.find((x) => x.id === conta.id).areas
    const { ponto, ...semPonto } = atuais
    void ponto
    const r = (await adm.put(`/api/utilizadores/${conta.id}`).send({ permissoes: { ...semPonto, licencas: 'alterar' } }).expect(200)).body
    assert.deepEqual(r.aDespacho, ['utilizador_permissoes'])
    // ainda não vale
    await op.get('/api/ponto/livro?data=2026-10-20').expect(200)
    assert.equal(await amb.deferirTudo(), 1)
    // agora vale: a sessão vê logo as permissões novas
    await op.get('/api/ponto/livro?data=2026-10-20').expect(403)
    const eu = (await op.get('/api/eu')).body
    assert.deepEqual([eu.areas.licencas, eu.areas.ponto, eu.permissoesProprias, eu.permissoes.includes('editar')], ['alterar', undefined, true, true])
    // com «alterar» só nas licenças, não mexe nas fichas
    await op.post('/api/pessoas').send({ tipo: 'civil', nome: 'Nao Pode Criar' }).expect(403)
    await op.post('/api/licencas/verificar').send({}).expect((x) => assert.notEqual(x.status, 403))
  })

  it('o Comandante vê o que muda; indeferido, fica como estava; voltar às do papel', async () => {
    await adm.put(`/api/utilizadores/${conta.id}`).send({ permissoes: { fichas: 'ver' } }).expect(200)
    const cmd = (await adm.get('/api/pedidos-despacho?estado=pendente')).body.find((x) => x.utilizadorId === conta.id)
    assert.match(cmd.resumo, /Tira: .*Licenças/)
    const comandante = await entrarComoComandante()
    await comandante.post(`/api/pedidos-despacho/${cmd.id}/decidir`).send({ decisao: 'indeferido', despacho: 'Continua com as licenças' }).expect(200)
    assert.equal((await op.get('/api/eu')).body.areas.licencas, 'alterar')
    // voltar às do papel (null)
    await adm.put(`/api/utilizadores/${conta.id}`).send({ permissoes: null }).expect(200)
    await amb.deferirTudo()
    const eu = (await op.get('/api/eu')).body
    assert.deepEqual([eu.permissoesProprias, eu.areas.licencas], [false, 'ver'])
  })

  it('o Comandante escolhe ele próprio o que a conta pode fazer (vale logo; o pedido pendente fica sem efeito)', async () => {
    await adm.put(`/api/utilizadores/${conta.id}`).send({ permissoes: { fichas: 'ver', auditoria: 'ver' } }).expect(200)
    const comandante = await entrarComoComandante()
    // o administrador não usa o ecrã do Comandante
    await adm.put(`/api/utilizadores/${conta.id}/permissoes`).send({ permissoes: { fichas: 'ver' } }).expect(403)
    const r = (await comandante.put(`/api/utilizadores/${conta.id}/permissoes`).send({ permissoes: { fichas: 'ver', ausencias: 'alterar' } }).expect(200)).body
    assert.deepEqual(r.areas, { fichas: 'ver', ausencias: 'alterar' })
    assert.equal((await op.get('/api/eu')).body.areas.ausencias, 'alterar')
    await op.get('/api/ausencias').expect(200)
    await op.get('/api/licencas').expect(403)
    assert.equal((await adm.get('/api/pedidos-despacho?estado=pendente')).body.filter((x) => x.utilizadorId === conta.id).length, 0)
    // o Comandante vê a lista das contas e não tira a si próprio a Secretária digital
    const contas = (await comandante.get('/api/utilizadores').expect(200)).body
    const eu = contas.find((x) => x.email === 'comandante.testes@pessoal.ao')
    await comandante.put(`/api/utilizadores/${eu.id}/permissoes`).send({ permissoes: { fichas: 'ver' } }).expect(400)
  })

  it('o administrador não tira a si próprio a gestão dos utilizadores', async () => {
    const eu = (await adm.get('/api/eu')).body
    await adm.put(`/api/utilizadores/${eu.id}`).send({ permissoes: { fichas: 'alterar' } }).expect(400)
  })

  // o Comandante dos testes (criado pelo ambiente ao deferir)
  async function entrarComoComandante() {
    const t = await amb.entrar('comandante.testes@pessoal.ao', 'Comandante2027y')
    return amb.com(t)
  }
})
