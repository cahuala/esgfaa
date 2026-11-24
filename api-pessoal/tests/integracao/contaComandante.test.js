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

describe('Contas automáticas dos civis da Repartição de Pessoal e Quadros: entram com o BI', () => {
  let amb, adm
  before(async () => {
    amb = await criarAmbiente()
    adm = amb.com(await amb.entrar())
  })
  after(() => amb.fechar())
  const entrar = (email, senha) => amb.http().post('/api/entrar').send({ email, senha })

  it('o civil da Repartição (ou de uma secção dela) tem logo conta de Operador: entra com o BI e a palavra-passe é o BI', async () => {
    const rpq = (await adm.post('/api/unidades').send({ nome: 'Repartição de Pessoal e Quadros' }).expect(201)).body
    const seccao = (await adm.post('/api/unidades').send({ nome: 'Secção de Cadastro', paiId: rpq.id }).expect(201)).body
    const outra = (await adm.post('/api/unidades').send({ nome: 'Repartição de Logística' }).expect(201)).body
    const civil = (extra) => ({ tipo: 'civil', vinculo: 'funcionario', genero: 'F', carreiraCivil: 'tecnico_medio', ...extra })
    const a = (await adm.post('/api/pessoas').send(civil({ nome: 'Rosa Civil Repartição', bi: '001234567LA041', unidadeId: seccao.id })).expect(201)).body
    await adm.post('/api/pessoas').send(civil({ nome: 'Lia Civil Logística', bi: '009876543LA042', unidadeId: outra.id })).expect(201)
    const c = await amb.contentor.bd.utilizador.findFirst({ where: { pessoaId: a.id } })
    assert.deepEqual([c.papel, c.ativo, c.aguardaDespacho, c.deveMudar, Boolean(c.biHash), c.biHash.includes('001234567')], ['operador', true, false, true, true, false])
    assert.equal(await amb.contentor.bd.utilizador.count({ where: { nome: 'Lia Civil Logística' } }), 0)
    const e = await entrar('001234567la041', '001234567LA041')
    assert.equal(e.status, 200, e.body.erro)
    const eu = amb.com(e.body.token)
    assert.match((await eu.post('/api/mudar-senha').send({ atual: '001234567LA041', nova: '001234567LA041' })).body.erro, /BI/)
    await eu.post('/api/mudar-senha').send({ atual: '001234567LA041', nova: 'Rosa-nova-2026x' }).expect(200)
    // a lista mostra que entra com o BI (sem o BI em claro); o administrador repõe para o BI
    const l = (await adm.get('/api/utilizadores').expect(200)).body.find((x) => x.id === c.id)
    assert.deepEqual([l.identificador, l.nip], ['BI', null])
    await adm.put(`/api/utilizadores/${c.id}`).send({ reporNip: true }).expect(200)
    assert.equal((await entrar('001234567LA041', '001234567LA041')).status, 200)
    // não se repete
    assert.deepEqual(await amb.contentor.servicos.sessao.garantirContasCivis(), { criadas: 0 })
    // uma entrada falhada com o BI não o deixa em claro na auditoria
    await entrar('001234567LA041', 'errada-de-proposito')
    const reg = await amb.contentor.bd.auditoria.findMany({ where: { acao: 'entrada_falhada' } })
    assert.ok(reg.length && reg.every((x) => !x.utilizador.includes('001234567')))
  })
})

describe('Civis da Direcção de Ensino: conta no painel de gestão, com o BI', () => {
  it('vão para o painel (ficha, nome, impressão do BI e palavra-passe inicial cifrada); o BI não sai daqui', async () => {
    const chave = 'chave-partilhada-com-o-portal-de-32-caracteres-ou-mais'
    const envios = []
    const enviar = async (url, op) => {
      if (url.endsWith('/contas-ensino')) envios.push({ corpo: JSON.parse(op.body), raw: op.body, h: op.headers })
      return { ok: true, status: 200, json: async () => ({ resultados: [], ok: true }) }
    }
    const amb = await criarAmbiente({ env: { PORTAL_API_URL: 'http://portal.interno:3001', INTEGRACAO_CHAVE: chave }, enviar })
    try {
      const adm = amb.com(await amb.entrar())
      const de = (await adm.post('/api/unidades').send({ nome: 'Direcção de Ensino' }).expect(201)).body
      const sec = (await adm.post('/api/unidades').send({ nome: 'Repartição de Administração Escolar', paiId: de.id }).expect(201)).body
      const civil = (extra) => ({ tipo: 'civil', vinculo: 'funcionario', genero: 'F', carreiraCivil: 'tecnico_medio', ...extra })
      const a = (await adm.post('/api/pessoas').send(civil({ nome: 'Joana Civil Ensino', bi: '001111111LA011', unidadeId: sec.id })).expect(201)).body
      await adm.post('/api/pessoas').send(militar({ nome: 'Militar do Ensino', unidadeId: de.id })).expect(201)
      const s = amb.contentor.servicos.sincronizacao
      await s.enviarContasEnsino()
      const e = envios.at(-1)
      assert.equal(e.corpo.contas.length, 1)
      const c = e.corpo.contas[0]
      assert.equal(c.ref, `pessoal-${a.id}`)
      assert.equal(c.bi, (await import('node:crypto')).createHmac('sha256', chave).update('bi:001111111LA011').digest('hex'))
      assert.match(c.senha, /^scrypt\$/)
      assert.ok(!e.raw.includes('001111111')) // o BI não sai em claro
      assert.deepEqual(await s.enviarContasEnsino(), { enviado: false, igual: true })
      // os chefes militares: o Director de Ensino e o Chefe da Repartição de Administração Escolar vão com o NIP e o papel
      // do cargo; o motorista do Director (também com «Ensino» no cargo) não vai
      const cargo = async (nome, unidadeId) => (await adm.post('/api/cargos').send({ nome, unidadeId, funcao: 'direccao_chefia', tipo: 'militar', vagas: 1 }).expect(201)).body
      const cDir = await cargo('Director da Direcção de Ensino da Escola Superior de Guerra', de.id)
      const cChefe = await cargo('Chefe da Repartição de Administração Escolar da Direcção de Ensino', sec.id)
      const cMot = await cargo('Motorista do Director de Ensino da Escola Superior de Guerra', de.id)
      const dir = (await adm.post('/api/pessoas').send(militar({ nome: 'Director Ensino Teste', nip: '10576093', posto: 'brigadeiro', unidadeId: de.id, cargoId: cDir.id })).expect(201)).body
      const chefe = (await adm.post('/api/pessoas').send(militar({ nome: 'Chefe Administracao Escolar Teste', nip: '20576094', posto: 'coronel', unidadeId: sec.id, cargoId: cChefe.id })).expect(201)).body
      await adm.post('/api/pessoas').send(militar({ nome: 'Motorista Teste', nip: '30576095', unidadeId: de.id, cargoId: cMot.id })).expect(201)
      await s.enviarContasEnsino()
      const crypto = await import('node:crypto')
      const porRef = Object.fromEntries(envios.at(-1).corpo.contas.map((x) => [x.ref, x]))
      assert.equal(Object.keys(porRef).length, 3)
      assert.deepEqual([porRef[`pessoal-${dir.id}`].papel, porRef[`pessoal-${chefe.id}`].papel], ['director_ensino', 'secretaria'])
      assert.equal(porRef[`pessoal-${dir.id}`].bi, crypto.createHmac('sha256', chave).update('nip:10576093').digest('hex'))
      assert.ok(!envios.at(-1).raw.includes('10576093')) // o NIP não sai em claro
      assert.equal(porRef[`pessoal-${a.id}`].papel, 'secretaria') // civil da Repartição de Administração Escolar
      // a Área Científica (os chefes dos departamentos) e o Gabinete do Director de Ensino também têm conta, com o seu papel;
      // um professor do departamento (sem chefia) não: usa o Portal Académico
      const dep = (await adm.post('/api/unidades').send({ nome: 'Departamento de Estratégia', paiId: de.id }).expect(201)).body
      const apoio = (await adm.post('/api/unidades').send({ nome: 'Secção de Planeamento e Coordenação', paiId: de.id }).expect(201)).body
      const cChefeDep = await cargo('Chefe do Departamento de Estratégia da Direcção de Ensino', dep.id)
      const cProf = await cargo('Professor de Estratégia do Departamento de Estratégia', dep.id)
      const cPlan = await cargo('Oficial de Planeamento da Secção de Planeamento e Coordenação', apoio.id)
      const chefeDep = (await adm.post('/api/pessoas').send(militar({ nome: 'Chefe Departamento Teste', nip: '40576096', posto: 'coronel', unidadeId: dep.id, cargoId: cChefeDep.id })).expect(201)).body
      await adm.post('/api/pessoas').send(militar({ nome: 'Professor Departamento Teste', nip: '50576097', posto: 'major', unidadeId: dep.id, cargoId: cProf.id })).expect(201)
      const plan = (await adm.post('/api/pessoas').send(militar({ nome: 'Oficial Planeamento Teste', nip: '60576098', posto: 'major', unidadeId: apoio.id, cargoId: cPlan.id })).expect(201)).body
      await s.enviarContasEnsino()
      const porRef2 = Object.fromEntries(envios.at(-1).corpo.contas.map((x) => [x.ref, x.papel]))
      assert.deepEqual([porRef2[`pessoal-${chefeDep.id}`], porRef2[`pessoal-${plan.id}`], Object.keys(porRef2).length], ['area_cientifica', 'gabinete_ensino', 5])
      // sai da Direcção de Ensino: a lista vai vazia (o painel desactiva a conta)
      await amb.contentor.bd.pessoa.updateMany({ where: { id: { in: [a.id, dir.id, chefe.id, chefeDep.id, plan.id] } }, data: { unidadeId: null } })
      await s.enviarContasEnsino()
      assert.deepEqual(envios.at(-1).corpo, { contas: [] })
    } finally {
      await amb.fechar()
    }
  })
})

describe('O administrador activa uma conta à espera do despacho do Comandante', () => {
  it('a conta fica activa, entra, e o pedido ao Comandante fica anulado (na auditoria)', async () => {
    const amb = await criarAmbiente()
    try {
      const adm = amb.com(await amb.entrar())
      await amb.deferirTudo() // há Comandante: as contas acima de utente esperam o despacho
      const c = (await adm.post('/api/utilizadores').send({ nome: 'Operadora Nova Teste', email: 'operadora.nova@esg.emfaa.gov.ao', papel: 'operador', senha: 'Operadora2026x' }).expect(201)).body
      assert.deepEqual(c.aDespacho, ['utilizador_novo'])
      assert.equal((await amb.http().post('/api/entrar').send({ email: 'operadora.nova@esg.emfaa.gov.ao', senha: 'Operadora2026x' })).body.codigo, 'aguarda_despacho')
      const r = (await adm.put(`/api/utilizadores/${c.id}`).send({ ativo: true }).expect(200)).body
      assert.deepEqual([r.ativo, r.aguardaDespacho], [true, false])
      assert.equal((await amb.http().post('/api/entrar').send({ email: 'operadora.nova@esg.emfaa.gov.ao', senha: 'Operadora2026x' })).status, 200)
      const p = await amb.contentor.bd.pedidoDespacho.findFirst({ where: { tipo: 'utilizador_novo', utilizadorId: c.id } })
      assert.equal(p.estado, 'anulado')
      assert.ok(await amb.contentor.bd.auditoria.findFirst({ where: { acao: 'activar_sem_despacho' } }))
    } finally {
      await amb.fechar()
    }
  })
})

describe('O Operador regista fichas e emite documentos; não edita', () => {
  it('regista uma ficha nova e emite-lhe uma declaração; não edita, nem orgânica, propostas, licenças ou salários', async () => {
    const amb = await criarAmbiente()
    try {
      const adm = amb.com(await amb.entrar())
      const c = (await adm.post('/api/utilizadores').send({ nome: 'Operador Registo Teste', email: 'op.registo@esg.emfaa.gov.ao', papel: 'operador', senha: 'Operador2026x' }).expect(201)).body
      await adm.put(`/api/utilizadores/${c.id}`).send({ ativo: true }).expect(200)
      const t = (await amb.http().post('/api/entrar').send({ email: 'op.registo@esg.emfaa.gov.ao', senha: 'Operador2026x' }).expect(200)).body.token
      const op = amb.com((await amb.com(t).post('/api/mudar-senha').send({ atual: 'Operador2026x', nova: 'Operador2027y' }).expect(200)).body.token)
      const eu = (await op.get('/api/eu').expect(200)).body
      assert.deepEqual(eu.areas, { fichas: 'ver', registarFichas: 'alterar', documentos: 'alterar' })
      const p = (await op.post('/api/pessoas').send(militar({ nome: 'Registado Pelo Operador', nip: 'NIPOPR1' })).expect(201)).body
      await op.put(`/api/pessoas/${p.id}`).send({ nome: 'Mudado Pelo Operador' }).expect(403)
      const d = await op.post(`/api/pessoas/${p.id}/documentos-emitidos`).send({ documentos: [{ tipo: 'declaracao_servico', dados: { finalidade: 'Banco' } }] })
      assert.equal(d.status, 201, d.body.erro)
      await op.post('/api/declaracoes/impressoes').send({ ids: [d.body[0].id] }).expect(200)
      for (const [m, url] of [['get', '/api/propostas'], ['get', '/api/licencas'], ['get', '/api/tabela-salarial'], ['post', '/api/unidades'], ['get', '/api/utilizadores'], ['get', '/api/auditoria']]) {
        assert.equal((await op[m](url).send({ nome: 'X' })).status, 403, `${m} ${url}`)
      }
    } finally {
      await amb.fechar()
    }
  })
})
