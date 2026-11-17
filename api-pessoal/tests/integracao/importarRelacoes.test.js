import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente } from '../apoio/ambiente.js'

// as relações nominais da Escola: domiciliares sem NIP (ligados ao oficial), cargos repetidos e as carreiras reais dos civis
describe('Importar as relações nominais (militares, civis e domiciliares)', () => {
  let amb, s
  const u = { email: 'teste', nome: 'Teste', papel: 'administrador' }
  before(async () => {
    amb = await criarAmbiente()
    s = amb.contentor.servicos
    await s.organica.importarQuadro(u, { simular: false, linhas: [
      { unidade: 'Comando', tipo: 'Comando', cargo: 'Comandante da Escola Superior de Guerra', funcao: 'Comando', posto: 'General', lugares: '1' },
      { unidade: 'Comando', cargo: 'Condutor do Comando', funcao: 'Execução', posto: '1.º Cabo', lugares: '1' },
      { unidade: 'Comando', cargo: 'Condutor do Comando', funcao: 'Execução', posto: '2.º Cabo', lugares: '1' },
      { unidade: 'Messe e Cantinas', cargo: 'Empregado de Mesa', funcao: 'Execução', categoriaCivil: 'Operário Qualificado', lugares: '2' },
    ] })
  })
  after(() => amb.fechar())

  it('militares: dois no mesmo cargo repetido («Condutor do Comando» ×2) entram cada um no seu', async () => {
    const linhas = [
      { nip: 'NIPREL1', posto: 'Tenente-General', ramo: 'Exército', nome: 'General Relação Teste', fps: 'QP', unidade: 'Comando', cargo: 'Comandante da Escola Superior de Guerra' },
      { nip: 'NIPREL2', posto: '1.º Cabo', ramo: 'Exército', nome: 'Condutor Um Teste', fps: 'SMO', unidade: 'Comando', cargo: 'Condutor do Comando' },
      { nip: 'NIPREL3', posto: '2.º Cabo', ramo: 'Exército', nome: 'Condutor Dois Teste', fps: 'SMO', unidade: 'Comando', cargo: 'Condutor do Comando' },
      { nip: 'NIPREL4', posto: '2.º Cabo', ramo: 'Exército', nome: 'Condutor Tres Teste', fps: 'SMO', unidade: 'Comando', cargo: 'Condutor do Comando' },
    ]
    const r = await s.importacao.importar(u, { modo: 'novos', linhas, simular: false })
    // o terceiro condutor: o cargo ganha um lugar (a relação nominal manda)
    assert.deepEqual(r.linhas.map((x) => x.acao), ['criado', 'criado', 'criado', 'criado'])
    assert.match(r.linhas[3].avisos[0], /passa a ter 2 lugares/)
    const cargos = await amb.contentor.bd.pessoa.findMany({ where: { nip: { in: ['NIPREL2', 'NIPREL3'] } }, select: { cargoId: true } })
    assert.notEqual(cargos[0].cargoId, cargos[1].cargoId)
  })

  it('civis com as carreiras reais (Operário Qualificado › Encarregado Qualificado)', async () => {
    const r = await s.importacao.importar(u, { modo: 'novos', simular: false, linhas: [
      { numeroAgente: 'AGREL1', nome: 'Empregada Mesa Teste', tipo: 'civil', vinculo: 'Funcionário', unidade: 'Messe e Cantinas', cargo: 'Empregado de Mesa', carreiraCivil: 'Operário Qualificado', categoriaCivil: 'Encarregado Qualificado', vinculoCivil: 'Nomeação definitiva' },
      { numeroAgente: 'AGREL2', nome: 'Enfermeira Real Teste', tipo: 'civil', vinculo: 'Funcionário', carreiraCivil: 'Enfermagem', categoriaCivil: 'Técnico Médio de Enfermagem de 1.ª Classe' },
    ] })
    assert.deepEqual(r.linhas.map((x) => x.acao), ['criado', 'criado'], JSON.stringify(r.linhas.map((x) => x.erro)))
    const p = await amb.contentor.bd.pessoa.findFirst({ where: { numeroAgente: 'AGREL1' } })
    assert.deepEqual([p.carreiraCivil, p.categoriaCivil], ['operario_qualificado', 'Encarregado Qualificado'])
  })

  it('domiciliares: sem NIP, ligados ao oficial pelo NIP dele; não se repetem', async () => {
    const linha = { nome: 'Domiciliar Relação Teste', tipo: 'civil', vinculo: 'Domiciliar', oficial: 'NIPREL1' }
    const r = await s.importacao.importar(u, { modo: 'novos', simular: false, linhas: [linha, { ...linha, nome: 'Outra Domiciliar Teste', oficial: 'NIPNAOEXISTE' }] })
    // sem esse oficial no sistema: entra sem oficial, com aviso, e liga-se depois pelo NIP
    assert.deepEqual(r.linhas.map((x) => x.acao), ['criado', 'criado'])
    assert.match(r.linhas[1].avisos[0], /entra sem oficial/)
    const todas = await s.pessoas.todasDomiciliares(u)
    const sem = todas.find((x) => x.nome.includes('Outra Domiciliar'))
    assert.equal(sem.oficial, null)
    await assert.rejects(() => s.pessoas.ligarDomiciliar(u, sem.id, 'NIPNAOEXISTE'), /Não há nenhum militar/)
    await s.pessoas.ligarDomiciliar(u, sem.id, 'niprel1')
    assert.equal((await s.pessoas.todasDomiciliares(u)).find((x) => x.id === sem.id).oficial.nip, 'NIPREL1')
    const d = await amb.contentor.bd.pessoa.findFirst({ where: { nome: { contains: 'Domiciliar Relação' } }, include: { militarAlocado: { select: { nip: true } } } })
    assert.deepEqual([d.vinculo, d.militarAlocado.nip], ['domiciliar', 'NIPREL1'])
    const outra = await s.importacao.importar(u, { modo: 'novos', simular: true, linhas: [linha] })
    assert.match(outra.linhas[0].erro, /Já existe/)
    // sem NIP e sem ser domiciliar, continua a ser obrigatório
    const semId = await s.importacao.importar(u, { modo: 'novos', simular: true, linhas: [{ nome: 'Sem Identificacao Teste', tipo: 'civil' }] })
    assert.match(semId.linhas[0].erro, /Falta o NIP/)
  })
})

describe('Carregar as relações nominais na actualização (scripts/carregar-relacoes.js)', () => {
  it('acrescenta unidades, cargos e fichas; à segunda vez não duplica nem muda nada', async () => {
    const { carregarRelacoes } = await import('../../scripts/carregar-relacoes.js')
    const amb = await criarAmbiente()
    try {
      const dados = {
        organica: [{ unidade: 'Centro de Estudos Teste', tipo: 'Outro', cargo: 'Director Executivo do Centro de Estudos Teste', funcao: 'Direcção e Chefia', lugares: '1' }],
        militares: [{ nip: 'NIPCAR1', posto: 'Coronel', ramo: 'Exército', nome: 'Coronel Carregado Teste', fps: 'QP', unidade: 'Centro de Estudos Teste', cargo: 'Director Executivo do Centro de Estudos Teste' }],
        civis: [{ numeroAgente: 'AGCAR1', nome: 'Civil Carregada Teste', tipo: 'civil', vinculo: 'Funcionário' }],
        domiciliares: [{ nome: 'Domiciliar Carregada Teste', tipo: 'civil', vinculo: 'Domiciliar', oficial: 'NIPCAR1' }],
      }
      const r1 = (await carregarRelacoes(amb.contentor, dados)).join('\n')
      assert.match(r1, /Orgânica: 1 unidade\(s\) e 1 cargo\(s\) acrescentados/)
      assert.match(r1, /Militares: 1 ficha\(s\) nova\(s\)/)
      assert.match(r1, /Domiciliares: 1 ficha\(s\) nova\(s\)/)
      const r2 = (await carregarRelacoes(amb.contentor, dados)).join('\n')
      assert.match(r2, /Orgânica: nada a acrescentar/)
      assert.match(r2, /Militares: 0 ficha\(s\) nova\(s\), 1 já existia/)
      assert.match(r2, /Domiciliares: 0 ficha\(s\) nova\(s\), 1 já existia/)
      assert.equal(await amb.contentor.bd.pessoa.count(), 3 + (await amb.contentor.bd.pessoa.count({ where: { NOT: { nome: { contains: 'Carregad' } } } })))
    } finally {
      await amb.fechar()
    }
  })
})

describe('Histórico lançado à mão (promoções, nomeações, louvores, condecorações), com a data opcional', () => {
  it('promoção e nomeação antigas sem data; condecoração com data; não mudam o posto actual', async () => {
    const amb = await criarAmbiente()
    try {
      const adm = amb.com(await amb.entrar())
      const p = (await adm.post('/api/pessoas').send({ tipo: 'militar', vinculo: 'funcionario', nome: 'Major Historico Teste', nip: 'NIPHIS1', genero: 'M', ramo: 'EXE', posto: 'major', fps: 'QP', quadroEspecial: 'INF' }).expect(201)).body
      await adm.post(`/api/pessoas/${p.id}/eventos`).send({ tipo: 'promocao', data: '', postoNovo: 'capitao', documento: 'Ordem n.º 12' }).expect(201)
      await adm.post(`/api/pessoas/${p.id}/eventos`).send({ tipo: 'nomeacao', cargoNome: 'Chefe da Secção de Planeamento' }).expect(201)
      await adm.post(`/api/pessoas/${p.id}/eventos`).send({ tipo: 'condecoracao', data: '2015-11-11', descricao: 'Medalha de Mérito Militar' }).expect(201)
      const f = (await adm.get(`/api/pessoas/${p.id}`).expect(200)).body
      const ev = f.eventos.filter((e) => ['promocao', 'nomeacao', 'condecoracao'].includes(e.tipo))
      assert.deepEqual(ev.map((e) => [e.tipo, e.data ? String(e.data).slice(0, 10) : null]), [['condecoracao', '2015-11-11'], ['nomeacao', null], ['promocao', null]])
      assert.equal(ev.find((e) => e.tipo === 'promocao').postoNovo, 'capitao')
      assert.equal(ev.find((e) => e.tipo === 'nomeacao').cargoNome, 'Chefe da Secção de Planeamento')
      assert.equal(f.posto, 'major')
    } finally {
      await amb.fechar()
    }
  })
})

describe('Dados por completar', () => {
  it('lista cada pessoa com o que lhe falta; a domiciliar sem oficial aparece', async () => {
    const amb = await criarAmbiente()
    try {
      const adm = amb.com(await amb.entrar())
      await adm.post('/api/pessoas').send({ tipo: 'militar', vinculo: 'funcionario', nome: 'Capitao Incompleto Teste', nip: 'NIPINC1', ramo: 'EXE', posto: 'capitao', fps: 'QP', quadroEspecial: 'INF' }).expect(201)
      await amb.contentor.servicos.importacao.importar({ email: 't', papel: 'administrador' }, { modo: 'novos', simular: false, linhas: [{ nome: 'Domiciliar Sem Oficial Teste', tipo: 'civil', vinculo: 'Domiciliar', oficial: 'NIPNAOHA' }] })
      const l = (await adm.get('/api/pessoas-incompletas').expect(200)).body
      const m = l.find((x) => x.nome === 'Capitao Incompleto Teste')
      assert.ok(m.falta.includes('BI') && m.falta.includes('Unidade') && !m.falta.includes('Posto'))
      const d = l.find((x) => x.nome === 'Domiciliar Sem Oficial Teste')
      assert.deepEqual([d.tipo, d.falta.includes('Oficial')], ['domiciliar', true])
    } finally {
      await amb.fechar()
    }
  })
})
