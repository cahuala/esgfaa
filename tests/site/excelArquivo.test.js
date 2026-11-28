import { test, vi, expect } from 'vitest'
const visto = {}
vi.mock('write-excel-file/browser', () => ({ default: (dados, opcoes) => { visto.dados = dados; visto.opcoes = opcoes; return { toFile: async () => {} } } }))
// o Excel dos documentos (como os do arquivo): várias folhas, o cabeçalho a cinzento, os NIP como texto e as notas como número
test('Excel com folhas e o estilo dos ficheiros do arquivo', async () => {
  const { descarregarExcel, cabecalho } = await import('../../src/admin/paginas/academico/documentos/csv.js')
  await descarregarExcel('t', [{ folha: '31º CSCD' }, ['ESCOLA SUPERIOR DE GUERRA'], [], ['Nº', 'NIP', 'NOME'], ['01', '30017892', 'João'], { folha: '17º CEAO' }, cabecalho(['JANEIRO', '1', '2']), ['08:30', 'OE', '16,50']])
  expect(visto.dados.map((f) => f.sheet)).toEqual(['31º CSCD', '17º CEAO'])
  expect(visto.dados[0].data[5][0].fontFamily).toBe('Century Gothic')
  expect(visto.dados[0].data[7][0].backgroundColor).toBe('#C0C0C0')
  expect(visto.dados[0].data[8][1].value).toBe('30017892')
  expect(visto.dados[0].data[8][1].borderStyle).toBe('thin')
  expect(visto.dados[1].data[5][0].backgroundColor).toBe('#C0C0C0')
  expect(visto.dados[1].data[6][2].value).toBe(16.5)
})

// o «APROVADO» do Comandante no canto superior direito (as 5 linhas do topo, com o emblema à esquerda)
test('Excel aprovado pelo Comandante', async () => {
  const { descarregarExcel } = await import('../../src/admin/paginas/academico/documentos/csv.js')
  await descarregarExcel('t', [['ESCOLA SUPERIOR DE GUERRA'], ['Nº', 'NIP', 'NOME', 'POSTO', 'RAMO', 'MÉDIA']], { aprovado: { nome: 'Nome do Comandante', posto: 'Tenente-General' } })
  const textos = visto.dados.slice(0, 5).map((l) => l.find((c) => c)?.value)
  expect(textos).toEqual(['APROVADO', 'O COMANDANTE DA ESG', '______________________________', 'NOME DO COMANDANTE', '***TENENTE-GENERAL***'])
  expect(visto.dados[0].findIndex((c) => c)).toBe(3)
  expect(visto.opcoes.sheet).toBe('Folha1')
})

