import { describe, expect, it } from 'vitest'
import { lerCsv, lerXlsx, mapearColunas } from '../../src/admin/paginas/academico/lerFolha'

const enc = new TextEncoder()
async function deflate(bytes) {
  const fluxo = new Response(bytes).body.pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(fluxo).arrayBuffer())
}

// ZIP mínimo (sem CRC: o leitor não o confere); comprimir = entradas em deflate
async function zip(ficheiros, comprimir) {
  const locais = []
  const central = []
  let pos = 0
  for (const [nome, texto] of Object.entries(ficheiros)) {
    const n = enc.encode(nome)
    const cru = enc.encode(texto)
    const dados = comprimir ? await deflate(cru) : cru
    const l = new DataView(new ArrayBuffer(30))
    l.setUint32(0, 0x04034b50, true); l.setUint16(8, comprimir ? 8 : 0, true); l.setUint32(18, dados.length, true); l.setUint32(22, cru.length, true); l.setUint16(26, n.length, true)
    const c = new DataView(new ArrayBuffer(46))
    c.setUint32(0, 0x02014b50, true); c.setUint16(10, comprimir ? 8 : 0, true); c.setUint32(20, dados.length, true); c.setUint32(24, cru.length, true); c.setUint16(28, n.length, true); c.setUint32(42, pos, true)
    locais.push(new Uint8Array(l.buffer), n, dados)
    central.push(new Uint8Array(c.buffer), n)
    pos += 30 + n.length + dados.length
  }
  const tamCentral = central.reduce((s, x) => s + x.length, 0)
  const fim = new DataView(new ArrayBuffer(22))
  fim.setUint32(0, 0x06054b50, true); fim.setUint16(8, Object.keys(ficheiros).length, true); fim.setUint16(10, Object.keys(ficheiros).length, true); fim.setUint32(12, tamCentral, true); fim.setUint32(16, pos, true)
  return new Blob([...locais, ...central, new Uint8Array(fim.buffer)]).arrayBuffer()
}

const FOLHA = {
  'xl/sharedStrings.xml': '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>Nome completo</t></si><si><t>E-mail</t></si><si><t>Posto</t></si><si><t>Cap. Carlos Mendes</t></si><si><r><t>carlos</t></r><r><t>@esgfaa.gov.ao</t></r></si></sst>',
  'xl/worksheets/sheet1.xml': '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'
    + '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="D1" t="s"><v>2</v></c></row>'
    + '<row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2" t="s"><v>4</v></c><c r="D2" t="inlineStr"><is><t>Capitão</t></is></c></row>'
    + '<row r="3"></row></sheetData></worksheet>',
}

describe('leitura de folhas de estudantes', () => {
  it('CSV do Excel português (;) com aspas e BOM', () => {
    const t = '﻿Nome;E-mail;NIP\r\n"Maj. Sousa; Filho";sousa@esgfaa.gov.ao;123\r\n"Diz ""olá""";x@esgfaa.gov.ao;\r\n\r\n'
    expect(lerCsv(t)).toEqual([['Nome', 'E-mail', 'NIP'], ['Maj. Sousa; Filho', 'sousa@esgfaa.gov.ao', '123'], ['Diz "olá"', 'x@esgfaa.gov.ao', '']])
    expect(lerCsv('nome,email\nA,b@c')).toEqual([['nome', 'email'], ['A', 'b@c']])
  })

  it('colunas pelo nome, com ou sem acentos; avisa o que falta', () => {
    const r = mapearColunas([['Estudante', 'Correio eletrónico', 'Telemóvel', 'Outra'], ['Ana', 'ana@esgfaa.gov.ao', '923', 'x']])
    expect(r.linhas).toEqual([{ nome: 'Ana', email: 'ana@esgfaa.gov.ao', telefone: '923' }])
    expect(r.faltam).toEqual([])
    expect(mapearColunas([['Nome'], ['Ana']]).faltam).toEqual(['email'])
  })

  it.each([false, true])('XLSX (comprimido: %s): textos partilhados, inline e células vazias', async (comprimir) => {
    const tabela = await lerXlsx(await zip(FOLHA, comprimir))
    expect(tabela).toEqual([['Nome completo', 'E-mail', '', 'Posto'], ['Cap. Carlos Mendes', 'carlos@esgfaa.gov.ao', '', 'Capitão']])
    expect(mapearColunas(tabela).linhas).toEqual([{ nome: 'Cap. Carlos Mendes', email: 'carlos@esgfaa.gov.ao', posto: 'Capitão' }])
  })

  it('recusa o que não é um XLSX', async () => {
    await expect(lerXlsx(new TextEncoder().encode('isto não é um zip').buffer)).rejects.toThrow(/não é um Excel/)
  })
})
