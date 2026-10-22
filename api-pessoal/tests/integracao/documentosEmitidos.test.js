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
    assert.deepEqual(smo.linhas.map((l) => l.posto), ['aspirante', 'subsargento', 'primeiro_cabo', 'segundo_cabo', 'soldado'])
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

  it('tabela salarial dos civis por cargo (como no SIGP): o vencimento do cargo vai para a ficha', async () => {
    const cg = (await adm.post('/api/cargos').send({ nome: 'Operador de Computador', tipo: 'civil', funcao: 'execucao', vagas: 2 }))
    assert.ok([200, 201].includes(cg.status), JSON.stringify(cg.body))
    const t = (await adm.get('/api/tabela-salarial-civis/cargos').expect(200)).body
    const l = t.find((x) => x.nome === 'Operador de Computador')
    assert.deepEqual([l.lugares, l.vencimento], [2, null])
    const novo = (await adm.put('/api/tabela-salarial-civis/cargos').send({ chave: l.chave, vencimento: 172408.5 }).expect(200)).body
    assert.equal(novo.find((x) => x.chave === l.chave).vencimento, 172408.5)
    assert.equal((await adm.put('/api/tabela-salarial-civis/cargos').send({ chave: 'inventado', vencimento: 1 })).status, 400)
    const c = (await adm.post('/api/pessoas').send({ tipo: 'civil', vinculo: 'funcionario', nome: 'Jodiana Suja Manuel', genero: 'F', carreiraCivil: 'tecnico_medio', cargoId: cg.body.id })).body
    assert.equal((await adm.get(`/api/pessoas/${c.id}`)).body.vencimentoCargo, 172408.5)
    await adm.put('/api/tabela-salarial-civis/cargos').send({ chave: l.chave, vencimento: null }).expect(200)
    assert.equal((await adm.get(`/api/pessoas/${c.id}`)).body.vencimentoCargo, null)
  })

  it('o militar pode ser funcionário e também docente e aluno; aparece nas listas de cada função', async () => {
    const m = (await adm.post('/api/pessoas').send(militar({ nip: 'VIN001', vinculo: 'funcionario', outrosVinculos: ['docente', 'estudante', 'funcionario'] })).expect(201)).body
    const f = (await adm.get(`/api/pessoas/${m.id}`)).body
    assert.deepEqual(f.vinculos, ['funcionario', 'docente', 'estudante'])
    assert.equal(f.vinculoNome, 'Funcionário · Docente · Estudante')
    assert.ok(f.docente && f.discente)
    assert.ok((await adm.get('/api/pessoas?vinculo=docente')).body.some((x) => x.id === m.id))
    assert.ok((await adm.get('/api/pessoas?vinculo=estudante')).body.some((x) => x.id === m.id))
    assert.equal((await adm.post('/api/pessoas').send(militar({ nip: 'VIN002', outrosVinculos: ['domiciliar'] }))).status, 400)
  })

  it('histórico dos efectivos: quem sai fica com a data, o motivo e o destino; ao voltar apaga-se a saída', async () => {
    const m = (await adm.post('/api/pessoas').send(militar({ nip: 'SAI001', dataEntradaEscola: '2020-03-01' })).expect(201)).body
    await adm.put(`/api/pessoas/${m.id}`).send({ ativo: false, motivoSaida: 'Transferência', destinoSaida: 'Comando do Exército', dataSaidaEscola: '2026-09-30' }).expect(200)
    let f = (await adm.get(`/api/pessoas/${m.id}`)).body
    assert.deepEqual([f.ativo, f.dataEntradaEscola, f.dataSaidaEscola, f.motivoSaida, f.destinoSaida], [false, '2020-03-01', '2026-09-30', 'Transferência', 'Comando do Exército'])
    assert.ok(f.eventos.some((e) => e.tipo === 'saida' && /Transferência/.test(e.descricao)))
    assert.ok((await adm.get('/api/pessoas?ativo=todos')).body.some((x) => x.id === m.id))
    await adm.put(`/api/pessoas/${m.id}`).send({ ativo: true }).expect(200)
    f = (await adm.get(`/api/pessoas/${m.id}`)).body
    assert.deepEqual([f.ativo, f.dataSaidaEscola, f.motivoSaida], [true, null, ''])
  })

  it('controlo das declarações: lista com filtros e impressões contadas', async () => {
    const l = (await adm.get('/api/declaracoes').expect(200)).body
    assert.ok(l.length >= 3)
    assert.ok(l.every((x) => x.tipo.startsWith('declaracao_') && x.referencia.startsWith('Nº')))
    const primeira = l.find((x) => x.finalidade === 'Actualização de Conta Bancária')
    assert.equal(primeira.pessoa.nome, p.nome)
    assert.equal((await adm.get('/api/declaracoes?q=conta bancária')).body.length, 1)
    assert.equal((await adm.get('/api/declaracoes?de=2000-01-01&ate=2000-12-31')).body.length, 0)
    await adm.post('/api/declaracoes/impressoes').send({ ids: [primeira.id] }).expect(200)
    await adm.post('/api/declaracoes/impressoes').send({ ids: [primeira.id] }).expect(200)
    assert.equal((await adm.get('/api/declaracoes')).body.find((x) => x.id === primeira.id).impressoes, 2)
  })

  it('declarações para os bancos (modelos do SIGP) na mesma série; ficha do docente colaborador', async () => {
    const r = (await adm.post(`/api/pessoas/${p.id}/documentos-emitidos`).send({ documentos: [{ tipo: 'declaracao_bfa_credito', dados: { finalidade: 'Crédito Pessoal (BFA)' } }, { tipo: 'declaracao_bpc_salario' }, { tipo: 'ficha_docente' }] }).expect(201)).body
    assert.ok(r[0].numero > 0 && r[1].numero === r[0].numero + 1 && r[2].numero === null)
    assert.ok((await adm.get('/api/declaracoes?q=BFA')).body.some((x) => x.tipo === 'declaracao_bfa_credito'))
    const d = (await adm.post('/api/pessoas').send({ tipo: 'civil', vinculo: 'docente', nome: 'Docente Colaborador Teste', tipoDocente: 'colaborador', funcaoActual: 'Investigador do CEEA', paisNascimento: 'Portugal', agregado: [{ nome: 'Filho Teste', parentesco: 'Filho(a)', bi: '001234567LA041', genero: 'M' }] }).expect(201)).body
    const f = (await adm.get(`/api/pessoas/${d.id}`)).body
    assert.deepEqual([f.tipoDocente, f.funcaoActual, f.paisNascimento, f.agregado[0].genero], ['colaborador', 'Investigador do CEEA', 'Portugal', 'M'])
  })

  it('registo biográfico (cifrado) e disciplina dos civis: punições e condenações com a pena', async () => {
    const c = (await adm.post('/api/pessoas').send({ tipo: 'civil', vinculo: 'funcionario', nome: 'Civil Disciplina Teste' }).expect(201)).body
    const registo = { estudos: [{ classe: '12.ª', ano: '2001' }], linguas: [{ lingua: 'Inglês', nivel: 'B' }], situacaoMilitar: { tipo: 'isento', desde: '', reiniciou: '' }, saude: { dador: true, defeitoFisico: '', doencas: '' }, assiduidade: [{ ano: '2025', justificadas: '2', injustificadas: '1' }], outrasInformacoes: 'Nada a assinalar.' }
    await adm.put(`/api/pessoas/${c.id}`).send({ registo }).expect(200)
    assert.equal((await adm.put(`/api/pessoas/${c.id}`).send({ registo: { linguas: [{ lingua: 'Inglês', nivel: 'X' }] } })).status, 400)
    await adm.post(`/api/pessoas/${c.id}/eventos`).send({ tipo: 'punicao', data: '2025-03-10', descricao: 'Faltas injustificadas', pena: 'Repreensão registada', entidade: 'Director' }).expect(201)
    await adm.post(`/api/pessoas/${c.id}/eventos`).send({ tipo: 'condenacao', data: '2024-06-01', descricao: 'Crime', pena: 'Pena suspensa', entidade: 'Tribunal Provincial' }).expect(201)
    const f = (await adm.get(`/api/pessoas/${c.id}`)).body
    assert.deepEqual([f.registo.estudos[0].classe, f.registo.situacaoMilitar.tipo, f.registo.saude.dador, f.registo.assiduidade[0].injustificadas], ['12.ª', 'isento', true, '1'])
    assert.deepEqual(f.eventos.filter((e) => ['punicao', 'condenacao'].includes(e.tipo)).map((e) => [e.tipo, e.pena]).sort(), [['condenacao', 'Pena suspensa'], ['punicao', 'Repreensão registada']])
    const bruto = await amb.contentor.base.pessoa.findUnique({ where: { id: c.id }, select: { registo: true } })
    assert.match(bruto.registo, /^c1:/)
  })
})
