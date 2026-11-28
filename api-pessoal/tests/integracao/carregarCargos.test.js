import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente } from '../apoio/ambiente.js'
import { carregarCargos } from '../../scripts/carregar-relacoes.js'

// quem assina os documentos (dos documentos assinados do arquivo): nomeado só para um cargo vazio, sem tirar ninguém
describe('Carga: quem assina os documentos', () => {
  let amb, s
  const u = { email: 'teste', nome: 'Teste', papel: 'administrador' }
  before(async () => {
    amb = await criarAmbiente()
    s = amb.contentor.servicos
    await s.organica.importarQuadro(u, { simular: false, linhas: [
      { unidade: 'Comando', tipo: 'Comando', cargo: 'Comandante da Escola Superior de Guerra', funcao: 'Comando', posto: 'General', lugares: '1' },
      { unidade: 'Direcção de Ensino', cargo: 'Director da Direcção de Ensino da Escola Superior de Guerra', funcao: 'Direcção', posto: 'Brigadeiro', lugares: '1' },
    ] })
    await s.importacao.importar(u, { modo: 'novos', simular: false, linhas: [
      { nip: 'NIPCMD1', posto: 'Tenente-General', ramo: 'Exército', nome: 'Carlos Comandante Teste', fps: 'QP' },
      { nip: 'NIPDIR1', posto: 'Brigadeiro', ramo: 'Exército', nome: 'Director Ensino Teste', fps: 'QP', unidade: 'Direcção de Ensino', cargo: 'Director da Direcção de Ensino da Escola Superior de Guerra' },
      { nip: 'NIPOUT1', posto: 'Coronel', ramo: 'Exército', nome: 'Outro Oficial Teste', fps: 'QP' },
    ] })
  })
  after(() => amb.fechar())

  it('nomeia quem não tem cargo para o cargo vazio; o resto fica como está', async () => {
    const lista = [
      { nip: 'NIPCMD1', nome: 'Carlos Comandante Teste', cargo: 'Comandante da Escola Superior de Guerra', unidade: 'Comando', fonte: 'Pautas assinadas' },
      // o cargo já está ocupado: não se troca
      { nip: 'NIPOUT1', nome: 'Outro Oficial Teste', cargo: 'Director da Direcção de Ensino da Escola Superior de Guerra', unidade: 'Direcção de Ensino' },
      // o NIP é de outra pessoa
      { nip: 'NIPOUT1', nome: 'Fulano Diferente Nome', cargo: 'Comandante da Escola Superior de Guerra', unidade: 'Comando' },
    ]
    const linhas = await carregarCargos(amb.contentor, lista, u)
    assert.match(linhas.join('\n'), /\+ Carlos Comandante Teste: Comandante da Escola Superior de Guerra/)
    assert.match(linhas.join('\n'), /já ocupado por Director Ensino Teste/)
    assert.match(linhas.join('\n'), /sem ficha com este NIP e este nome/)
    const bd = amb.contentor.bd
    const cmd = await bd.pessoa.findFirst({ where: { nip: 'NIPCMD1' }, include: { cargo: true, eventos: true } })
    assert.equal(cmd.cargo.nome, 'Comandante da Escola Superior de Guerra')
    assert.ok(cmd.eventos.some((e) => e.tipo === 'nomeacao' && e.documento === 'Pautas assinadas'))
    assert.equal((await bd.pessoa.findFirst({ where: { nip: 'NIPOUT1' } })).cargoId, null)
    // outra vez: já está
    assert.match((await carregarCargos(amb.contentor, lista.slice(0, 1), u)).join('\n'), /já é Comandante/)
  })
})
