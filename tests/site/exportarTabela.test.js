import { describe, expect, it } from 'vitest'
import { nomeFicheiro, valoresDaTabela } from '../../src/utils/exportarTabela'

describe('exportar o que a tabela mostra', () => {
  const colunas = [{ titulo: 'Nome', valor: (l) => l.nome }, { titulo: 'NIP', valor: (l) => l.nip }, { titulo: 'Ativo', valor: (l) => l.ativo }, { titulo: 'Nota', valor: (l) => l.nota }]
  it('só as linhas dadas (as que a pesquisa deixou), Sim/Não, números como números, sem colunas vazias', () => {
    expect(valoresDaTabela(colunas, [{ nome: 'Pedro', ativo: true, nota: 14.2 }, { nome: 'Ana', nip: '', ativo: false, nota: 12 }])).toEqual([
      ['Nome', 'Ativo', 'Nota'],
      ['Pedro', 'Sim', 14.2],
      ['Ana', 'Não', 12],
    ])
  })
  it('sem resultados ficam os cabeçalhos; o nome do ficheiro vem do título, sem acentos', () => {
    expect(valoresDaTabela(colunas, [])).toEqual([['Nome', 'NIP', 'Ativo', 'Nota']])
    expect(nomeFicheiro('Estudantes da turma CEM 2026/2027', 'xlsx')).toMatch(/^estudantes-da-turma-cem-2026-2027-\d{4}-\d{2}-\d{2}\.xlsx$/)
  })
})
