import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, militar } from '../apoio/ambiente.js'

/*
  O militar posto no cargo de Comandante (quadro orgânico) tem logo conta de Comandante: entra com o NIP e a
  palavra-passe inicial é o NIP. Quem sai do cargo deixa de ser Comandante.
*/
describe('Conta do Comandante pelo cargo do quadro orgânico', () => {
  let amb, adm, cargo, unidade
  before(async () => {
    amb = await criarAmbiente()
    adm = amb.com(await amb.entrar())
    unidade = (await adm.post('/api/unidades').send({ nome: 'Comando' }).expect(201)).body
    cargo = (await adm.post('/api/cargos').send({ nome: 'Comandante da Escola Superior de Guerra', unidadeId: unidade.id, funcao: 'comando', tipo: 'militar', postoRequerido: 'general', vagas: 1 }).expect(201)).body
  })
  after(() => amb.fechar())

  const entrar = (email, senha) => amb.http().post('/api/entrar').send({ email, senha })

  it('posto no cargo pela ficha: conta criada, entra com o NIP e a palavra-passe é o NIP (muda-a logo)', async () => {
    const a = (await adm.post('/api/pessoas').send(militar({ nome: 'General Primeiro Teste', nip: 'NIPCMD1', posto: 'general' })).expect(201)).body
    const r = await adm.put(`/api/pessoas/${a.id}`).send({ cargoId: cargo.id })
    assert.equal(r.status, 200, r.body.erro)
    const c = await amb.contentor.bd.utilizador.findFirst({ where: { pessoaId: a.id } })
    assert.deepEqual([c.papel, c.ativo, c.aguardaDespacho, c.deveMudar], ['comandante', true, false, true])
    const e = await entrar('NIPCMD1', 'NIPCMD1')
    assert.equal(e.status, 200, e.body.erro)
    assert.equal(e.body.utilizador.papel, 'comandante')
    // não se repete
    assert.equal((await amb.contentor.servicos.sessao.garantirContaDoComandante()).estado, 'ok')
  })

  it('um novo Comandante (já com conta de utente) passa a Comandante; o anterior deixa de o ser', async () => {
    const a = await amb.contentor.bd.pessoa.findFirst({ where: { nip: 'NIPCMD1' } })
    const b = (await adm.post('/api/pessoas').send(militar({ nome: 'General Segundo Teste', nip: 'NIPCMD2', posto: 'general' })).expect(201)).body
    const conta = (await adm.post('/api/utilizadores').send({ pessoaId: b.id, papel: 'utente' }).expect(201)).body
    await amb.contentor.bd.pessoa.update({ where: { id: a.id }, data: { cargoId: null } })
    await amb.contentor.bd.pessoa.update({ where: { id: b.id }, data: { cargoId: cargo.id, dataCargo: new Date() } })
    // o extracto ou a importação mudam o cargo sem passar pela ficha: apanha-se de minuto a minuto
    const r = await amb.contentor.servicos.sessao.garantirContaDoComandante()
    assert.deepEqual([r.estado, r.utilizadorId, r.saidas], ['promovida', conta.id, 1])
    assert.equal((await amb.contentor.bd.utilizador.findUnique({ where: { id: conta.id } })).papel, 'comandante')
    assert.equal((await amb.contentor.bd.utilizador.findFirst({ where: { pessoaId: a.id } })).papel, 'utente')
  })

  it('cargo vago: a conta de Comandante feita à mão fica como está', async () => {
    await amb.contentor.bd.pessoa.updateMany({ where: { cargoId: cargo.id }, data: { cargoId: null } })
    assert.deepEqual(await amb.contentor.servicos.sessao.garantirContaDoComandante(), { estado: 'vago', saidas: 0 })
    assert.equal((await amb.contentor.bd.utilizador.findFirst({ where: { pessoa: { nip: 'NIPCMD2' } } })).papel, 'comandante')
  })
})

describe('Contas de civis: entram como os militares, com o n.º de agente', () => {
  let amb, adm
  before(async () => {
    amb = await criarAmbiente()
    adm = amb.com(await amb.entrar())
  })
  after(() => amb.fechar())
  const entrar = (email, senha) => amb.http().post('/api/entrar').send({ email, senha })

  it('o civil entra com o n.º de agente e a palavra-passe inicial é o n.º de agente; muda-a e pode repô-la', async () => {
    const p = (await adm.post('/api/pessoas').send({ tipo: 'civil', vinculo: 'funcionario', nome: 'Ana Civil Conta Teste', genero: 'F', numeroAgente: 'AG7001', carreiraCivil: 'tecnico_medio' }).expect(201)).body
    const c = (await adm.post('/api/utilizadores').send({ pessoaId: p.id, papel: 'utente' }).expect(201)).body
    const lista = (await adm.get('/api/utilizadores').expect(200)).body
    assert.deepEqual([lista.find((x) => x.id === c.id).nip, lista.find((x) => x.id === c.id).identificador], ['AG7001', 'n.º de agente'])
    const e = await entrar('ag7001', 'AG7001')
    assert.equal(e.status, 200, e.body.erro)
    assert.equal(e.body.utilizador.deveMudar, true)
    const eu = amb.com(e.body.token)
    const m = await eu.post('/api/mudar-senha').send({ atual: 'AG7001', nova: 'AG7001' })
    assert.equal(m.status, 400)
    assert.match(m.body.erro, /n\.º de agente/)
    await eu.post('/api/mudar-senha').send({ atual: 'AG7001', nova: 'Civil-nova-2026' }).expect(200)
    assert.equal((await entrar('AG7001', 'Civil-nova-2026')).status, 200)
    // o administrador repõe: volta ao n.º de agente
    await adm.put(`/api/utilizadores/${c.id}`).send({ reporNip: true }).expect(200)
    assert.equal((await entrar('AG7001', 'AG7001')).status, 200)
  })

  it('nas contas em lote, o civil também fica com o n.º de agente; sem ele, uma palavra-passe gerada', async () => {
    await adm.post('/api/pessoas').send({ tipo: 'civil', vinculo: 'funcionario', nome: 'Bento Civil Lote Teste', genero: 'M', numeroAgente: 'AG7002', carreiraCivil: 'tecnico_medio' }).expect(201)
    await adm.post('/api/pessoas').send({ tipo: 'civil', vinculo: 'funcionario', nome: 'Carla Civil Sem Numero', genero: 'F', carreiraCivil: 'tecnico_medio' }).expect(201)
    const l = (await adm.post('/api/utilizadores/contas-pessoas').send({}).expect(200)).body
    const lista = Array.isArray(l) ? l : l.criadas ?? l.contas
    assert.equal(lista.find((x) => x.nome === 'Bento Civil Lote Teste').senha, 'AG7002')
    assert.notEqual(lista.find((x) => x.nome === 'Carla Civil Sem Numero').senha, '')
    assert.equal((await entrar('AG7002', 'AG7002')).status, 200)
  })
})

describe('Civis no Portal Académico', () => {
  it('o docente civil (com o e-mail da Escola) vai para o portal como os militares', async () => {
    const enviados = []
    const enviar = async (url, op) => {
      const corpo = JSON.parse(op.body)
      if (url.endsWith('/contas')) { enviados.push(...corpo.pessoas); return { ok: true, status: 200, json: async () => ({ resultados: corpo.pessoas.map((p, i) => ({ ref: p.ref, ok: true, contaId: 500 + i })) }) } }
      return { ok: true, status: 200, json: async () => ({ ok: true, resultados: [] }) }
    }
    const amb = await criarAmbiente({ env: { PORTAL_API_URL: 'http://portal.interno:3001', INTEGRACAO_CHAVE: 'chave-partilhada-com-o-portal-de-32-caracteres-ou-mais' }, enviar })
    try {
      const adm = amb.com(await amb.entrar())
      const r = await adm.post('/api/pessoas').send({ tipo: 'civil', vinculo: 'docente', nome: 'Professora Civil Teste', genero: 'F', numeroAgente: 'AG7100', carreiraCivil: 'tecnico_superior', email: 'prof.civil@esgfaa.gov.ao' })
      assert.equal(r.status, 201, r.body.erro)
      await amb.deferirTudo() // o docente novo espera o despacho do Comandante
      await amb.contentor.servicos.sincronizacao.enviarPendentes()
      const d = enviados.find((x) => x.email === 'prof.civil@esgfaa.gov.ao')
      assert.deepEqual([d?.tipo, d?.ativo, d?.dados.posto], ['docente', true, ''])
    } finally {
      await amb.fechar()
    }
  })
})
