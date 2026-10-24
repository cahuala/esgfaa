import { describe, expect, it } from 'vitest'
import { folhasDosDados, rotulo, valor } from '../../src/utils/meusDados'

describe('«Descarregar os meus dados» em Excel', () => {
  it('cabeçalhos em português e valores legíveis', () => {
    expect(rotulo('acessosAsCadeiras')).toBe('Acessos às cadeiras')
    expect(rotulo('dataNascimento')).toBe('Data nascimento')
    expect(rotulo('nip')).toBe('NIP')
    expect(valor('1971-06-06')).toBe('06/06/1971')
    expect(valor('2016-10-24T00:00:00.000Z')).toBe('24/10/2016')
    expect(valor(true)).toBe('Sim')
    expect(valor(['a', 'b'])).toBe('a; b')
    expect(valor('')).toBe(null)
  })

  it('uma folha por lista, a conta em campo/valor, os totais no resumo, sem identificadores internos', () => {
    const { resumo, folhas } = folhasDosDados({
      geradoEm: '2026-10-24T12:00:00.000Z',
      aviso: 'Dados pessoais…',
      conta: { id: 5, nome: 'Pedro Neto', ativo: true, dados: { ramo: 'Marinha' }, fotoId: null },
      notas: [{ cadeiraId: 1, p1: '16', cadeira: { codigo: 'EST101', nome: 'Estratégia' }, grelha: { 0: 4, 1: 8.5 } }],
      inscricoes: [],
      presencas: { total: 3 },
      mensagens: { enviadas: [{ id: 1, texto: 'Bom dia' }], recebidas: [] },
    })
    expect(resumo).toEqual([['Notas', 1], ['Inscrições', 0], ['Presenças', 3], ['Mensagens enviadas', 1], ['Mensagens recebidas', 0]])
    expect(folhas.map((f) => f.nome)).toEqual(['Conta', 'Notas', 'Mensagens enviadas'])
    expect(folhas[0].linhas).toEqual([['Nome', 'Pedro Neto'], ['Ativo', 'Sim'], ['Dados (ramo)', 'Marinha']])
    expect(folhas[1].colunas).toEqual(['P1', 'Cadeira (código)', 'Cadeira (nome)', 'Grelha'])
    expect(folhas[1].linhas[0]).toEqual(['16', 'EST101', 'Estratégia', '4; 8.5'])
    expect(folhas[2].colunas).toEqual(['Texto'])
  })
})
