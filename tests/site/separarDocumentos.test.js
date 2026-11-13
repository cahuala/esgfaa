import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { cortarPdf, dataDoTexto, partesDasPaginas, tipoDoNome, tipoDoTexto } from '../../src/pessoal/separar'

const TIPOS = {
  bi: 'Bilhete de Identidade', foto: 'Fotografia', certificado: 'Certificado de habilitações', diploma: 'Diploma de curso militar',
  extracto_promocao: 'Extracto de promoção', extracto_nomeacao: 'Extracto de nomeação', extracto_curso: 'Extracto de nomeação para curso', extracto: 'Extracto',
  louvor: 'Louvor / condecoração', punicao: 'Punição', saude: 'Inspecção médica', declaracao: 'Declaração', outro: 'Outro',
}

describe('processo individual: reconhecer e separar os documentos', () => {
  it('reconhece o tipo pelo texto da página (com ou sem acentos, como sai do OCR)', () => {
    expect(tipoDoTexto('REPÚBLICA DE ANGOLA\nBILHETE DE IDENTIDADE\nNome', TIPOS)).toBe('bi')
    expect(tipoDoTexto('EXTRACTO DA ORDEM DE SERVIÇO N.º 12\nÉ promovido ao posto de Capitão', TIPOS)).toBe('extracto_promocao')
    expect(tipoDoTexto('Extrato — nomeado para frequentar o Curso de Estado-Maior', TIPOS)).toBe('extracto_curso')
    expect(tipoDoTexto('EXTRACTO\nÉ nomeado Chefe da Repartição', TIPOS)).toBe('extracto_nomeacao')
    // assunto que não está nos tipos em uso: fica «Extracto»
    expect(tipoDoTexto('EXTRACTO — passa à reforma', TIPOS)).toBe('extracto')
    expect(tipoDoTexto('LOUVOR\nLouvo o 1.º Sargento…', TIPOS)).toBe('louvor')
    expect(tipoDoTexto('Certificado de Habilitações Literárias', TIPOS)).toBe('certificado')
    expect(tipoDoTexto('JUNTA MÉDICA — acta', TIPOS)).toBe('saude')
    expect(tipoDoTexto('Texto qualquer sem título', TIPOS)).toBeNull()
  })

  it('pelo nome do ficheiro, quando o texto não chega', () => {
    expect(tipoDoNome('Processos/123456/BI frente e verso.pdf', TIPOS)).toBe('bi')
    expect(tipoDoNome('123456_bi.jpg', TIPOS)).toBe('bi')
    expect(tipoDoNome('extracto-promocao-2020.pdf', TIPOS)).toBe('extracto_promocao')
    expect(tipoDoNome('biografia.pdf', TIPOS)).toBeNull()
  })

  it('a data do documento é a última do texto (a da assinatura)', () => {
    expect(dataDoTexto('Ordem n.º 3 de 02/01/2019 … Luanda, aos 15 de Março de 2020')).toBe('2020-03-15')
    expect(dataDoTexto('Publicado em 7-9-2018')).toBe('2018-09-07')
    expect(dataDoTexto('sem data')).toBe('')
  })

  it('separa um PDF: página reconhecida com outro tipo começa um documento; sem tipo continua o anterior', () => {
    // a 2.ª folha do extracto que só diz «extracto» continua o extracto de promoção
    const paginas = [{ tipo: 'bi' }, { tipo: null }, { tipo: 'extracto_promocao' }, { tipo: 'extracto' }, { tipo: 'louvor' }, { tipo: 'louvor' }]
    expect(partesDasPaginas(paginas, null)).toEqual([{ inicio: 0, tipo: 'bi' }, { inicio: 2, tipo: 'extracto_promocao' }, { inicio: 4, tipo: 'louvor' }])
    // nada reconhecido: um documento só, com o tipo do nome (ou «Outro»)
    expect(partesDasPaginas([{ tipo: null }, { tipo: null }], 'bi')).toEqual([{ inicio: 0, tipo: 'bi' }])
    expect(partesDasPaginas([{ tipo: null }], null)).toEqual([{ inicio: 0, tipo: 'outro' }])
  })

  it('corta as páginas de uma parte num PDF novo', async () => {
    const doc = await PDFDocument.create()
    for (let i = 0; i < 5; i++) doc.addPage([200 + i, 300])
    const f = new File([await doc.save()], 'processo.pdf', { type: 'application/pdf' })
    const parte = await cortarPdf(f, 2, 4)
    expect(parte.name).toBe('processo (pág. 3-4).pdf')
    const lido = await PDFDocument.load(await parte.arrayBuffer())
    expect(lido.getPages().map((p) => p.getWidth())).toEqual([202, 203])
  })
})
