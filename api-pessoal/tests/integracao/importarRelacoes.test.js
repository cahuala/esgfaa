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
    assert.deepEqual(r.linhas.map((x) => x.acao), ['criado', 'criado', 'criado', 'erro'])
    assert.match(r.linhas[3].erro, /lugar livre/)
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
    assert.deepEqual(r.linhas.map((x) => x.acao), ['criado', 'erro'])
    assert.match(r.linhas[1].erro, /Não há nenhum militar com o NIP/)
    const d = await amb.contentor.bd.pessoa.findFirst({ where: { nome: { contains: 'Domiciliar Relação' } }, include: { militarAlocado: { select: { nip: true } } } })
    assert.deepEqual([d.vinculo, d.militarAlocado.nip], ['domiciliar', 'NIPREL1'])
    const outra = await s.importacao.importar(u, { modo: 'novos', simular: true, linhas: [linha] })
    assert.match(outra.linhas[0].erro, /Já existe/)
    // sem NIP e sem ser domiciliar, continua a ser obrigatório
    const sem = await s.importacao.importar(u, { modo: 'novos', simular: true, linhas: [{ nome: 'Sem Identificacao Teste', tipo: 'civil' }] })
    assert.match(sem.linhas[0].erro, /Falta o NIP/)
  })
})
