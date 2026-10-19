import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, militar } from '../apoio/ambiente.js'

describe('Documentos pessoais emitidos (declarações numeradas, guias, fichas) e assinaturas', () => {
  let amb, adm, p
  before(async () => {
    amb = await criarAmbiente()
    adm = amb.com(await amb.entrar())
    p = (await adm.post('/api/pessoas').send(militar({ nip: 'DOC001', vencimento: 410945.74, conjuge: 'Ana Kiala', agregado: [{ nome: 'Pedro Kiala', parentesco: 'Filho', dataNascimento: '2012-05-01' }], grupoSanguineo: 'O+', bairro: 'Talatona' })).expect(201)).body
  })
  after(() => amb.fechar())

  it('a ficha guarda os campos novos (agregado, vencimento cifrados) e devolve-os', async () => {
    const f = (await adm.get(`/api/pessoas/${p.id}`)).body
    assert.equal(f.vencimento, 410945.74)
    assert.deepEqual(f.agregado.map((a) => a.nome), ['Pedro Kiala'])
    assert.deepEqual([f.conjuge, f.grupoSanguineo, f.bairro], ['Ana Kiala', 'O+', 'Talatona'])
    const bruto = await amb.contentor.base.pessoa.findUnique({ where: { id: p.id }, select: { vencimento: true, agregado: true, conjuge: true } })
    for (const k of ['vencimento', 'agregado', 'conjuge']) assert.match(bruto[k], /^c1:/, k)
    assert.equal((await adm.post('/api/pessoas').send(militar({ nip: 'DOC002', grupoSanguineo: 'Z+' }))).status, 400)
  })

  it('as declarações têm número seguido por ano (série única); guias e fichas não', async () => {
    const r = (await adm.post(`/api/pessoas/${p.id}/documentos-emitidos`).send({ documentos: [
      { tipo: 'declaracao_efectividade', dados: { finalidade: 'Actualização de Conta Bancária' } },
      { tipo: 'guia_ferias', dados: { dias: 30, inicio: '2026-11-02' } },
      { tipo: 'declaracao_salario', dados: { valor: 410945.74 } },
      { tipo: 'ficha_individual' },
    ] }).expect(201)).body
    assert.deepEqual(r.map((x) => [x.tipo, x.numero]), [['declaracao_efectividade', 1], ['guia_ferias', null], ['declaracao_salario', 2], ['ficha_individual', null]])
    const r2 = (await adm.post(`/api/pessoas/${p.id}/documentos-emitidos`).send({ documentos: [{ tipo: 'declaracao_efectividade' }] }).expect(201)).body
    assert.equal(r2[0].numero, 3)
    const h = (await adm.get(`/api/pessoas/${p.id}/documentos-emitidos`).expect(200)).body
    assert.equal(h.length, 5)
    assert.equal(h.find((x) => x.tipo === 'guia_ferias').dados.dias, 30)
    assert.equal((await adm.post(`/api/pessoas/${p.id}/documentos-emitidos`).send({ documentos: [{ tipo: 'inventado' }] })).status, 400)
  })

  it('as assinaturas definem-se uma vez (só o administrador)', async () => {
    const vazio = (await adm.get('/api/definicoes/assinaturas').expect(200)).body
    assert.equal(vazio.comandante.cargo, 'O COMANDANTE DA ESG')
    const novo = { comandante: { cargo: 'O COMANDANTE DA ESG', nome: 'Nome Fictício do Comandante', posto: 'Tenente General' }, chefeRpq: { cargo: 'O CHEFE DA REPARTIÇÃO DE PESSOAL E QUADROS', nome: 'Nome do Chefe', posto: 'Coronel' }, local: 'Luanda' }
    assert.deepEqual((await adm.put('/api/definicoes/assinaturas').send(novo).expect(200)).body.comandante, novo.comandante)
  })

  it('tabela salarial como a do SIGP: componentes calculadas, só o vencimento base se altera', async () => {
    const t = (await adm.get('/api/tabela-salarial').expect(200)).body
    const qp = t.grupos.find((g) => g.fps === 'QP')
    const cor = qp.linhas.find((l) => l.posto === 'coronel')
    assert.deepEqual([cor.base, cor.condicaoMilitar, cor.representacao, cor.comandoChefia, cor.iliquido], [360000, 108000, 56008.72, 18000, 542008.72])
    assert.equal(cor.caixaSS, 16260.26)
    assert.equal(qp.linhas.find((l) => l.posto === 'brigadeiro').comandoChefia, 0)
    const smo = t.grupos.find((g) => g.fps === 'SMO')
    assert.deepEqual(smo.linhas.map((l) => l.posto), ['aspirante', 'subsargento', 'segundo_cabo', 'soldado'])
    assert.equal(smo.linhas[0].comandoChefia, 0)
    const novo = (await adm.put('/api/tabela-salarial/coronel').send({ base: 400000 }).expect(200)).body
    assert.equal(novo.grupos.find((g) => g.fps === 'QP').linhas.find((l) => l.posto === 'coronel').condicaoMilitar, 120000)
    assert.equal((await adm.put('/api/tabela-salarial/inventado').send({ base: 1 })).status, 400)
    const c = (await adm.post('/api/pessoas').send(militar({ nip: 'SAL001', posto: 'coronel', fps: 'QP', iban: 'AO06 0040 0000 1234', banco: 'BPC' })).expect(201)).body
    const f = (await adm.get(`/api/pessoas/${c.id}`)).body
    assert.equal(f.vencimentoTabela.base, 400000)
    assert.equal(f.iban, 'AO06 0040 0000 1234')
    assert.match((await amb.contentor.base.pessoa.findUnique({ where: { id: c.id }, select: { iban: true } })).iban, /^c1:/)
  })

  it('plano de férias: um mês por pessoa e ano, importação por NIP; a guia de férias regista a licença', async () => {
    const m = (await adm.post('/api/pessoas').send(militar({ nip: 'FER001', dataIngresso: '2000-01-01' })).expect(201)).body
    await adm.put('/api/plano-ferias').send({ ano: 2026, pessoaId: m.id, mes: 7 }).expect(200)
    let v = (await adm.get('/api/plano-ferias?ano=2026').expect(200)).body
    const l = v.linhas.find((x) => x.id === m.id)
    assert.deepEqual([l.mes, l.dias, l.adicionais], [7, 30, 15])
    const r = (await adm.post('/api/plano-ferias/importar').send({ ano: 2026, linhas: [{ identificador: 'FER001', mes: 'Agosto' }, { identificador: 'NAOEXISTE', mes: '3' }, { identificador: 'FER001', mes: 'Brumário' }] }).expect(200)).body
    assert.equal(r.feitos, 1)
    assert.equal(r.avisos.length, 2)
    v = (await adm.get('/api/plano-ferias?ano=2026').expect(200)).body
    assert.equal(v.linhas.find((x) => x.id === m.id).mes, 8)
    const f = (await adm.get(`/api/pessoas/${m.id}`)).body
    assert.deepEqual(f.planoFerias, [{ ano: 2026, mes: 8 }])
    assert.equal(f.diasFerias, 30)
    await adm.post(`/api/pessoas/${m.id}/documentos-emitidos`).send({ documentos: [{ tipo: 'guia_ferias', dados: { inicio: '2026-08-01', dias: 30 } }] }).expect(201)
    const lic = (await adm.get(`/api/licencas?pessoaId=${m.id}`).expect(200)).body
    assert.deepEqual(lic.map((x) => [x.tipo, x.inicio, x.fim, x.dias]), [['ferias', '2026-08-01', '2026-08-30', 30]])
    await adm.post(`/api/pessoas/${m.id}/documentos-emitidos`).send({ documentos: [{ tipo: 'guia_ferias', dados: { inicio: '2026-08-01', dias: 30 } }] }).expect(201)
    assert.equal((await adm.get(`/api/licencas?pessoaId=${m.id}`)).body.length, 1)
    await adm.put('/api/plano-ferias').send({ ano: 2026, pessoaId: m.id, mes: null }).expect(200)
    assert.equal((await adm.get('/api/plano-ferias?ano=2026')).body.linhas.find((x) => x.id === m.id).mes, null)
  })

  it('tabela salarial dos civis: vencimento base por categoria, líquido nas declarações', async () => {
    const t = (await adm.get('/api/tabela-salarial-civis').expect(200)).body
    const aux = t.find((x) => x.categoria === 'auxiliar_servicos_gerais')
    assert.deepEqual([aux.vencimentoBase, aux.liquido], [150000, 150000 + 9000 + 6000 - 4500 - 10500])
    const novo = (await adm.put('/api/tabela-salarial-civis/auxiliar_servicos_gerais').send({ base: 160000 }).expect(200)).body
    assert.equal(novo.find((x) => x.categoria === 'auxiliar_servicos_gerais').vencimentoBase, 160000)
    assert.equal((await adm.put('/api/tabela-salarial-civis/docente').send({ base: 1 })).status, 400)
    const c = (await adm.post('/api/pessoas').send({ tipo: 'civil', vinculo: 'funcionario', nome: 'Maria Teresa Kiala', genero: 'F', carreiraCivil: 'auxiliar_servicos_gerais', categoriaCivil: 'Auxiliar de Serviços Gerais de 2.ª Classe' }).expect(201)).body
    assert.equal((await adm.get(`/api/pessoas/${c.id}`)).body.remuneracao.vencimentoBase, 160000)
  })
})
